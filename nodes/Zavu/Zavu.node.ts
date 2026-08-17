import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	getAgents,
	getPhoneNumbers,
	getSenders,
	getTemplates,
	keyValueToRecord,
	senderHeader,
	unwrapEnvelope,
	zavuApiRequest,
	zavuApiRequestList,
} from './GenericFunctions';
import {
	BODY_ONLY_TYPES,
	MEDIA_TYPES,
	buildSendMessageBody,
	type SendMessageParams,
} from './messageBody';

import { messageFields, messageOperations } from './descriptions/MessageDescription';
import { conversationFields, conversationOperations } from './descriptions/ConversationDescription';
import { contactFields, contactOperations } from './descriptions/ContactDescription';
import { templateFields, templateOperations } from './descriptions/TemplateDescription';
import { broadcastFields, broadcastOperations } from './descriptions/BroadcastDescription';
import { senderFields, senderOperations } from './descriptions/SenderDescription';
import { agentFields, agentOperations } from './descriptions/AgentDescription';
import { callFields, callOperations } from './descriptions/CallDescription';
import { phoneNumberFields, phoneNumberOperations } from './descriptions/PhoneNumberDescription';
import { utilityFields, utilityOperations } from './descriptions/UtilityDescription';
import { customFields, customOperations } from './descriptions/CustomDescription';

export class Zavu implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zavu',
		name: 'zavu',
		// The Zavu isotype is monochrome by brand rule: black on light surfaces,
		// white on dark ones. n8n picks per the viewer's theme.
		icon: { light: 'file:zavu.svg', dark: 'file:zavu.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'One API for SMS, WhatsApp, Telegram, Email, Instagram, Messenger and Voice',
		defaults: { name: 'Zavu' },
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [{ name: 'zavuApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Agent', value: 'agent' },
					{ name: 'Broadcast', value: 'broadcast' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Custom API Call', value: 'custom' },
					{ name: 'Message', value: 'message' },
					{ name: 'Phone Number', value: 'phoneNumber' },
					{ name: 'Sender', value: 'sender' },
					{ name: 'Template', value: 'template' },
					{ name: 'Utility', value: 'utility' },
					{ name: 'Voice Call', value: 'call' },
				],
				default: 'message',
			},

			...messageOperations,
			...messageFields,
			...conversationOperations,
			...conversationFields,
			...contactOperations,
			...contactFields,
			...templateOperations,
			...templateFields,
			...broadcastOperations,
			...broadcastFields,
			...senderOperations,
			...senderFields,
			...agentOperations,
			...agentFields,
			...callOperations,
			...callFields,
			...phoneNumberOperations,
			...phoneNumberFields,
			...utilityOperations,
			...utilityFields,
			...customOperations,
			...customFields,
		],
	};

	methods = {
		loadOptions: { getSenders, getTemplates, getAgents, getPhoneNumbers },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// `addContacts` from input items consumes every item at once instead of
		// once per item — batching is the whole point of the endpoint (1000 per
		// call), and looping would issue one request per recipient.
		const consumesAllItems =
			resource === 'broadcast' &&
			operation === 'addContacts' &&
			(this.getNodeParameter('contactsSource', 0, 'list') as string) === 'input';

		const itemCount = consumesAllItems ? 1 : items.length;

		for (let i = 0; i < itemCount; i++) {
			try {
				const results = await executeOperation.call(this, resource, operation, i, items);

				returnData.push(
					...results.map((json) => ({
						json,
						pairedItem: { item: i },
					})),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

async function executeOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
	items: INodeExecutionData[],
): Promise<IDataObject[]> {
	switch (resource) {
		case 'message':
			return executeMessage.call(this, operation, i);
		case 'conversation':
			return executeConversation.call(this, operation, i);
		case 'contact':
			return executeContact.call(this, operation, i);
		case 'template':
			return executeTemplate.call(this, operation, i);
		case 'broadcast':
			return executeBroadcast.call(this, operation, i, items);
		case 'sender':
			return executeSender.call(this, operation, i);
		case 'agent':
			return executeAgent.call(this, operation, i);
		case 'call':
			return executeCall.call(this, operation, i);
		case 'phoneNumber':
			return executePhoneNumber.call(this, operation, i);
		case 'utility':
			return executeUtility.call(this, operation, i);
		case 'custom':
			return executeCustom.call(this, i);
		default:
			throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
				itemIndex: i,
			});
	}
}

// ---------------------------------------------------------------- message ---

async function executeMessage(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'send') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const body = buildSendMessageBody(collectSendParams.call(this, i, options));

		const response = await zavuApiRequest.call(
			this,
			'POST',
			'/v1/messages',
			body,
			{},
			senderHeader(options.senderId as string),
		);

		return [unwrapEnvelope(response)];
	}

	if (operation === 'get') {
		const messageId = this.getNodeParameter('messageId', i) as string;
		const response = await zavuApiRequest.call(this, 'GET', `/v1/messages/${messageId}`);
		return [unwrapEnvelope(response)];
	}

	if (operation === 'getAttachments') {
		const messageId = this.getNodeParameter('messageId', i) as string;
		const response = (await zavuApiRequest.call(
			this,
			'GET',
			`/v1/messages/${messageId}/attachments`,
		)) as IDataObject;
		return ((response.items as IDataObject[]) ?? []).map((item) => item);
	}

	if (operation === 'react') {
		const messageId = this.getNodeParameter('messageId', i) as string;
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const response = await zavuApiRequest.call(
			this,
			'POST',
			`/v1/messages/${messageId}/reactions`,
			{ emoji: this.getNodeParameter('emoji', i) as string },
			{},
			senderHeader(options.senderId as string),
		);
		return [unwrapEnvelope(response)];
	}

	if (operation === 'typing') {
		const messageId = this.getNodeParameter('messageId', i) as string;
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const response = await zavuApiRequest.call(
			this,
			'POST',
			`/v1/messages/${messageId}/typing`,
			undefined,
			{},
			senderHeader(options.senderId as string),
		);
		return [response as IDataObject];
	}

	if (operation === 'getMany') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		return zavuApiRequestList.call(this, i, '/v1/messages', filters);
	}

	throw new NodeOperationError(this.getNode(), `Unknown message operation "${operation}"`, {
		itemIndex: i,
	});
}

