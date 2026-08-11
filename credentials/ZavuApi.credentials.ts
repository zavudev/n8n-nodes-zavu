import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ZavuApi implements ICredentialType {
	name = 'zavuApi';

	displayName = 'Zavu API';

	documentationUrl = 'https://docs.zavu.dev';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'zv_live_...',
			description:
				'Project API key from Dashboard → Settings → API Keys. Keys starting with zv_test_ run in test mode: sends are simulated against the WhatsApp sandbox instead of reaching a real recipient.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.zavu.dev',
			description:
				'Only change this to point at a non-production Zavu deployment. Leave the default otherwise.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// GET /v1/me is the cheapest endpoint that proves the key resolves to a
	// project: it reads nothing else and costs nothing to call.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
			url: '/v1/me',
			method: 'GET',
		},
	};
}
