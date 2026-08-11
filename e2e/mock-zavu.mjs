/**
 * A stand-in for api.zavu.dev, just faithful enough to drive the n8n nodes.
 *
 * Response shapes are copied from the real handlers (envelopes, cursor
 * pagination, the {code,message} error body), so a node that works against this
 * is exercising the same parsing it will do in production.
 *
 * Every request is recorded to requests.json so the assertions can check what
 * actually left n8n: the auth header, the Zavu-Sender header, the request body.
 */
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const OUT = process.env.RECORD || new URL('./requests.json', import.meta.url).pathname;

const requests = [];
const record = (req, url, body) => {
	requests.push({
		method: req.method,
		path: url.pathname,
		query: Object.fromEntries(url.searchParams),
		auth: req.headers.authorization || null,
		sender: req.headers['zavu-sender'] || null,
		userAgent: req.headers['user-agent'] || null,
		body,
	});
	writeFileSync(OUT, JSON.stringify(requests, null, 2));
};

const SENDER_ID = 'snd_e2e_primary';
const WEBHOOK_SECRET = 'whsec_e2e_minted_by_mock';

// Mutable so the trigger's PATCH can be observed by a later GET.
const sender = {
	id: SENDER_ID,
	name: 'E2E Sender',
	phoneNumber: '+13125551212',
	channels: ['sms', 'whatsapp'],
	isDefault: true,
	createdAt: '2026-01-01T00:00:00.000Z',
};

const json = (res, status, payload) => {
	const body = JSON.stringify(payload);
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(body);
};

const err = (res, status, code, message) => json(res, status, { code, message });

const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	let raw = '';
	for await (const chunk of req) raw += chunk;
	const body = raw ? JSON.parse(raw) : undefined;

	record(req, url, body);

	// Every route below is authenticated, exactly like the real API.
	if (req.headers.authorization !== 'Bearer zv_test_e2e_key') {
		return err(res, 401, 'unauthorized', 'Invalid or missing API key');
	}

	const p = url.pathname;

	if (p === '/v1/me' && req.method === 'GET') {
		return json(res, 200, {
			project: { id: 'prj_e2e', name: 'E2E Project', isSubAccount: false },
			team: { id: 'team_e2e', name: 'E2E Team' },
			apiKey: { id: 'key_e2e' },
			isTestMode: true,
		});
	}

	if (p === '/v1/senders' && req.method === 'GET') {
		return json(res, 200, { items: [sender], nextCursor: null });
	}

	if (p === `/v1/senders/${SENDER_ID}` && req.method === 'GET') {
		return json(res, 200, sender);
	}

	if (p === `/v1/senders/${SENDER_ID}` && req.method === 'PATCH') {
		// Mirrors updateInternal: a secret is minted only when there was none.
		const hadSecret = Boolean(sender.__secret);
		if (body.webhookUrl === null) {
			delete sender.webhook;
			delete sender.__secret;
			return json(res, 200, sender);
		}
		if (body.webhookUrl) {
			sender.webhook = {
				url: body.webhookUrl,
				events: body.webhookEvents ?? [],
				active: body.webhookActive ?? true,
				signatureVersion: 'v2',
			};
			if (!hadSecret) {
				sender.__secret = WEBHOOK_SECRET;
				return json(res, 200, { ...sender, webhook: { ...sender.webhook, secret: WEBHOOK_SECRET } });
			}
		}
		if (body.webhookEvents) sender.webhook.events = body.webhookEvents;
		return json(res, 200, sender);
	}

	if (p === '/v1/messages' && req.method === 'POST') {
		// The one validation worth reproducing: it is the error the node has to
		// surface legibly.
		if (!body?.to) return err(res, 400, 'invalid_request', 'Invalid request body');
		if (body.to === '+10000000000') {
			return err(
				res,
				400,
				'whatsapp_window_closed',
				'WhatsApp 24-hour window is not open. Use a template message or wait for user to message first.',
			);
		}
		return json(res, 202, {
			message: {
				id: 'msg_e2e_1',
				to: body.to,
				from: sender.phoneNumber,
				senderId: SENDER_ID,
				channel: body.channel ?? 'sms',
				messageType: body.messageType ?? 'text',
				status: 'queued',
				text: body.text,
				content: body.content,
				createdAt: '2026-08-10T00:00:00.000Z',
			},
		});
	}

	// Two pages, so "Return All" has something to walk.
	if (p === '/v1/messages' && req.method === 'GET') {
		const cursor = url.searchParams.get('cursor');
		if (!cursor) {
			return json(res, 200, {
				items: [
					{ id: 'msg_p1_a', to: '+1', status: 'delivered', channel: 'sms' },
					{ id: 'msg_p1_b', to: '+2', status: 'delivered', channel: 'sms' },
				],
				nextCursor: 'page2',
			});
		}
		return json(res, 200, {
			items: [{ id: 'msg_p2_a', to: '+3', status: 'delivered', channel: 'sms' }],
			nextCursor: null,
		});
	}

	if (p === '/v1/introspect/email' && req.method === 'POST') {
		const emails = body.emails ?? [body.email];
		return json(res, 200, {
			results: emails.map((email) => ({
				email,
				normalized: email.toLowerCase(),
				domain: email.split('@')[1] ?? null,
				verdict: email.startsWith('info@') ? 'risky' : 'deliverable',
				reasons: email.startsWith('info@') ? ['role_address'] : [],
			})),
			summary: { total: emails.length, deliverable: 0, risky: 0, undeliverable: 0 },
		});
	}

	return err(res, 404, 'not_found', `No mock route for ${req.method} ${p}`);
});

server.listen(PORT, () => {
	console.log(`mock zavu api on http://127.0.0.1:${PORT}`);
	console.log(`recording to ${OUT}`);
});

// Exposed so the delivery script signs exactly like the backend does.
export const sign = (payload, secret = WEBHOOK_SECRET) => {
	const t = Math.floor(Date.now() / 1000);
	const v2 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
	return `t=${t},v2=${v2}`;
};
