import type { INodeProperties } from 'n8n-workflow';
import { CHANNEL_OPTIONS, metadataField, returnAllFields, senderIdField } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['message'], operation: operations },
});

/** Media types: everything carried by a URL plus an optional caption. */
const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

/**
 * Types whose entire payload is the body text. WhatsApp fixes the button label,
 * so these take no content object at all — sending one is a 400.
 */
const BODY_ONLY_TYPES = ['location_request', 'request_contact_info'];

/** Types where `text` is the message body or the media caption. */
const TEXT_CAPABLE_TYPES = [
	'text',
	...MEDIA_TYPES,
	'buttons',
	'list',
	'cta_url',
	...BODY_ONLY_TYPES,
];

export const messageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a message by ID, including its delivery status and cost',
				action: 'Get a message',
			},
			{
				name: 'Get Attachments',
				value: 'getAttachments',
				description: "List an email message's files with short-lived download URLs",
				action: 'Get message attachments',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List messages sent and received by this project',
				action: 'Get many messages',
			},
			{
				name: 'React',
				value: 'react',
				description: 'Send an emoji reaction to a WhatsApp message',
				action: 'React to a message',
			},
			{
				name: 'Send',
				value: 'send',
				description: 'Send a message on any channel',
				action: 'Send a message',
			},
			{
				name: 'Show Typing Indicator',
				value: 'typing',
				description:
					'Mark an inbound WhatsApp message as read and show a typing indicator while you prepare a reply',
				action: 'Show a typing indicator',
			},
		],
		default: 'send',
	},
];