/**
 * Read the send parameters off the node. Only the fields the chosen message type
 * actually uses are read, so an unrelated leftover value from a previous type
 * cannot leak into the request.
 */
function collectSendParams(
	this: IExecuteFunctions,
	i: number,
	options: IDataObject,
): SendMessageParams {
	const messageType = this.getNodeParameter('messageType', i) as string;
	const channel = this.getNodeParameter('channel', i) as string;

	const params: SendMessageParams = {
		to: this.getNodeParameter('to', i) as string,
		channel,
		messageType,
		text: (this.getNodeParameter('text', i, '') as string) || undefined,
		options: {
			...options,
			metadata: keyValueToRecord(options.metadata as IDataObject, 'metadata'),
		},
	};

	if (channel === 'email') {
		params.subject = (this.getNodeParameter('subject', i, '') as string) || undefined;
		params.htmlBody = (this.getNodeParameter('htmlBody', i, '') as string) || undefined;
	}

	if (MEDIA_TYPES.includes(messageType)) {
		params.mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
		params.filename = (this.getNodeParameter('filename', i, '') as string) || undefined;
	}

	if (messageType === 'location') {
		params.latitude = this.getNodeParameter('latitude', i) as number;
		params.longitude = this.getNodeParameter('longitude', i) as number;
		params.locationName = (this.getNodeParameter('locationName', i, '') as string) || undefined;
		params.locationAddress =
			(this.getNodeParameter('locationAddress', i, '') as string) || undefined;
	}

	if (messageType === 'contact') {
		const collection = this.getNodeParameter('contacts', i, {}) as IDataObject;
		params.contacts = ((collection.contact as IDataObject[]) ?? []).map((entry) => ({
			name: entry.name as string,
			phones: entry.phones as string,
		}));
	}

	if (messageType === 'buttons') {
		const collection = this.getNodeParameter('buttons', i, {}) as IDataObject;
		params.buttons = ((collection.button as IDataObject[]) ?? []).map((entry) => ({
			id: entry.id as string,
			title: entry.title as string,
		}));
	}

	if (messageType === 'list') {
		params.listButton = (this.getNodeParameter('listButton', i, '') as string) || undefined;
		const collection = this.getNodeParameter('sections', i, {}) as IDataObject;
		params.sections = ((collection.section as IDataObject[]) ?? []).map((section) => {
			const rowCollection = (section.rows as IDataObject) ?? {};
			return {
				title: section.title as string,
				rows: ((rowCollection.row as IDataObject[]) ?? []).map((row) => ({
					id: row.id as string,
					title: row.title as string,
					description: row.description as string,
				})),
			};
		});
	}

	if (messageType === 'cta_url') {
		params.ctaDisplayText = (this.getNodeParameter('ctaDisplayText', i, '') as string) || undefined;
		params.ctaUrl = (this.getNodeParameter('ctaUrl', i, '') as string) || undefined;
	}

	if (messageType === 'template') {
		params.templateId = this.getNodeParameter('templateId', i) as string;
		params.templateVariables = keyValueToRecord(
			this.getNodeParameter('templateVariables', i, {}) as IDataObject,
		);
		params.templateButtonVariables = keyValueToRecord(
			options.templateButtonVariables as IDataObject,
		);
		params.templateHeaderVariables = keyValueToRecord(
			options.templateHeaderVariables as IDataObject,
		);
	}

	// A body-only type sends its prompt as `text` and nothing else. Reading any
	// other field here would put a `content` object on a request that must not
	// carry one.
	if (BODY_ONLY_TYPES.includes(messageType) && !params.text) {
		throw new NodeOperationError(
			this.getNode(),
			`"${messageType}" carries its prompt in the Text field, which is empty`,
			{ itemIndex: i },
		);
	}

	return params;
}

