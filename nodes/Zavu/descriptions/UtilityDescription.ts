import type { INodeProperties } from 'n8n-workflow';

const showFor = (operations: string[]) => ({
	show: { resource: ['utility'], operation: operations },
});

export const utilityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['utility'] } },
		options: [
			{
				name: 'Get Account',
				value: 'getMe',
				description: 'The project, team and key this credential resolves to',
				action: 'Get the account context',
			},
			{
				name: 'Get Balance',
				value: 'getBalance',
				description: 'Prepaid balance in cents',
				action: 'Get the balance',
			},
			{
				name: 'Submit URL',
				value: 'submitUrl',
				description:
					'Pre-verify a URL. SMS and email carrying an unverified URL are blocked, so run this before a campaign.',
				action: 'Submit a URL for verification',
			},
			{
				name: 'Validate Email',
				value: 'validateEmail',
				description:
					'Catch invalid syntax, dead domains, disposable inboxes, role addresses and suppressed addresses before sending',
				action: 'Validate email addresses',
			},
			{
				name: 'Validate Phone',
				value: 'validatePhone',
				description: 'Line type, carrier and which channels the number can be reached on',
				action: 'Validate a phone number',
			},
		],
		default: 'validatePhone',
	},
];

export const utilityFields: INodeProperties[] = [
	{
		displayName: 'Phone Number',
		name: 'phoneNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+14155551234',
		displayOptions: showFor(['validatePhone']),
	},
	{
		displayName: 'Emails',
		name: 'emails',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'maria@example.com, info@example.com',
		description: 'One address, or a comma-separated list (max 100 per call)',
		displayOptions: showFor(['validateEmail']),
	},
	{
		displayName:
			'No mailbox-level probe is performed. "Deliverable" means no negative signal was found, not a delivery guarantee.',
		name: 'emailValidationNotice',
		type: 'notice',
		default: '',
		displayOptions: showFor(['validateEmail']),
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/landing',
		description: 'URL shorteners are always rejected — submit the full destination',
		displayOptions: showFor(['submitUrl']),
	},
];
