import type { INodeProperties } from 'n8n-workflow';
import { returnAllFields } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['agent'], operation: operations },
});

export const agentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['agent'] } },
		options: [
			{
				name: 'Connect Sender',
				value: 'attachSender',
				description: 'Make the agent answer on a sender',
				action: 'Connect a sender to an agent',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create an agent. It starts disabled and connected to no sender.',
				action: 'Create an agent',
			},
			{ name: 'Delete', value: 'delete', action: 'Delete an agent' },
			{
				name: 'Disconnect Sender',
				value: 'detachSender',
				description: 'Stop the agent answering on a sender',
				action: 'Disconnect a sender from an agent',
			},
			{ name: 'Get', value: 'get', action: 'Get an agent' },
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Every agent in the project, including ones connected to no sender',
				action: 'Get many agents',
			},
			{
				name: 'Test',
				value: 'test',
				description:
					'Run the agent against a message and return what it would say. Delivers nothing and charges nothing.',
				action: 'Test an agent',
			},
			{ name: 'Update', value: 'update', action: 'Update an agent' },
		],
		default: 'getMany',
	},
];

const PROVIDERS = [
	{ name: 'Zavu', value: 'zavu', description: 'Managed models, no API key of your own' },
	{ name: 'OpenAI', value: 'openai' },
	{ name: 'Anthropic', value: 'anthropic' },
	{ name: 'Google', value: 'google' },
	{ name: 'Mistral', value: 'mistral' },
];

export const agentFields: INodeProperties[] = [
	{
		displayName: 'Agent Name or ID',
		name: 'agentId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAgents' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: showFor(['get', 'update', 'delete', 'test', 'attachSender', 'detachSender']),
	},
	{
		displayName: 'Sender Name or ID',
		name: 'senderId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSenders' },
		required: true,
		default: '',
		description:
			'A sender answers with at most one agent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: showFor(['attachSender', 'detachSender']),
	},

	// ---------------------------------------------------------------- test ---
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		placeholder: 'Where is order ORD-12345?',
		displayOptions: showFor(['test']),
	},
	{
		displayName:
			'A test run never executes the agent tools — running them would cause real side effects. Live conversations do. Check the "warnings" field on the result before reading a passing test as proof the agent works.',
		name: 'agentTestNotice',
		type: 'notice',
		default: '',
		displayOptions: showFor(['test']),
	},
	{
		displayName: 'Use Knowledge Base',
		name: 'useKnowledgeBase',
		type: 'boolean',
		default: true,
		description:
			'Whether to retrieve from the knowledge base. Turn off to isolate prompt behaviour.',
		displayOptions: showFor(['test']),
	},

	// -------------------------------------------------------------- create ---
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'options',
		required: true,
		default: 'zavu',
		options: PROVIDERS,
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Model',
		name: 'model',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'gpt-4o-mini',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'System Prompt',
		name: 'systemPrompt',
		type: 'string',
		typeOptions: { rows: 6 },
		required: true,
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
				displayName: 'Context Window Messages',
				name: 'contextWindowMessages',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 50 },
				default: 10,
				description: 'How many earlier messages to include as context',
			},
			{
				displayName: 'Include Contact Metadata',
				name: 'includeContactMetadata',
				type: 'boolean',
				default: true,
				description: 'Whether to put the contact metadata in the prompt context',
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 4096 },
				default: 1024,
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
				default: 0.7,
			},
			{
				displayName: 'Trigger on Channels',
				name: 'triggerOnChannels',
				type: 'string',
				default: '*',
				description: 'Comma-separated channels, or * for all',
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
				displayName: 'Enabled',
				name: 'enabled',
				type: 'boolean',
				default: true,
				description: 'Whether the agent answers inbound messages',
			},
			{ displayName: 'Model', name: 'model', type: 'string', default: '' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
				default: 0.7,
			},
		],
	},

	...returnAllFields('agent', ['getMany']),
];