// ----------------------------------------------------------- conversation ---

async function executeConversation(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'getMany') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		return zavuApiRequestList.call(this, i, '/v1/conversations', filters);
	}

	const conversationId = this.getNodeParameter('conversationId', i) as string;

	if (operation === 'get') {
		const response = await zavuApiRequest.call(this, 'GET', `/v1/conversations/${conversationId}`);
		return [unwrapEnvelope(response)];
	}

	if (operation === 'getMessages') {
		return zavuApiRequestList.call(this, i, `/v1/conversations/${conversationId}/messages`);
	}

	if (operation === 'markRead') {
		const response = await zavuApiRequest.call(
			this,
			'POST',
			`/v1/conversations/${conversationId}/read`,
		);
		return [unwrapEnvelope(response)];
	}

	throw new NodeOperationError(this.getNode(), `Unknown conversation operation "${operation}"`, {
		itemIndex: i,
	});
}

// ---------------------------------------------------------------- contact ---

async function executeContact(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'create') {
		const collection = this.getNodeParameter('channels', i, {}) as IDataObject;
		const entries = (collection.channel as IDataObject[]) ?? [];

		if (entries.length === 0) {
			throw new NodeOperationError(this.getNode(), 'A contact needs at least one channel', {
				itemIndex: i,
			});
		}

		const body: IDataObject = {
			channels: entries.map((entry) => {
				const channel: IDataObject = {
					channel: entry.channel as string,
					identifier: entry.identifier as string,
				};
				if (entry.label) channel.label = entry.label;
				if (entry.isPrimary) channel.isPrimary = true;
				return channel;
			}),
		};

		const displayName = this.getNodeParameter('displayName', i, '') as string;
		if (displayName) body.displayName = displayName;

		const metadata = keyValueToRecord(
			this.getNodeParameter('metadata', i, {}) as IDataObject,
			'metadata',
		);
		if (metadata) body.metadata = metadata;

		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/contacts', body))];
	}

	if (operation === 'getMany') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		return zavuApiRequestList.call(this, i, '/v1/contacts', filters);
	}

	if (operation === 'getByPhone') {
		const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
		const response = await zavuApiRequest.call(
			this,
			'GET',
			`/v1/contacts/phone/${encodeURIComponent(phoneNumber)}`,
		);
		return [unwrapEnvelope(response)];
	}

	const contactId = this.getNodeParameter('contactId', i) as string;

	if (operation === 'get') {
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'GET', `/v1/contacts/${contactId}`))];
	}

	if (operation === 'update') {
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		if (updateFields.defaultChannel) body.defaultChannel = updateFields.defaultChannel;

		const metadata = keyValueToRecord(updateFields.metadata as IDataObject, 'metadata');
		if (metadata) body.metadata = metadata;

		return [
			unwrapEnvelope(await zavuApiRequest.call(this, 'PATCH', `/v1/contacts/${contactId}`, body)),
		];
	}

	if (operation === 'delete') {
		await zavuApiRequest.call(this, 'DELETE', `/v1/contacts/${contactId}`);
		return [{ deleted: true, id: contactId }];
	}

	if (operation === 'addChannel') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const body: IDataObject = {
			channel: this.getNodeParameter('channel', i) as string,
			identifier: this.getNodeParameter('identifier', i) as string,
			...options,
		};
		return [
			unwrapEnvelope(
				await zavuApiRequest.call(this, 'POST', `/v1/contacts/${contactId}/channels`, body),
			),
		];
	}

	if (operation === 'merge') {
		const body = { sourceContactId: this.getNodeParameter('sourceContactId', i) as string };
		return [
			unwrapEnvelope(
				await zavuApiRequest.call(this, 'POST', `/v1/contacts/${contactId}/merge`, body),
			),
		];
	}

	throw new NodeOperationError(this.getNode(), `Unknown contact operation "${operation}"`, {
		itemIndex: i,
	});
}

