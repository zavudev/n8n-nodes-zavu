import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getSenders, zavuApiRequest } from '../Zavu/GenericFunctions';
import { WEBHOOK_EVENT_OPTIONS } from '../Zavu/descriptions/SenderDescription';
import { verifyZavuSignature } from './signature';

interface ZavuTriggerStaticData {
	webhookUrl?: string;
	/** Present only when Zavu minted the secret during registration. */
	webhookSecret?: string;
	/** True when this node pointed an already-configured sender at n8n. */
	tookOverExistingWebhook?: boolean;
	previousWebhookUrl?: string;
	previousWebhookEvents?: string[];
	previousWebhookActive?: boolean;
}

export class ZavuTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zavu Trigger',
		name: 'zavuTrigger',
		icon: { light: 'file:zavu.svg', dark: 'file:zavu.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description:
			'Starts a workflow on inbound messages, delivery updates, calls and other Zavu events',
		defaults: { name: 'Zavu Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'zavuApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Sender Name or ID',
				name: 'senderId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getSenders' },
				required: true,
				default: '',
				description:
					'Webhooks are configured per sender. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['message.inbound'],
				options: WEBHOOK_EVENT_OPTIONS,
				description: 'Events this workflow reacts to',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Register Webhook Automatically',
						name: 'registerAutomatically',
						type: 'boolean',
						default: true,
						description:
							'Whether to point the sender at this workflow when it is activated, and unset it when deactivated. Turn this off to configure the webhook yourself in the Zavu dashboard.',
					},
					{
						displayName: 'Replace Existing Webhook',
						name: 'takeOverExistingWebhook',
						type: 'boolean',
						default: false,
						description:
							'Whether to repoint a sender that already sends its webhooks somewhere else. A sender has exactly one webhook URL, so turning this on stops the current receiver from getting anything. Off by default, and activation fails with the URL currently configured so you can decide.',
					},
					{
						displayName: 'Signature Tolerance (Seconds)',
						name: 'toleranceSeconds',
						type: 'number',
						default: 300,
						description: 'Reject deliveries older than this. Set 0 to skip the freshness check.',
					},
					{
						displayName: 'Verify Signature',
						name: 'verifySignature',
						type: 'boolean',
						default: true,
						description:
							'Whether to reject deliveries whose X-Zavu-Signature does not match. Needs the webhook secret: Zavu returns it during registration only when the sender had none, so paste it below for a sender that already had a webhook.',
					},
					{
						displayName: 'Webhook Secret',
						name: 'webhookSecret',
						type: 'string',
						typeOptions: { password: true },
						default: '',
						placeholder: 'whsec_...',
						description:
							'Overrides the secret captured at registration. Find it by regenerating the sender webhook secret in the dashboard — note that regenerating invalidates the old one immediately.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: { getSenders },
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const options = this.getNodeParameter('options', {}) as IDataObject;
				if (options.registerAutomatically === false) return true;

				const senderId = this.getNodeParameter('senderId') as string;
				const events = this.getNodeParameter('events') as string[];
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				const sender = (await zavuApiRequest.call(
					this,
					'GET',
					`/v1/senders/${senderId}`,
				)) as IDataObject;

				const webhook = sender.webhook as IDataObject | undefined;
				if (!webhook || webhook.url !== webhookUrl) return false;

				// Same URL but a narrower subscription would silently drop events the
				// workflow is waiting for, so re-register instead of reporting a match.
				const registered = (webhook.events as string[]) ?? [];
				return events.every((event) => registered.includes(event));
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const options = this.getNodeParameter('options', {}) as IDataObject;
				if (options.registerAutomatically === false) return true;

				const senderId = this.getNodeParameter('senderId') as string;
				const events = this.getNodeParameter('events') as string[];
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				// Zavu refuses any webhook URL that is not HTTPS on a public hostname.
				// A local n8n hands out http://localhost:5678/..., so without this the
				// user gets a 400 about a URL they never typed.
				if (!webhookUrl?.startsWith('https://')) {
					throw new NodeOperationError(
						this.getNode(),
						`Zavu only delivers webhooks to https:// URLs, and this n8n instance is handing out "${webhookUrl}"`,
						{
							description:
								'Expose n8n over HTTPS (a tunnel such as ngrok, or WEBHOOK_URL set to your public address) and activate the workflow again. Alternatively turn off "Register Webhook Automatically" and forward deliveries to this URL yourself.',
						},
					);
				}

				const sender = (await zavuApiRequest.call(
					this,
					'GET',
					`/v1/senders/${senderId}`,
				)) as IDataObject;

				const existing = sender.webhook as IDataObject | undefined;
				const existingUrl = existing?.url as string | undefined;
				const takeOver = options.takeOverExistingWebhook === true;

				// One sender, one webhook URL. Repointing it silently is how somebody's
				// production receiver stops getting events with nothing to show for it.
				if (existingUrl && existingUrl !== webhookUrl && !takeOver) {
					throw new NodeOperationError(
						this.getNode(),
						`Sender "${sender.name as string}" already sends its webhooks to ${existingUrl}`,
						{
							description:
								'A Zavu sender has exactly one webhook URL, so activating this trigger would stop that receiver from getting anything. Turn on "Replace Existing Webhook" to repoint it here, use a different sender, or fan the events out from your existing receiver.',
						},
					);
				}

				const response = (await zavuApiRequest.call(this, 'PATCH', `/v1/senders/${senderId}`, {
					webhookUrl,
					webhookEvents: events,
					webhookActive: true,
				})) as IDataObject;

				const staticData = this.getWorkflowStaticData('node') as unknown as ZavuTriggerStaticData;
				staticData.webhookUrl = webhookUrl;
				staticData.tookOverExistingWebhook = Boolean(existingUrl && existingUrl !== webhookUrl);
				staticData.previousWebhookUrl = existingUrl;
				staticData.previousWebhookEvents = (existing?.events as string[]) ?? [];
				staticData.previousWebhookActive = existing?.active as boolean | undefined;

				// The secret comes back only when the sender had none. For a sender that
				// already had a webhook, Zavu keeps the existing secret and does not
				// re-reveal it — the node cannot verify signatures unless the user pastes
				// it into the Webhook Secret option.
				const secret = (response.webhook as IDataObject | undefined)?.secret as string | undefined;
				if (secret) staticData.webhookSecret = secret;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const options = this.getNodeParameter('options', {}) as IDataObject;
				if (options.registerAutomatically === false) return true;

				const senderId = this.getNodeParameter('senderId') as string;
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const staticData = this.getWorkflowStaticData('node') as unknown as ZavuTriggerStaticData;

				try {
					const sender = (await zavuApiRequest.call(
						this,
						'GET',
						`/v1/senders/${senderId}`,
					)) as IDataObject;

					const currentUrl = (sender.webhook as IDataObject | undefined)?.url as string | undefined;

					// Only tear down what this node put there. Someone may have repointed
					// the sender in the dashboard since activation, and clearing that would
					// destroy a webhook config (and its secret) we do not own.
					if (currentUrl === webhookUrl) {
						if (staticData.tookOverExistingWebhook && staticData.previousWebhookUrl) {
							// Put back what we displaced. Zavu keeps the original secret, so
							// the previous receiver keeps verifying with the key it has.
							await zavuApiRequest.call(this, 'PATCH', `/v1/senders/${senderId}`, {
								webhookUrl: staticData.previousWebhookUrl,
								webhookEvents: staticData.previousWebhookEvents ?? [],
								// Restore the paused/active state too: this node sets active on
								// registration, and handing back a webhook somebody had
								// deliberately paused would start delivering again.
								webhookActive: staticData.previousWebhookActive ?? true,
							});
						} else {
							await zavuApiRequest.call(this, 'PATCH', `/v1/senders/${senderId}`, {
								webhookUrl: null,
							});
						}
					}
				} catch {
					// A sender deleted out from under the workflow must not block
					// deactivation.
					return true;
				}

				delete staticData.webhookUrl;
				delete staticData.webhookSecret;
				delete staticData.tookOverExistingWebhook;
				delete staticData.previousWebhookUrl;
				delete staticData.previousWebhookEvents;
				delete staticData.previousWebhookActive;

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const headers = this.getHeaderData() as IDataObject;
		const body = this.getBodyData() as IDataObject;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const events = this.getNodeParameter('events', []) as string[];

		const staticData = this.getWorkflowStaticData('node') as unknown as ZavuTriggerStaticData;
		const secret = ((options.webhookSecret as string) || staticData.webhookSecret || '').trim();
		const verify = options.verifySignature !== false;

		// Verification that quietly does nothing is worse than no verification: the
		// node would report "Verify Signature: true" while accepting anything.
		if (verify && !secret) {
			throw new NodeOperationError(
				this.getNode(),
				'Signature verification is on but this node has no webhook secret',
				{
					description:
						'Zavu returns the secret only when it mints one, which it does not for a sender that already had a webhook. Paste the sender webhook secret into the "Webhook Secret" option, or turn "Verify Signature" off to accept unverified deliveries.',
				},
			);
		}

		if (verify && secret) {
			// Zavu signs the exact bytes it sent. Prefer the raw body; fall back to
			// re-serializing, which matches because Zavu emits compact
			// JSON.stringify output and JSON.parse preserves key order.
			const rawBody =
				(request as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ??
				JSON.stringify(body);

			const header = (headers['x-zavu-signature'] as string) ?? '';
			const check = verifyZavuSignature(
				secret,
				rawBody,
				header,
				(options.toleranceSeconds as number) ?? 300,
			);

			if (!check.ok) {
				throw new NodeOperationError(this.getNode(), `Rejected a Zavu webhook: ${check.reason}`, {
					description:
						'The delivery did not match the configured webhook secret. If this sender already had a webhook when the trigger was activated, Zavu never revealed its secret — paste it into the "Webhook Secret" option, or turn "Verify Signature" off.',
				});
			}
		}

		// Zavu delivers every event the sender is subscribed to, to the one URL it
		// has. A workflow that asked for message.inbound should not fire on a
		// delivery receipt that another workflow subscribed the sender to.
		const eventType = (body.type as string) ?? (headers['x-zavu-event'] as string);
		if (events.length > 0 && eventType && !events.includes(eventType)) {
			// No workflowData: Zavu still gets its 200, so the delivery is not retried
			// against a workflow that was never meant to see it.
			return {};
		}

		return {
			workflowData: [this.helpers.returnJsonArray([body])],
		};
	}
}
