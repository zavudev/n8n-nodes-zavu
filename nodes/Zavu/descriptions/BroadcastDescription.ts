import type { INodeProperties } from 'n8n-workflow';
import { returnAllFields, senderIdField } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['broadcast'], operation: operations },
});

export const broadcastOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['broadcast'] } },
		options: [
			{
				name: 'Add Contacts',
				value: 'addContacts',
				description: 'Add recipients to a draft broadcast (max 1000 per call)',
				action: 'Add contacts to a broadcast',
			},
			{
				name: 'Cancel',
				value: 'cancel',
				description: 'Skip pending recipients. Already queued messages may still be delivered.',
				action: 'Cancel a broadcast',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a broadcast in draft. Add contacts, then send.',
				action: 'Create a broadcast',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a draft',
				action: 'Delete a broadcast',
			},
			{ name: 'Get', value: 'get', action: 'Get a broadcast' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many broadcasts' },
			{
				name: 'Get Progress',
				value: 'progress',
				description: 'Delivery counts and estimated completion',
				action: 'Get broadcast progress',
			},
			{
				name: 'Send',
				value: 'send',
				description: 'Submit for review and start sending, or schedule for later',
				action: 'Send a broadcast',
			},
		],
		default: 'create',
	},
];

export const broadcastFields: INodeProperties[] = [
	{
		displayName:
			'Sending a broadcast needs both identity (KYC) and business (KYB) verification on the team, except on WhatsApp, where Meta\'s template approval covers both. It also passes through content review: a WhatsApp broadcast built on a Meta-approved template skips review; other channels wait for it. Drafts need nothing.',
		name: 'broadcastVerificationNotice',
		type: 'notice',
		default: '',
		displayOptions: showFor(['send']),
	},

	// -------------------------------------------------------------- create ---
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Black Friday Sale',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Channel',
		name: 'channel',
		type: 'options',
		required: true,
		default: 'smart',
		options: [
			{ name: 'Email', value: 'email' },
			{
				name: 'Smart',
				value: 'smart',
				description: 'Route each recipient individually',
			},
			{ name: 'SMS', value: 'sms' },
			{ name: 'SMS (One-Way)', value: 'sms_oneway' },
			{ name: 'Telegram', value: 'telegram' },
			{ name: 'WhatsApp', value: 'whatsapp' },
		],
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Message Type',
		name: 'messageType',
		type: 'options',
		default: 'text',
		options: [
			{ name: 'Audio', value: 'audio' },
			{ name: 'Document', value: 'document' },
			{ name: 'Image', value: 'image' },
			{ name: 'Template', value: 'template' },
			{ name: 'Text', value: 'text' },
			{ name: 'Video', value: 'video' },
		],
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Supports per-contact variables, e.g. {{name}} or {{1}}',
		displayOptions: {
			show: {
				resource: ['broadcast'],
				operation: ['create'],
				messageType: ['text', 'image', 'video', 'audio', 'document'],
			},
		},
	},
	{
		displayName: 'Media URL',
		name: 'mediaUrl',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['broadcast'],
				operation: ['create'],
				messageType: ['image', 'video', 'audio', 'document'],
			},
		},
	},
	{
		displayName: 'Template Name or ID',
		name: 'templateId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTemplates' },
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: {
			show: { resource: ['broadcast'], operation: ['create'], messageType: ['template'] },
		},
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
				displayName: 'Email HTML Body',
				name: 'emailHtmlBody',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
			},
			{
				displayName: 'Email Subject',
				name: 'emailSubject',
				type: 'string',
				default: '',
				description: 'Required for email broadcasts',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'Reusing a key returns the original broadcast instead of creating a second one',
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description: 'Schedule delivery for a future time',
			},
			senderIdField,
		],
	},

	// ----------------------------------------------------------- by-ID ops ---
	{
		displayName: 'Broadcast ID',
		name: 'broadcastId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'delete', 'addContacts', 'send', 'cancel', 'progress']),
	},

	// --------------------------------------------------------- addContacts ---
	{
		displayName: 'Contacts Source',
		name: 'contactsSource',
		type: 'options',
		default: 'list',
		options: [
			{
				name: 'From Field',
				value: 'list',
				description: 'Build the list in this node',
			},
			{
				name: 'From Input Items',
				value: 'input',
				description:
					'One recipient per incoming item — the natural shape when a spreadsheet or database feeds this node',
			},
		],
		displayOptions: showFor(['addContacts']),
	},
	{
		displayName: 'Contacts',
		name: 'contacts',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Contact',
		displayOptions: {
			show: { resource: ['broadcast'], operation: ['addContacts'], contactsSource: ['list'] },
		},
		options: [
			{
				name: 'contact',
				displayName: 'Contact',
				values: [
					{
						displayName: 'Recipient',
						name: 'recipient',
						type: 'string',
						default: '',
						placeholder: '+14155551234',
						description: 'Phone number in E.164 format or an email address',
					},
					{
						displayName: 'Template Variables',
						name: 'templateVariables',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						default: {},
						placeholder: 'Add Variable',
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
				],
			},
		],
	},
	{
		displayName: 'Recipient Field',
		name: 'recipientField',
		type: 'string',
		default: 'recipient',
		description: 'Name of the field on each incoming item holding the phone number or email',
		displayOptions: {
			show: { resource: ['broadcast'], operation: ['addContacts'], contactsSource: ['input'] },
		},
	},
	{
		displayName: 'Variables Field',
		name: 'variablesField',
		type: 'string',
		default: 'templateVariables',
		description:
			'Optional field on each incoming item holding an object of template variables. Ignored when absent.',
		displayOptions: {
			show: { resource: ['broadcast'], operation: ['addContacts'], contactsSource: ['input'] },
		},
	},

	// ---------------------------------------------------------------- send ---
	{
		displayName: 'Scheduled At',
		name: 'scheduledAt',
		type: 'dateTime',
		default: '',
		description: 'Leave empty to send as soon as review clears',
		displayOptions: showFor(['send']),
	},

	// ------------------------------------------------------------- getMany ---
	...returnAllFields('broadcast', ['getMany']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getMany']),
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'sending',
				options: [
					{ name: 'Approved', value: 'approved' },
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Draft', value: 'draft' },
					{ name: 'Escalated', value: 'escalated' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Paused', value: 'paused' },
					{ name: 'Pending Review', value: 'pending_review' },
					{ name: 'Rejected', value: 'rejected' },
					{ name: 'Rejected Final', value: 'rejected_final' },
					{ name: 'Scheduled', value: 'scheduled' },
					{ name: 'Sending', value: 'sending' },
				],
			},
		],
	},
];