// --------------------------------------------------------------- template ---

async function executeTemplate(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'getMany') {
		return zavuApiRequestList.call(this, i, '/v1/templates');
	}

	if (operation === 'create') {
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body: IDataObject = {
			name: this.getNodeParameter('name', i) as string,
			language: this.getNodeParameter('language', i) as string,
			body: this.getNodeParameter('body', i) as string,
			...additionalFields,
		};
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/templates', body))];
	}

	if (operation === 'sync') {
		const senderId = this.getNodeParameter('syncSenderId', i, '') as string;
		const body: IDataObject = senderId ? { senderId } : {};
		return [(await zavuApiRequest.call(this, 'POST', '/v1/templates/sync', body)) as IDataObject];
	}

	const templateId = this.getNodeParameter('templateId', i) as string;

	if (operation === 'get') {
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'GET', `/v1/templates/${templateId}`))];
	}

	if (operation === 'delete') {
		await zavuApiRequest.call(this, 'DELETE', `/v1/templates/${templateId}`);
		return [{ deleted: true, id: templateId }];
	}

	if (operation === 'submit') {
		const body: IDataObject = {
			senderId: this.getNodeParameter('senderId', i) as string,
			category: this.getNodeParameter('category', i) as string,
		};
		return [
			unwrapEnvelope(
				await zavuApiRequest.call(this, 'POST', `/v1/templates/${templateId}/submit`, body),
			),
		];
	}

	throw new NodeOperationError(this.getNode(), `Unknown template operation "${operation}"`, {
		itemIndex: i,
	});
}

// -------------------------------------------------------------- broadcast ---

