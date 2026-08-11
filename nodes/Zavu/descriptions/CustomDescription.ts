import type { INodeProperties } from 'n8n-workflow';

const showFor = (operations: string[]) => ({
	show: { resource: ['custom'], operation: operations },
});

export const customOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['custom'] } },
		options: [
			{
				name: 'Call an Endpoint',
				value: 'request',
				description: 'Send an authenticated request to any Zavu API endpoint',
				action: 'Call an endpoint',
			},
		],
		default: 'request',
	},
];

export const customFields: INodeProperties[] = [
	{
		displayName:
			'The endpoints this node models cover the common cases. This operation reaches everything else in the API — sub-accounts, 10DLC, functions, knowledge bases, invitations — with the same credential and error handling. See <a href="https://docs.zavu.dev/api-reference">the API reference</a>.',
		name: 'customNotice',
		type: 'notice',
		default: '',
		displayOptions: showFor(['request']),
	},
	{
		displayName: 'Method',
		name: 'method',
		type: 'options',
		default: 'GET',
		options: [
			{ name: 'DELETE', value: 'DELETE' },
			{ name: 'GET', value: 'GET' },
			{ name: 'PATCH', value: 'PATCH' },
			{ name: 'POST', value: 'POST' },
			{ name: 'PUT', value: 'PUT' },
		],
		displayOptions: showFor(['request']),
	},
	{
		displayName: 'Endpoint',
		name: 'endpoint',
		type: 'string',
		required: true,
		default: '/v1/',
		placeholder: '/v1/senders/{senderId}/agent/tools',
		description: 'Path only. The host comes from the credential.',
		displayOptions: showFor(['request']),
	},
	{
		displayName: 'Query Parameters',
		name: 'queryParameters',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Parameter',
		displayOptions: showFor(['request']),
		options: [
			{
				name: 'parameter',
				displayName: 'Parameter',
				values: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'json',
		default: '{}',
		description: 'JSON request body. Ignored for GET and DELETE.',
		displayOptions: {
			show: { resource: ['custom'], operation: ['request'], method: ['POST', 'PATCH', 'PUT'] },
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['request']),
		options: [
			{
				displayName: 'Sender ID',
				name: 'senderId',
				type: 'string',
				default: '',
				description: 'Sent as the Zavu-Sender header',
			},
			{
				displayName: 'Split Items',
				name: 'splitItems',
				type: 'boolean',
				default: true,
				description:
					'Whether to emit one n8n item per element when the response carries an "items" array',
			},
		],
	},
];
