import type { INodeProperties } from 'n8n-workflow';
import { returnAllFields, senderIdField } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['template'], operation: operations },
});

const CATEGORIES = [
	{ name: 'Utility', value: 'UTILITY' },
	{ name: 'Marketing', value: 'MARKETING' },
	{ name: 'Authentication', value: 'AUTHENTICATION' },
];

export const templateOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['template'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a template as a draft. Submit it separately for Meta approval.',
				action: 'Create a template',
			},
			{ name: 'Delete', value: 'delete', action: 'Delete a template' },
			{ name: 'Get', value: 'get', action: 'Get a template' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many templates' },
			{
				name: 'Submit for Approval',
				value: 'submit',
				description:
					'Send a draft to Meta for review. The sender must have a WhatsApp Business Account connected.',
				action: 'Submit a template for approval',
			},
			{
				name: 'Sync From WhatsApp',
				value: 'sync',
				description:
					'Import templates created outside Zavu and refresh the approval status of the ones it already knows',
				action: 'Sync templates from WhatsApp',
			},
		],
		default: 'getMany',
	},
];

export const templateFields: INodeProperties[] = [
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'delete', 'submit']),
	},
	{
		displayName: 'Sender Name or ID',
		name: 'senderId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSenders' },
		default: '',
		required: true,
		description:
			'The sender whose WhatsApp Business Account the template is submitted to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: showFor(['submit']),
	},
	{
		displayName: 'Category',
		name: 'category',
		type: 'options',
		default: 'UTILITY',
		options: CATEGORIES,
		description: 'Overrides the category stored on the template',
		displayOptions: showFor(['submit']),
	},
	{
		displayName: 'Sender Name or ID',
		name: 'syncSenderId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSenders' },
		default: '',
		description:
			'Sync only this sender\'s WhatsApp Business Account. Leave empty to sync every WhatsApp sender in the project. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: showFor(['sync']),
	},

	// -------------------------------------------------------------- create ---
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'order_confirmation',
		description:
			'Lowercase with underscores. For WhatsApp this must match the name approved by Meta.',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Language',
		name: 'language',
		type: 'string',
		default: 'en',
		required: true,
		placeholder: 'en',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'Hi {{1}}, your order {{2}} has shipped.',
		description:
			'Templates created here are submitted to Meta as positional ({{1}}, {{2}}). Templates imported from a WhatsApp Business Account keep their original named or positional format.',
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
				displayName: 'Footer',
				name: 'footer',
				type: 'string',
				default: '',
				description: 'Max 60 characters',
			},
			{
				displayName: 'Header Content',
				name: 'headerContent',
				type: 'string',
				default: '',
				description: 'Header text, or a media URL when the header type is not text',
			},
			{
				displayName: 'Header Type',
				name: 'headerType',
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
				displayName: 'SMS Body',
				name: 'smsBody',
				type: 'string',
				default: '',
				description: 'Channel-specific body for SMS. Falls back to the main body when empty.',
			},
			{
				displayName: 'Telegram Body',
				name: 'telegramBody',
				type: 'string',
				default: '',
				description: 'Channel-specific body for Telegram. Falls back to the main body when empty.',
			},
			{
				displayName: 'WhatsApp Category',
				name: 'whatsappCategory',
				type: 'options',
				default: 'UTILITY',
				options: CATEGORIES,
			},
		],
	},

	...returnAllFields('template', ['getMany']),
];

/** Re-exported so the sender picker stays identical across resources. */
export const templateSenderField = senderIdField;