async function executeBroadcast(
	this: IExecuteFunctions,
	operation: string,
	i: number,
	items: INodeExecutionData[],
): Promise<IDataObject[]> {
	if (operation === 'create') {
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const messageType = this.getNodeParameter('messageType', i, 'text') as string;

		const body: IDataObject = {
			name: this.getNodeParameter('name', i) as string,
			channel: this.getNodeParameter('channel', i) as string,
			messageType,
		};

		const text = this.getNodeParameter('text', i, '') as string;
		if (text) body.text = text;

		const content: IDataObject = {};
		const mediaUrl = this.getNodeParameter('mediaUrl', i, '') as string;
		if (mediaUrl) content.mediaUrl = mediaUrl;
		if (messageType === 'template') {
			content.templateId = this.getNodeParameter('templateId', i, '') as string;
		}
		if (Object.keys(content).length > 0) body.content = content;

		const { senderId, ...rest } = additionalFields;
		Object.assign(body, rest);
		if (senderId) body.senderId = senderId;

		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/broadcasts', body))];
	}

	if (operation === 'getMany') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		return zavuApiRequestList.call(this, i, '/v1/broadcasts', filters);
	}

	const broadcastId = this.getNodeParameter('broadcastId', i) as string;

	if (operation === 'get') {
		return [
			unwrapEnvelope(await zavuApiRequest.call(this, 'GET', `/v1/broadcasts/${broadcastId}`)),
		];
	}

	if (operation === 'progress') {
		const response = await zavuApiRequest.call(
			this,
			'GET',
			`/v1/broadcasts/${broadcastId}/progress`,
		);
		return [response as IDataObject];
	}

	if (operation === 'delete') {
		await zavuApiRequest.call(this, 'DELETE', `/v1/broadcasts/${broadcastId}`);
		return [{ deleted: true, id: broadcastId }];
	}

	if (operation === 'cancel') {
		const response = await zavuApiRequest.call(
			this,
			'POST',
			`/v1/broadcasts/${broadcastId}/cancel`,
		);
		return [unwrapEnvelope(response)];
	}

	if (operation === 'send') {
		const scheduledAt = this.getNodeParameter('scheduledAt', i, '') as string;
		const body: IDataObject = {};
		if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();

		const response = await zavuApiRequest.call(
			this,
			'POST',
			`/v1/broadcasts/${broadcastId}/send`,
			body,
		);
		return [unwrapEnvelope(response)];
	}

	if (operation === 'addContacts') {
		const source = this.getNodeParameter('contactsSource', i, 'list') as string;
		const contacts: IDataObject[] = [];

		if (source === 'input') {
			const recipientField = this.getNodeParameter('recipientField', i, 'recipient') as string;
			const variablesField = this.getNodeParameter('variablesField', i, '') as string;

			for (const item of items) {
				const recipient = item.json[recipientField];
				if (!recipient) continue;

				const contact: IDataObject = { recipient: String(recipient) };
				const variables = variablesField ? item.json[variablesField] : undefined;
				if (variables && typeof variables === 'object') {
					contact.templateVariables = variables;
				}
				contacts.push(contact);
			}

			if (contacts.length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					`No input item carried a non-empty "${recipientField}" field`,
					{ itemIndex: i },
				);
			}
		} else {
			const collection = this.getNodeParameter('contacts', i, {}) as IDataObject;
			for (const entry of (collection.contact as IDataObject[]) ?? []) {
				const contact: IDataObject = { recipient: entry.recipient as string };
				const variables = keyValueToRecord(entry.templateVariables as IDataObject);
				if (variables) contact.templateVariables = variables;
				contacts.push(contact);
			}
		}

		// The endpoint caps a request at 1000 recipients. Chunking here means a
		// 5000-row spreadsheet works instead of failing at row 1001.
		const results: IDataObject[] = [];
		for (let start = 0; start < contacts.length; start += 1000) {
			const chunk = contacts.slice(start, start + 1000);
			const response = (await zavuApiRequest.call(
				this,
				'POST',
				`/v1/broadcasts/${broadcastId}/contacts`,
				{ contacts: chunk },
			)) as IDataObject;
			results.push(response);
		}

		// One summary row rather than one per chunk: the caller asked to add a
		// list, not to know how it was split up.
		const summary = results.reduce<IDataObject>(
			(acc, result) => ({
				added: ((acc.added as number) ?? 0) + ((result.added as number) ?? 0),
				duplicates: ((acc.duplicates as number) ?? 0) + ((result.duplicates as number) ?? 0),
				invalid: ((acc.invalid as number) ?? 0) + ((result.invalid as number) ?? 0),
				errors: [
					...((acc.errors as IDataObject[]) ?? []),
					...((result.errors as IDataObject[]) ?? []),
				],
			}),
			{},
		);

		return [{ broadcastId, ...summary }];
	}

	throw new NodeOperationError(this.getNode(), `Unknown broadcast operation "${operation}"`, {
		itemIndex: i,
	});
}

// ----------------------------------------------------------------- sender ---

async function executeSender(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'getMany') {
		return zavuApiRequestList.call(this, i, '/v1/senders');
	}

	if (operation === 'create') {
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body: IDataObject = {
			name: this.getNodeParameter('name', i) as string,
			...additionalFields,
		};
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/senders', body))];
	}

	const senderId = this.getNodeParameter('senderId', i) as string;

	if (operation === 'get') {
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'GET', `/v1/senders/${senderId}`))];
	}

	if (operation === 'update') {
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		return [
			unwrapEnvelope(
				await zavuApiRequest.call(this, 'PATCH', `/v1/senders/${senderId}`, updateFields),
			),
		];
	}

	if (operation === 'delete') {
		await zavuApiRequest.call(this, 'DELETE', `/v1/senders/${senderId}`);
		return [{ deleted: true, id: senderId }];
	}

	throw new NodeOperationError(this.getNode(), `Unknown sender operation "${operation}"`, {
		itemIndex: i,
	});
}

