import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IPollFunctions,
	IWebhookFunctions,
	IHttpRequestMethods,
	IRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export type ZavuContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions
	| IPollFunctions;

const DEFAULT_BASE_URL = 'https://api.zavu.dev';

/**
 * n8n's request helper does not throw the raw HTTP failure: it has already
 * wrapped it in a `NodeApiError` whose `description` is the API's `message` and
 * whose `messages` carries the full `{code, message}` body. That is exactly what
 * a user needs to see.
 *
 * Wrapping it a second time throws all of it away. NodeApiError only reads the
 * API body out of shapes it recognizes, and an already-wrapped error is not one
 * of them, so the re-wrap produced a bare "Bad request - please check your
 * parameters" with no description at all. Found by running a workflow against a
 * 400 in a real n8n; a unit test with a hand-built error shape said it worked.
 */
function isAlreadyWrapped(error: unknown): boolean {
	return (
		error instanceof NodeApiError ||
		// Cheap fallback: a duplicated n8n-workflow copy would defeat instanceof.
		(typeof error === 'object' && error !== null && (error as Error).name === 'NodeApiError')
	);
}

export async function zavuApiRequest(
	this: ZavuContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject | undefined = undefined,
	qs: IDataObject = {},
	headers: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('zavuApi');
	const rawBase = (credentials.baseUrl as string) || DEFAULT_BASE_URL;
	const baseUrl = rawBase.trim().replace(/\/+$/, '');

	const options: IRequestOptions = {
		method,
		uri: `${baseUrl}${endpoint}`,
		qs,
		body,
		json: true,
		headers: {
			'Content-Type': 'application/json',
			// Lets Zavu attribute traffic to the integration rather than to an
			// anonymous script, which is what makes support able to help.
			'User-Agent': 'n8n-nodes-zavu',
			...headers,
		},
	};

	if (body === undefined || Object.keys(body).length === 0) {
		delete options.body;
	}
	if (Object.keys(qs).length === 0) {
		delete options.qs;
	}

	try {
		return await this.helpers.requestWithAuthentication.call(this, 'zavuApi', options);
	} catch (error) {
		if (isAlreadyWrapped(error)) throw error;
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Walk a cursor-paginated list endpoint to the end.
 *
 * Every Zavu list returns `{ items, nextCursor }` and caps `limit` at 100. The
 * cursor is opaque — it is passed back verbatim, never constructed.
 */
export async function zavuApiRequestAllItems(
	this: ZavuContext,
	endpoint: string,
	qs: IDataObject = {},
	headers: IDataObject = {},
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	const query: IDataObject = { ...qs, limit: 100 };

	// A hard stop rather than `while (true)`: a backend that ever returned the
	// same cursor twice would otherwise hang the workflow forever.
	for (let page = 0; page < 1000; page++) {
		const response = (await zavuApiRequest.call(
			this,
			'GET',
			endpoint,
			undefined,
			query,
			headers,
		)) as IDataObject;

		const batch = (response.items as IDataObject[]) ?? [];
		items.push(...batch);

		const nextCursor = response.nextCursor as string | null | undefined;
		if (!nextCursor || batch.length === 0) break;
		query.cursor = nextCursor;
	}

	return items;
}

/**
 * Fetch either the first page or every page, depending on the node's
 * "Return All" toggle.
 */
export async function zavuApiRequestList(
	this: IExecuteFunctions,
	itemIndex: number,
	endpoint: string,
	qs: IDataObject = {},
): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;

	if (returnAll) {
		return zavuApiRequestAllItems.call(this, endpoint, qs);
	}

	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const response = (await zavuApiRequest.call(this, 'GET', endpoint, undefined, {
		...qs,
		limit,
	})) as IDataObject;

	return ((response.items as IDataObject[]) ?? []).slice(0, limit);
}

/**
 * Zavu wraps some entities in a single-key envelope (`{ message: {...} }`,
 * `{ broadcast: {...} }`) and returns others bare (`templates`, `senders`,
 * `contacts`). Unwrapping the known envelopes means every operation in this node
 * emits the entity itself, so a downstream expression is `{{ $json.id }}`
 * regardless of which resource produced it.
 */
const ENVELOPE_KEYS = [
	'message',
	'broadcast',
	'call',
	'conversation',
	'agent',
	'url',
	'phoneNumber',
	'channel',
	'contact',
	'sender',
	'template',
	'execution',
	'run',
	'domain',
	'function',
	'invitation',
	'profile',
	'sync',
];

export function unwrapEnvelope(response: unknown): IDataObject {
	if (response === null || response === undefined) return {};
	if (typeof response !== 'object') return { value: response };

	const body = response as IDataObject;
	const keys = Object.keys(body);

	if (keys.length === 1 && ENVELOPE_KEYS.includes(keys[0])) {
		const inner = body[keys[0]];
		if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
			return inner as IDataObject;
		}
	}

	return body;
}

