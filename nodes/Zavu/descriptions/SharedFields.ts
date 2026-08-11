import type { INodeProperties } from 'n8n-workflow';

/**
 * The public channel list.
 *
 * Kept in sync with `Channel` in apps/docs/openapi.json. Zavu's internal
 * validator also accepts a QR-linked WhatsApp channel that is deliberately not
 * part of the public surface, so it is not offered here.
 */
export const CHANNEL_OPTIONS = [
	{
		name: 'Auto',
		value: 'auto',
		description: 'Let Zavu pick the channel from the sender and the recipient',
	},
	{ name: 'Email', value: 'email' },
	{ name: 'Instagram', value: 'instagram' },
	{ name: 'Messenger', value: 'messenger' },
	{ name: 'SMS', value: 'sms' },
	{
		name: 'SMS (One-Way)',
		value: 'sms_oneway',
		description: 'Needs no phone number. Recipients cannot reply.',
	},
	{ name: 'Telegram', value: 'telegram' },
	{ name: 'Voice', value: 'voice', description: 'Reads the text aloud over a phone call' },
	{ name: 'WhatsApp', value: 'whatsapp' },
];

export function returnAllFields(resource: string, operations: string[]): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show: { resource: [resource], operation: operations } },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: {
				show: { resource: [resource], operation: operations, returnAll: [false] },
			},
		},
	];
}

/** `Zavu-Sender`: which of the project's numbers/addresses the call acts as. */
export const senderIdField: INodeProperties = {
	displayName: 'Sender Name or ID',
	name: 'senderId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getSenders' },
	default: '',
	description:
		'Sender to act as. Leave empty to use the project default. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

export const metadataField: INodeProperties = {
	displayName: 'Metadata',
	name: 'metadata',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	placeholder: 'Add Metadata',
	description: 'Arbitrary string key/value pairs stored with the record',
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
};