export const messageFields: INodeProperties[] = [
	// ---------------------------------------------------------------- send ---
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+14155551234',
		description:
			'Phone number in E.164 format, email address, numeric chat ID (Telegram/Instagram/Messenger), or WhatsApp business-scoped user ID (BSUID)',
		displayOptions: showFor(['send']),
	},
	{
		displayName: 'Channel',
		name: 'channel',
		type: 'options',
		options: CHANNEL_OPTIONS,
		default: 'auto',
		description:
			'Delivery channel. "Auto" picks from the sender\'s capabilities and the recipient. Any non-text message type is delivered over WhatsApp regardless.',
		displayOptions: showFor(['send']),
	},
	{
		displayName: 'Message Type',
		name: 'messageType',
		type: 'options',
		default: 'text',
		options: [
			{ name: 'Audio', value: 'audio' },
			{ name: 'Buttons', value: 'buttons', description: 'Up to 3 reply buttons (WhatsApp)' },
			{ name: 'Contact Card', value: 'contact' },
			{
				name: 'Contact Info Request',
				value: 'request_contact_info',
				description: 'Ask the recipient to share their phone number (WhatsApp)',
			},
			{ name: 'CTA URL Button', value: 'cta_url', description: 'Link button (WhatsApp)' },
			{ name: 'Document', value: 'document' },
			{ name: 'Image', value: 'image' },
			{ name: 'List', value: 'list', description: 'Single-select list (WhatsApp)' },
			{ name: 'Location', value: 'location' },
			{
				name: 'Location Request',
				value: 'location_request',
				description: 'Ask the recipient to share their location (WhatsApp)',
			},
			{ name: 'Sticker', value: 'sticker' },
			{ name: 'Template', value: 'template', description: 'Send an approved template' },
			{ name: 'Text', value: 'text' },
			{ name: 'Video', value: 'video' },
		],
		displayOptions: showFor(['send']),
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description:
			'Message body, or the caption for a media message. Capped at 4096 characters on every channel except email.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: TEXT_CAPABLE_TYPES },
		},
	},

	// Email
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		default: '',
		description: 'Required when the channel is email or the recipient is an email address',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], channel: ['email'] },
		},
	},
	{
		displayName: 'HTML Body',
		name: 'htmlBody',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		description: 'HTML body. When set, the email is sent as multipart with both text and HTML.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], channel: ['email'] },
		},
	},

	// Media
	{
		displayName: 'Media URL',
		name: 'mediaUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/photo.jpg',
		description: 'Publicly reachable HTTPS URL of the file to send',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: MEDIA_TYPES },
		},
	},
	{
		displayName: 'Filename',
		name: 'filename',
		type: 'string',
		default: '',
		description: 'Name shown to the recipient for a document',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['document'] },
		},
	},

	// Location
	{
		displayName: 'Latitude',
		name: 'latitude',
		type: 'number',
		default: 0,
		typeOptions: { numberPrecision: 7 },
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
		},
	},
	{
		displayName: 'Longitude',
		name: 'longitude',
		type: 'number',
		default: 0,
		typeOptions: { numberPrecision: 7 },
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
		},
	},
	{
		displayName: 'Location Name',
		name: 'locationName',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
		},
	},
	{
		displayName: 'Location Address',
		name: 'locationAddress',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
		},
	},

	// Contact card
	{
		displayName: 'Contacts',
		name: 'contacts',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Contact',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['contact'] },
		},
		options: [
			{
				name: 'contact',
				displayName: 'Contact',
				values: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{
						displayName: 'Phones',
						name: 'phones',
						type: 'string',
						default: '',
						description: 'Comma-separated phone numbers',
					},
				],
			},
		],
	},

	// Buttons
	{
		displayName: 'Buttons',
		name: 'buttons',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, maxValue: 3 },
		default: {},
		placeholder: 'Add Button',
		description:
			'Up to 3 reply buttons. The tapped button comes back as an inbound message carrying its ID.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['buttons'] },
		},
		options: [
			{
				name: 'button',
				displayName: 'Button',
				values: [
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'Returned to you when the button is tapped',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Label shown on the button (max 20 characters)',
					},
				],
			},
		],
	},

	// List
	{
		displayName: 'List Button Label',
		name: 'listButton',
		type: 'string',
		default: '',
		description: 'Text on the button that opens the list (max 20 characters)',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['list'] },
		},
	},
	{
		displayName: 'Sections',
		name: 'sections',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Section',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['list'] },
		},
		options: [
			{
				name: 'section',
				displayName: 'Section',
				values: [
					{ displayName: 'Title', name: 'title', type: 'string', default: '' },
					{
						displayName: 'Rows',
						name: 'rows',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						default: {},
						placeholder: 'Add Row',
						options: [
							{
								name: 'row',
								displayName: 'Row',
								values: [
									{ displayName: 'ID', name: 'id', type: 'string', default: '' },
									{
										displayName: 'Title',
										name: 'title',
										type: 'string',
										default: '',
										description: 'Max 24 characters',
									},
									{
										displayName: 'Description',
										name: 'description',
										type: 'string',
										default: '',
										description: 'Max 72 characters',
									},
								],
							},
						],
					},
				],
			},
		],
	},

	// CTA URL
	{
		displayName: 'Button Label',
		name: 'ctaDisplayText',
		type: 'string',
		default: '',
		description: 'Label on the link button (max 20 characters)',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['cta_url'] },
		},
	},
	{
		displayName: 'Button URL',
		name: 'ctaUrl',
		type: 'string',
		default: '',
		placeholder: 'https://example.com/schedule',
		description: 'Opened in the device browser when the button is tapped. WhatsApp requires HTTPS.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['cta_url'] },
		},
	},

	// Reactions are their own operation ("React"), which takes the message ID in
	// the path — so `reaction` is deliberately not offered as a send type here.

	// Template
	{
		displayName: 'Template Name or ID',
		name: 'templateId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTemplates' },
		default: '',
		required: true,
		description:
			'Approved template to send. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
		},
	},
	{
		displayName: 'Template Variables',
		name: 'templateVariables',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Variable',
		description:
			'Key them to match the template body: by position (1, 2, …) for positional templates, or by name (customer_name) for named ones. Do not mix the two in one message.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
		},
		options: [
			{
				name: 'variable',
				displayName: 'Variable',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						placeholder: '1',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
	},

	{
		displayName:
			'This message type is WhatsApp-only and carries no extra content — the prompt is the Text field and WhatsApp fixes the button label.',
		name: 'bodyOnlyNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: BODY_ONLY_TYPES },
		},
	},

	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['send']),
		options: [
			senderIdField,
			{
				displayName: 'CTA Footer Text',
				name: 'footerText',
				type: 'string',
				default: '',
				description: 'Small print under a CTA URL message (max 60 characters)',
			},
			{
				displayName: 'CTA Header Media URL',
				name: 'ctaHeaderMediaUrl',
				type: 'string',
				default: '',
				description:
					'Public HTTPS URL of the header image/video/document for a CTA URL message. WhatsApp fetches it directly.',
			},
			{
				displayName: 'CTA Header Text',
				name: 'ctaHeaderText',
				type: 'string',
				default: '',
				description: 'Header line for a CTA URL message (max 60 characters)',
			},
			{
				displayName: 'CTA Header Type',
				name: 'ctaHeaderType',
				type: 'options',
				default: 'text',
				options: [
					{ name: 'Text', value: 'text' },
					{ name: 'Image', value: 'image' },
					{ name: 'Video', value: 'video' },
					{ name: 'Document', value: 'document' },
				],
			},
			{
				displayName: 'Fallback Enabled',
				name: 'fallbackEnabled',
				type: 'boolean',
				default: true,
				description: 'Whether to fall back to SMS automatically when WhatsApp fails',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'Reusing a key returns the original message with HTTP 409 instead of sending twice. Use it when a retry would otherwise duplicate a send.',
			},
			{
				displayName: 'MIME Type',
				name: 'mimeType',
				type: 'string',
				default: '',
				description: 'Overrides the type inferred from the filename',
			},
			metadataField,
			{
				displayName: 'Reply-To',
				name: 'replyTo',
				type: 'string',
				default: '',
				placeholder: 'support@example.com',
				description: 'Reply-To address for email messages',
			},
			{
				displayName: 'Template Button Variables',
				name: 'templateButtonVariables',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Button Variable',
				description:
					"Keys are the button index (0, 1, 2) in the template's buttons array, not the placeholder name",
				options: [
					{
						name: 'variable',
						displayName: 'Variable',
						values: [
							{ displayName: 'Name', name: 'name', type: 'string', default: '0' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Template Header Variables',
				name: 'templateHeaderVariables',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Header Variable',
				description: 'Text-header value, keyed by 1. WhatsApp allows at most one.',
				options: [
					{
						name: 'variable',
						displayName: 'Variable',
						values: [
							{ displayName: 'Name', name: 'name', type: 'string', default: '1' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Voice Language',
				name: 'voiceLanguage',
				type: 'string',
				default: '',
				placeholder: 'es-ES',
				description:
					"Language for voice text-to-speech. Detected from the recipient's country code when empty.",
			},
		],
	},

	// ----------------------------------------------------------------- get ---
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'getAttachments', 'react', 'typing']),
	},
	{
		displayName: 'Emoji',
		name: 'emoji',
		type: 'string',
		required: true,
		default: '',
		placeholder: '👍',
		description: 'Single emoji to react with. WhatsApp only.',
		displayOptions: showFor(['react']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['react', 'typing']),
		options: [senderIdField],
	},

	// ------------------------------------------------------------- getMany ---
	...returnAllFields('message', ['getMany']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getMany']),
		options: [
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'options',
				default: 'sms',
				options: CHANNEL_OPTIONS.filter((option) => option.value !== 'auto'),
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'delivered',
				options: [
					{ name: 'Delivered', value: 'delivered' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Queued', value: 'queued' },
					{ name: 'Received', value: 'received' },
					{ name: 'Sending', value: 'sending' },
					{ name: 'Sent', value: 'sent' },
				],
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				default: '',
				description: 'Filter by recipient',
			},
		],
	},
];