// ------------------------------------------------------------------ agent ---

async function executeAgent(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'getMany') {
		return zavuApiRequestList.call(this, i, '/v1/agents');
	}

	if (operation === 'create') {
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body: IDataObject = {
			name: this.getNodeParameter('name', i) as string,
			provider: this.getNodeParameter('provider', i) as string,
			model: this.getNodeParameter('model', i) as string,
			systemPrompt: this.getNodeParameter('systemPrompt', i) as string,
			...additionalFields,
		};

		if (typeof body.triggerOnChannels === 'string') {
			body.triggerOnChannels = (body.triggerOnChannels as string)
				.split(',')
				.map((channel) => channel.trim())
				.filter(Boolean);
		}

		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/agents', body))];
	}

	const agentId = this.getNodeParameter('agentId', i) as string;

	if (operation === 'get') {
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'GET', `/v1/agents/${agentId}`))];
	}

	if (operation === 'update') {
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		return [
			unwrapEnvelope(
				await zavuApiRequest.call(this, 'PATCH', `/v1/agents/${agentId}`, updateFields),
			),
		];
	}

	if (operation === 'delete') {
		await zavuApiRequest.call(this, 'DELETE', `/v1/agents/${agentId}`);
		return [{ deleted: true, id: agentId }];
	}

	if (operation === 'test') {
		const body: IDataObject = {
			message: this.getNodeParameter('message', i) as string,
			useKnowledgeBase: this.getNodeParameter('useKnowledgeBase', i, true) as boolean,
		};
		const response = await zavuApiRequest.call(this, 'POST', `/v1/agents/${agentId}/test`, body);
		return [response as IDataObject];
	}

	if (operation === 'attachSender') {
		const body = { senderId: this.getNodeParameter('senderId', i) as string };
		const response = await zavuApiRequest.call(this, 'POST', `/v1/agents/${agentId}/senders`, body);
		return [unwrapEnvelope(response)];
	}

	if (operation === 'detachSender') {
		const senderId = this.getNodeParameter('senderId', i) as string;
		await zavuApiRequest.call(this, 'DELETE', `/v1/agents/${agentId}/senders/${senderId}`);
		return [{ detached: true, agentId, senderId }];
	}

	throw new NodeOperationError(this.getNode(), `Unknown agent operation "${operation}"`, {
		itemIndex: i,
	});
}

// ------------------------------------------------------------------- call ---

async function executeCall(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'create') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const { senderId, metadata, ...rest } = options;

		const body: IDataObject = {
			to: this.getNodeParameter('to', i) as string,
			...rest,
		};
		if (senderId) body.senderId = senderId;

		const parsedMetadata = keyValueToRecord(metadata as IDataObject, 'metadata');
		if (parsedMetadata) body.metadata = parsedMetadata;

		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/calls', body))];
	}

	if (operation === 'getMany') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		return zavuApiRequestList.call(this, i, '/v1/calls', filters);
	}

	const callId = this.getNodeParameter('callId', i) as string;

	if (operation === 'get') {
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'GET', `/v1/calls/${callId}`))];
	}

	if (operation === 'hangup') {
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', `/v1/calls/${callId}/hangup`))];
	}

	throw new NodeOperationError(this.getNode(), `Unknown call operation "${operation}"`, {
		itemIndex: i,
	});
}

// ------------------------------------------------------------ phoneNumber ---

