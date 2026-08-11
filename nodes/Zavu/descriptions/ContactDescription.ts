import type { INodeProperties } from 'n8n-workflow';
import { metadataField, returnAllFields } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['contact'], operation: operations },
});

const CONTACT_CHANNELS = [
	{ name: 'SMS', value: 'sms' },
	{ name: 'WhatsApp', value: 'whatsapp' },
	{ name: 'Email', value: 'email' },
	{ name: 'Telegram', value: 'telegram' },
	{ name: 'Instagram', value: 'instagram' },
	{ name: 'Messenger', value: 'messenger' },
	{ name: 'Voice', value: 'voice' },
];

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Add Channel',
				value: 'addChannel',
				description: 'Attach another phone number or email to an existing contact',
				action: 'Add a channel to a contact',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a contact with one or more channels',
				action: 'Create a contact',
			},
			{
				name: 'Delete',
				value: 'delete',
				description:
					'Permanently delete a contact and its channels. Past message records are kept for billing and audit but stop referencing it.',
				action: 'Delete a contact',
			},
			{ name: 'Get', value: 'get', description: 'Get a contact by ID', action: 'Get a contact' },
			{
				name: 'Get by Phone',
				value: 'getByPhone',
				description: 'Get a contact by phone number in E.164 format',
				action: 'Get a contact by phone',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List contacts with their channels',
				action: 'Get many contacts',
			},
			{
				name: 'Merge',
				value: 'merge',
				description: 'Move every channel from a source contact onto this one',
				action: 'Merge two contacts',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update the preferred channel or metadata',
				action: 'Update a contact',
			},
		],
		default: 'getMany',
	},
];

export const contactFields: INodeProperties[] = [
	// -------------------------------------------------------------- create ---
	{
		displayName: 'Display Name',
		name: 'displayName',
		type: 'string',
		default: '',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Channels',
		name: 'channels',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		required: true,
		placeholder: 'Add Channel',
		description: 'A contact needs at least one channel',
		displayOptions: showFor(['create']),
		options: [
			{
				name: 'channel',
				displayName: 'Channel',
				values: [
					{
						displayName: 'Channel',
						name: 'channel',
						type: 'options',
						default: 'sms',
						options: CONTACT_CHANNELS,
					},
					{
						displayName: 'Identifier',
						name: 'identifier',
						type: 'string',
						default: '',
						placeholder: '+14155551234',
						description: 'Phone number in E.164 format or an email address',
					},
					{
						displayName: 'Label',
						name: 'label',
						type: 'string',
						default: '',
						placeholder: 'work',
					},
					{
						displayName: 'Primary',
						name: 'isPrimary',
						type: 'boolean',
						default: false,
						description: 'Whether this is the primary channel of its type',
					},
				],
			},
		],
	},

	// ----------------------------------------------------------- by-ID ops ---
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'update', 'delete', 'addChannel', 'merge']),
	},
	{
		displayName: 'Phone Number',
		name: 'phoneNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+14155551234',
		description: 'E.164 format',
		displayOptions: showFor(['getByPhone']),
	},
	{
		displayName: 'Source Contact ID',
		name: 'sourceContactId',
		type: 'string',
		required: true,
		default: '',
		description: 'The contact to merge in. It is marked as merged afterwards.',
		displayOptions: showFor(['merge']),
	},

	// ---------------------------------------------------------- addChannel ---
	{
		displayName: 'Channel',
		name: 'channel',
		type: 'options',
		default: 'sms',
		required: true,
		options: CONTACT_CHANNELS,
		displayOptions: showFor(['addChannel']),
	},
	{
		displayName: 'Identifier',
		name: 'identifier',
		type: 'string',
		required: true,
		default: '',
		description: 'Phone number in E.164 format or an email address',
		displayOptions: showFor(['addChannel']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['addChannel']),
		options: [
			{ displayName: 'Country Code', name: 'countryCode', type: 'string', default: '' },
			{ displayName: 'Label', name: 'label', type: 'string', default: '' },
			{
				displayName: 'Primary',
				name: 'isPrimary',
				type: 'boolean',
				default: false,
				description: 'Whether this becomes the primary channel of its type',
			},
		],
	},

	// -------------------------------------------------------------- update ---
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['update']),
		options: [
			{
				displayName: 'Default Channel',
				name: 'defaultChannel',
				type: 'options',
				default: 'whatsapp',
				description: 'Preferred channel for this contact',
				options: CONTACT_CHANNELS,
			},
			metadataField,
		],
	},

	// ------------------------------------------------------------- getMany ---
	...returnAllFields('contact', ['getMany']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getMany']),
		options: [
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				description: 'Filter by phone number in E.164 format',
			},
		],
	},

	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Metadata',
		displayOptions: showFor(['create']),
		options: [
			{
				name: 'metadata',
				displayName: 'Metadata',
				values: [
					{ displayName: 'Key', name: 'name', type: 'string', default: '' },
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
	},
];
