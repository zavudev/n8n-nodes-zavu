import type { INodeProperties } from 'n8n-workflow';
import { returnAllFields } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['sender'], operation: operations },
});

/**
 * Kept in sync with convex/lib/webhookEvents.ts, which is the one list the
 * backend validates against. An event offered here that the API rejects would be
 * a 400 with no way for the user to know why.
 */
export const WEBHOOK_EVENT_OPTIONS = [
	{ name: 'Broadcast: Status Changed', value: 'broadcast.status_changed' },
	{ name: 'Call: Answered', value: 'call.answered' },
	{ name: 'Call: Completed', value: 'call.completed' },
	{ name: 'Call: Failed', value: 'call.failed' },
	{ name: 'Call: Started', value: 'call.initiated' },
	{ name: 'Conversation: New', value: 'conversation.new' },
	{ name: 'Domain: Verification Failed', value: 'domain.failed' },
	{ name: 'Domain: Verified', value: 'domain.verified' },
	{ name: 'Invitation: Status Changed', value: 'invitation.status_changed' },
	{ name: 'Message: Delivered', value: 'message.delivered' },
	{ name: 'Message: Failed', value: 'message.failed' },
	{ name: 'Message: Inbound', value: 'message.inbound' },
	{ name: 'Message: Queued', value: 'message.queued' },
	{ name: 'Message: Read', value: 'message.read' },
	{ name: 'Message: Sent', value: 'message.sent' },
	{ name: 'Message: Unsupported Type', value: 'message.unsupported' },
	{ name: 'Template: Status Changed', value: 'template.status_changed' },
];

export const senderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['sender'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description:
					'Create a sender from a number you already own, an email address, or one-way SMS',
				action: 'Create a sender',
			},
			{ name: 'Delete', value: 'delete', action: 'Delete a sender' },
			{ name: 'Get', value: 'get', action: 'Get a sender' },
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List senders and the channels each one can actually send on',
				action: 'Get many senders',
			},
			{ name: 'Update', value: 'update', action: 'Update a sender' },
		],
		default: 'getMany',
	},
];

export const senderFields: INodeProperties[] = [
	{
		displayName: 'Sender ID',
		name: 'senderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'update', 'delete']),
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['create']),
	},
	{
		displayName:
			'A phone number alone enables nothing. Pass a number this project already owns to turn SMS on, or switch One-Way SMS on for a sender that can send with no setup at all. Check the "channels" field on the result.',
		name: 'senderChannelsNotice',
		type: 'notice',
		default: '',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['create']),
		options: [
			{
				displayName: 'Email Address',
				name: 'emailAddress',
				type: 'string',
				placeholder: 'noreply@yourdomain.com',
				default: '',
				description:
					'From-address for the email channel. Its domain must be verified in this project.',
			},
			{
				displayName: 'Email From Name',
				name: 'emailFromName',
				type: 'string',
				default: '',
				description: 'Display name shown in the recipient inbox',
			},
			{
				displayName: 'Email Receiving Enabled',
				name: 'emailReceivingEnabled',
				type: 'boolean',
				default: false,
				description:
					'Whether to receive inbound email. Requires a verified MX record on the domain.',
			},
			{
				displayName: 'Enable One-Way SMS',
				name: 'enableSmsOneway',
				type: 'boolean',
				default: false,
				description:
					'Whether to enable the one-way SMS channel. Needs no phone number and no credential; recipients cannot reply.',
			},
			{
				displayName: 'Enable Voice',
				name: 'enableVoice',
				type: 'boolean',
				default: false,
				description:
					'Whether this sender can place and answer calls. Requires a phone number provisioned for voice.',
			},
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				placeholder: '+14155551234',
				description:
					'E.164 number this project already owns (see the Phone Number resource). Routing it here is what turns SMS on.',
			},
			{
				displayName: 'Set as Default',
				name: 'setAsDefault',
				type: 'boolean',
				default: false,
				description: 'Whether this becomes the sender used when no Zavu-Sender header is given',
			},
			{
				displayName: 'Webhook Events',
				name: 'webhookEvents',
				type: 'multiOptions',
				default: [],
				options: WEBHOOK_EVENT_OPTIONS,
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/webhooks/zavu',
				description: 'Must be HTTPS with a public hostname',
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['update']),
		options: [
			{
				displayName: 'Email Catch-All Enabled',
				name: 'emailCatchAllEnabled',
				type: 'boolean',
				default: false,
				description:
					'Whether to receive mail for any address at this domain, not just the sender own address',
			},
			{
				displayName: 'Email Receiving Enabled',
				name: 'emailReceivingEnabled',
				type: 'boolean',
				default: false,
				description: 'Whether to receive inbound email on this sender',
			},
			{
				displayName: 'Enable One-Way SMS',
				name: 'enableSmsOneway',
				type: 'boolean',
				default: false,
				description: 'Whether the one-way SMS channel is on',
			},
			{
				displayName: 'Enable Voice',
				name: 'enableVoice',
				type: 'boolean',
				default: false,
				description: 'Whether the voice channel is on',
			},
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{
				displayName: 'Set as Default',
				name: 'setAsDefault',
				type: 'boolean',
				default: false,
				description: 'Whether this becomes the project default sender',
			},
			{
				displayName: 'Webhook Active',
				name: 'webhookActive',
				type: 'boolean',
				default: true,
				description: 'Whether webhook delivery is on',
			},
			{
				displayName: 'Webhook Events',
				name: 'webhookEvents',
				type: 'multiOptions',
				default: [],
				options: WEBHOOK_EVENT_OPTIONS,
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				description: 'Must be HTTPS with a public hostname',
			},
		],
	},

	...returnAllFields('sender', ['getMany']),
];
