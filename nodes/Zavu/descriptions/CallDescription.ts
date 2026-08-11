import type { INodeProperties } from 'n8n-workflow';
import { metadataField, returnAllFields, senderIdField } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['call'], operation: operations },
});

export const callOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['call'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Place an outbound call answered by the sender voice agent',
				action: 'Place a voice call',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a call, including its transcript once turns exist',
				action: 'Get a voice call',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List calls, most recent first. Transcripts are omitted from the list.',
				action: 'Get many voice calls',
			},
			{
				name: 'Hang Up',
				value: 'hangup',
				description: 'End a call that is still ringing or in progress',
				action: 'Hang up a voice call',
			},
		],
		default: 'create',
	},
];

export const callFields: INodeProperties[] = [
	{
		displayName:
			'Voice Agents must be enabled for the team, and the sender agent needs voice turned on. Calls are billed per connected minute plus telephony, and are not available with test-mode API keys.',
		name: 'callNotice',
		type: 'notice',
		default: '',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+14155551234',
		description: 'Recipient phone number in E.164 format',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['create']),
		options: [
			{
				displayName: 'Greeting',
				name: 'greeting',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				description: 'Overrides the agent greeting for this call only',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'es-ES',
				description:
					'BCP-47 tag for this call only, or "auto" to follow the caller. Falls back to the agent language when empty.',
			},
			{
				displayName: 'Max Duration (Minutes)',
				name: 'maxDurationMinutes',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 120 },
				default: 15,
			},
			metadataField,
			senderIdField,
		],
	},

	{
		displayName: 'Call ID',
		name: 'callId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'hangup']),
	},

	...returnAllFields('call', ['getMany']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getMany']),
		options: [
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				default: 'outbound',
				options: [
					{ name: 'Inbound', value: 'inbound' },
					{ name: 'Outbound', value: 'outbound' },
				],
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'completed',
				options: [
					{ name: 'Busy', value: 'busy' },
					{ name: 'Canceled', value: 'canceled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'In Progress', value: 'in_progress' },
					{ name: 'No Answer', value: 'no_answer' },
					{ name: 'Queued', value: 'queued' },
					{ name: 'Ringing', value: 'ringing' },
				],
			},
		],
	},
];