async function executePhoneNumber(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'searchAvailable') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const qs: IDataObject = {
			countryCode: this.getNodeParameter('countryCode', i) as string,
			...options,
		};

		if (Array.isArray(qs.capabilities)) {
			qs.capabilities = (qs.capabilities as string[]).join(',');
			if (!qs.capabilities) delete qs.capabilities;
		}

		const response = (await zavuApiRequest.call(
			this,
			'GET',
			'/v1/phone-numbers/available',
			undefined,
			qs,
		)) as IDataObject;

		return (response.items as IDataObject[]) ?? [];
	}

	if (operation === 'getMany') {
		return zavuApiRequestList.call(this, i, '/v1/phone-numbers');
	}

	if (operation === 'purchase') {
		const body: IDataObject = { phoneNumber: this.getNodeParameter('phoneNumber', i) as string };
		const name = this.getNodeParameter('name', i, '') as string;
		if (name) body.name = name;
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/phone-numbers', body))];
	}

	const phoneNumberId = this.getNodeParameter('phoneNumberId', i) as string;

	if (operation === 'get') {
		return [
			unwrapEnvelope(await zavuApiRequest.call(this, 'GET', `/v1/phone-numbers/${phoneNumberId}`)),
		];
	}

	if (operation === 'update') {
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		return [
			unwrapEnvelope(
				await zavuApiRequest.call(
					this,
					'PATCH',
					`/v1/phone-numbers/${phoneNumberId}`,
					updateFields,
				),
			),
		];
	}

	if (operation === 'release') {
		await zavuApiRequest.call(this, 'DELETE', `/v1/phone-numbers/${phoneNumberId}`);
		return [{ released: true, id: phoneNumberId }];
	}

	throw new NodeOperationError(this.getNode(), `Unknown phone number operation "${operation}"`, {
		itemIndex: i,
	});
}

// ---------------------------------------------------------------- utility ---

async function executeUtility(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (operation === 'validatePhone') {
		const body = { phoneNumber: this.getNodeParameter('phoneNumber', i) as string };
		return [(await zavuApiRequest.call(this, 'POST', '/v1/introspect/phone', body)) as IDataObject];
	}

	if (operation === 'validateEmail') {
		const raw = this.getNodeParameter('emails', i) as string;
		const emails = raw
			.split(',')
			.map((email) => email.trim())
			.filter(Boolean);

		const body: IDataObject = emails.length === 1 ? { email: emails[0] } : { emails };
		const response = (await zavuApiRequest.call(
			this,
			'POST',
			'/v1/introspect/email',
			body,
		)) as IDataObject;

		// One item per address: a downstream IF node filtering on `verdict` is the
		// point of calling this at all.
		return (response.results as IDataObject[]) ?? [response];
	}

	if (operation === 'submitUrl') {
		const body = { url: this.getNodeParameter('url', i) as string };
		return [unwrapEnvelope(await zavuApiRequest.call(this, 'POST', '/v1/urls', body))];
	}

	if (operation === 'getBalance') {
		return [(await zavuApiRequest.call(this, 'GET', '/v1/balance')) as IDataObject];
	}

	if (operation === 'getMe') {
		return [(await zavuApiRequest.call(this, 'GET', '/v1/me')) as IDataObject];
	}

	throw new NodeOperationError(this.getNode(), `Unknown utility operation "${operation}"`, {
		itemIndex: i,
	});
}

// ----------------------------------------------------------------- custom ---

async function executeCustom(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const method = this.getNodeParameter('method', i) as IHttpRequestMethods;
	const endpointRaw = (this.getNodeParameter('endpoint', i) as string).trim();
	const endpoint = endpointRaw.startsWith('/') ? endpointRaw : `/${endpointRaw}`;
	const options = this.getNodeParameter('options', i, {}) as IDataObject;

	const qs: IDataObject = {};
	const queryParameters = this.getNodeParameter('queryParameters', i, {}) as IDataObject;
	for (const parameter of (queryParameters.parameter as IDataObject[]) ?? []) {
		if (parameter.name) qs[parameter.name as string] = parameter.value;
	}

	let body: IDataObject | undefined;
	if (['POST', 'PATCH', 'PUT'].includes(method)) {
		const raw = this.getNodeParameter('body', i, '{}') as string | IDataObject;
		if (typeof raw === 'string') {
			try {
				body = JSON.parse(raw || '{}') as IDataObject;
			} catch {
				throw new NodeOperationError(this.getNode(), 'Body is not valid JSON', { itemIndex: i });
			}
		} else {
			body = raw;
		}
	}

	const response = await zavuApiRequest.call(
		this,
		method,
		endpoint,
		body,
		qs,
		senderHeader(options.senderId as string),
	);

	const splitItems = options.splitItems !== false;
	if (splitItems && response && Array.isArray((response as IDataObject).items)) {
		return (response as IDataObject).items as IDataObject[];
	}

	if (response === undefined || response === null || response === '') {
		return [{ success: true }];
	}

	return [response as IDataObject];
}
