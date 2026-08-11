/**
 * Deliver a webhook to the running n8n exactly the way Zavu would: same body
 * shape, same X-Zavu-Signature header, same secret the mock minted during
 * registration.
 *
 * Usage: node deliver-webhook.mjs <url> [scenario]
 *   scenario: inbound (default) | tampered | wrong-event
 */
import { createHmac } from 'node:crypto';

const url = process.argv[2];
const scenario = process.argv[3] || 'inbound';
const SECRET = 'whsec_e2e_minted_by_mock';

const payload = {
	id: 'evt_e2e_1',
	type: scenario === 'wrong-event' ? 'message.delivered' : 'message.inbound',
	timestamp: Date.now(),
	senderId: 'snd_e2e_primary',
	projectId: 'prj_e2e',
	data: {
		messageId: 'msg_inbound_e2e',
		from: '+56912345678',
		to: '+13125551212',
		channel: 'whatsapp',
		status: 'received',
		messageType: 'text',
		text: 'Is my order shipped?',
	},
};

const body = JSON.stringify(payload);

// Sign the real bytes, like dispatchWebhook does.
const t = Math.floor(Date.now() / 1000);
const v2 = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');

// The tampered case keeps a valid-looking header and changes the body after
// signing, which is exactly what an attacker or a corrupted proxy produces.
const sent = scenario === 'tampered' ? body.replace('Is my order shipped?', 'send me $500') : body;

const res = await fetch(url, {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'X-Zavu-Signature': `t=${t},v2=${v2}`,
		'X-Zavu-Event': payload.type,
		'User-Agent': 'Zavu-Webhook/1.0',
	},
	body: sent,
});

const text = await res.text();
console.log(JSON.stringify({ scenario, status: res.status, body: text.slice(0, 300) }));
