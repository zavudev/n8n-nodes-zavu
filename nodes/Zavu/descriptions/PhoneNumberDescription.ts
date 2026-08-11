import type { INodeProperties } from 'n8n-workflow';
import { returnAllFields } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['phoneNumber'], operation: operations },
});

export const phoneNumberOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['phoneNumber'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a phone number',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List the numbers this project owns',
				action: 'Get many phone numbers',
			},
			{
				name: 'Purchase',
				value: 'purchase',
				description: 'Buy an available number. Requires a paid plan.',
				action: 'Purchase a phone number',
			},
			{
				name: 'Release',
				value: 'release',
				description: 'Give a number back. It must not be assigned to a sender.',
				action: 'Release a phone number',
			},
			{
				name: 'Search Available',
				value: 'searchAvailable',
				description: 'Search numbers available to buy, by country and type',
				action: 'Search available phone numbers',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Rename a number or assign it to a sender',
				action: 'Update a phone number',
			},
		],
		default: 'getMany',
	},
];

export const phoneNumberFields: INodeProperties[] = [
	{
		displayName: 'Country Code',
		name: 'countryCode',
		type: 'string',
		required: true,
		default: 'US',
		placeholder: 'US',
		description: 'Two-letter ISO country code',
		displayOptions: showFor(['searchAvailable']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['searchAvailable']),
		options: [
			{
				displayName: 'Capabilities',
				name: 'capabilities',
				type: 'multiOptions',
				default: [],
				description: 'Numbers missing any selected capability are dropped',
				options: [
					{ name: 'SMS', value: 'sms' },
					{ name: 'Voice', value: 'voice' },
					{ name: 'MMS', value: 'mms' },
				],
			},
			{
				displayName: 'Contains',
				name: 'contains',
				type: 'string',
				default: '',
				description: 'Only numbers containing this string',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				// The search endpoint caps at 50 itself and returns what it has.
				description: 'Max number of results to return',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'local',
				options: [
					{ name: 'Local', value: 'local' },
					{ name: 'National', value: 'national' },
					{ name: 'Toll Free', value: 'tollFree' },
				],
			},
		],
	},

	{
		displayName: 'Phone Number',
		name: 'phoneNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+15551234567',
		description: 'E.164 number returned by Search Available',
		displayOptions: showFor(['purchase']),
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Optional label for the number',
		displayOptions: showFor(['purchase']),
	},

	{
		displayName: 'Phone Number Name or ID',
		name: 'phoneNumberId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPhoneNumbers' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: showFor(['get', 'update', 'release']),
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['update']),
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{
				displayName: 'Sender Name or ID',
				name: 'senderId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getSenders' },
				default: '',
				description:
					'Assign the number to this sender. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},

	...returnAllFields('phoneNumber', ['getMany']),
];
