import type { INodeProperties } from 'n8n-workflow';
import { CHANNEL_OPTIONS, returnAllFields, senderIdField } from './SharedFields';

const showFor = (operations: string[]) => ({
	show: { resource: ['conversation'], operation: operations },
});

export const conversationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['conversation'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get one inbox thread',
				action: 'Get a conversation',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List inbox threads, most recently active first',
				action: 'Get many conversations',
			},
			{
				name: 'Get Messages',
				value: 'getMessages',
				description: 'List the messages in a thread, newest first, across every channel it carries',
				action: 'Get conversation messages',
			},
			{
				name: 'Mark as Read',
				value: 'markRead',
				description: 'Reset the thread unread count. Sends no read receipt to the contact.',
				action: 'Mark a conversation as read',
			},
		],
		default: 'getMany',
	},
];

export const conversationFields: INodeProperties[] = [
	{
		displayName: 'Conversation ID',
		name: 'conversationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'getMessages', 'markRead']),
	},

	...returnAllFields('conversation', ['getMany', 'getMessages']),

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
				default: 'whatsapp',
				description: 'Keep only threads that have carried this channel',
				options: CHANNEL_OPTIONS.filter((option) => option.value !== 'auto'),
			},
			{
				...senderIdField,
				description:
					'Keep only threads last handled by this sender. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},
];