/**
 * Turn a `Name = Value` fixedCollection into the flat string map the API takes
 * for template variables and metadata.
 */
export function keyValueToRecord(
	collection: IDataObject | undefined,
	propertyName = 'variable',
): Record<string, string> | undefined {
	const entries = (collection?.[propertyName] as IDataObject[]) ?? [];
	if (entries.length === 0) return undefined;

	const record: Record<string, string> = {};
	for (const entry of entries) {
		const name = (entry.name as string)?.trim();
		if (!name) continue;
		record[name] = String(entry.value ?? '');
	}

	return Object.keys(record).length > 0 ? record : undefined;
}

/** `Zavu-Sender` is a header, not a body field. */
export function senderHeader(senderId?: string): IDataObject {
	const trimmed = senderId?.trim();
	return trimmed ? { 'Zavu-Sender': trimmed } : {};
}

export function assertRequired(
	ctx: IExecuteFunctions,
	value: unknown,
	field: string,
	itemIndex: number,
): void {
	if (value === undefined || value === null || value === '') {
		throw new NodeOperationError(ctx.getNode(), `"${field}" is required for this operation`, {
			itemIndex,
		});
	}
}

// --------------------------------------------------------------------------
// Load options — the dropdowns that spare people from pasting IDs
// --------------------------------------------------------------------------

export async function getSenders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const senders = await zavuApiRequestAllItems.call(this, '/v1/senders');

	return senders.map((sender) => {
		const channels = (sender.channels as string[]) ?? [];
		// `channels` is computed from the sender's real configuration, so an empty
		// array genuinely means "cannot send anything yet". Saying so in the
		// dropdown beats discovering it from a 400 at run time.
		const capability = channels.length > 0 ? channels.join(', ') : 'no channels configured';
		const identity = (sender.phoneNumber as string) || (sender.emailAddress as string) || '';

		return {
			name: `${sender.name as string}${identity ? ` (${identity})` : ''} — ${capability}`,
			value: sender.id as string,
			description: sender.isDefault ? 'Project default sender' : undefined,
		};
	});
}

export async function getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const templates = await zavuApiRequestAllItems.call(this, '/v1/templates');

	return templates.map((template) => ({
		name: `${template.name as string} (${template.language as string}) — ${
			(template.status as string) ?? 'draft'
		}`,
		value: template.id as string,
	}));
}

export async function getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const agents = await zavuApiRequestAllItems.call(this, '/v1/agents');

	return agents.map((agent) => ({
		name: `${agent.name as string}${agent.enabled ? '' : ' (disabled)'}`,
		value: agent.id as string,
	}));
}

export async function getPhoneNumbers(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const numbers = await zavuApiRequestAllItems.call(this, '/v1/phone-numbers');

	return numbers.map((number) => ({
		name: `${number.phoneNumber as string}${number.name ? ` — ${number.name as string}` : ''}`,
		value: number.id as string,
	}));
}
