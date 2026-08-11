import { describe, expect, it } from 'vitest';

import { parseSignatureHeader, verifyZavuSignature } from './signature';
import { loadBackendModule } from '../Zavu/backend-fixture';

/**
 * The real signer from the Zavu backend, not a re-implementation of it. If the
 * backend ever changes how it builds X-Zavu-Signature, these tests fail here
 * rather than in a customer's workflow.
 *
 * It is not vendored into the published package, so outside the monorepo this
 * suite skips itself rather than verifying against our own assumptions.
 */
type SignatureModule = {
	signWebhookPayload(
		secret: string,
		rawBody: string,
		version?: string,
		nowMs?: number,
	): Promise<string>;
};

const backend = await loadBackendModule<SignatureModule>('lib/webhookSignature');
const signWebhookPayload = backend?.signWebhookPayload as SignatureModule['signWebhookPayload'];
const withBackend = describe.skipIf(!backend);

const SECRET = 'whsec_test_9f3a2b1c';
const BODY = JSON.stringify({
	id: 'evt_1736850000000_abc123',
	type: 'message.inbound',
	timestamp: 1736850000000,
	senderId: 'jx7abc123def456',
	projectId: 'jx7xyz789ghi012',
	data: { messageId: 'jd7x2k', from: '+56912345678', text: 'hola' },
});

const NOW = 1736850000000;

describe('parseSignatureHeader', () => {
	it('reads t, v1 and v2', () => {
		expect(parseSignatureHeader('t=1736850000,v1=aaa,v2=bbb')).toEqual({
			t: 1736850000,
			v1: 'aaa',
			v2: 'bbb',
		});
	});

	it('ignores parts it does not know, so a future v3 does not break it', () => {
		expect(parseSignatureHeader('t=1,v3=ccc,v1=aaa')).toEqual({ t: 1, v1: 'aaa' });
	});
});

withBackend('verifyZavuSignature against the backend signer', () => {
	it('accepts a v1 delivery (the scheme older senders are still on)', async () => {
		const header = await signWebhookPayload(SECRET, BODY, 'v1', NOW);
		expect(verifyZavuSignature(SECRET, BODY, header, 300, NOW)).toEqual({
			ok: true,
			version: 'v1',
		});
	});

	it('accepts a v2 delivery (the default for new senders)', async () => {
		const header = await signWebhookPayload(SECRET, BODY, 'v2', NOW);
		expect(verifyZavuSignature(SECRET, BODY, header, 300, NOW)).toEqual({
			ok: true,
			version: 'v2',
		});
	});

	it('prefers v2 while a sender sits on the v1+v2 migration setting', async () => {
		const header = await signWebhookPayload(SECRET, BODY, 'v1+v2', NOW);
		expect(header).toMatch(/v1=/);
		expect(header).toMatch(/v2=/);
		expect(verifyZavuSignature(SECRET, BODY, header, 300, NOW)).toEqual({
			ok: true,
			version: 'v2',
		});
	});

	it('rejects a tampered body', async () => {
		const header = await signWebhookPayload(SECRET, BODY, 'v2', NOW);
		const tampered = BODY.replace('hola', 'transfer $10000');
		expect(verifyZavuSignature(SECRET, tampered, header, 300, NOW)).toEqual({
			ok: false,
			reason: 'signature mismatch',
		});
	});

	it('rejects a signature made with a different secret', async () => {
		const header = await signWebhookPayload('whsec_someone_else', BODY, 'v2', NOW);
		expect(verifyZavuSignature(SECRET, BODY, header, 300, NOW)).toEqual({
			ok: false,
			reason: 'signature mismatch',
		});
	});

	it('rejects a replay once it is older than the tolerance', async () => {
		const header = await signWebhookPayload(SECRET, BODY, 'v2', NOW);
		const check = verifyZavuSignature(SECRET, BODY, header, 300, NOW + 601_000);
		expect(check.ok).toBe(false);
		expect((check as { reason: string }).reason).toMatch(/601s old/);
	});

	it('accepts an old delivery when the freshness check is disabled', async () => {
		const header = await signWebhookPayload(SECRET, BODY, 'v2', NOW);
		expect(verifyZavuSignature(SECRET, BODY, header, 0, NOW + 86_400_000).ok).toBe(true);
	});

	it('rejects a timestamp far in the future', async () => {
		const header = await signWebhookPayload(SECRET, BODY, 'v2', NOW + 600_000);
		expect(verifyZavuSignature(SECRET, BODY, header, 300, NOW)).toEqual({
			ok: false,
			reason: 'timestamp is in the future',
		});
	});

	it('rejects a header with no signature part at all', () => {
		expect(verifyZavuSignature(SECRET, BODY, 't=1736850000', 300, NOW)).toEqual({
			ok: false,
			reason: 'header carries no v1 or v2 part',
		});
	});

	it('rejects a missing header rather than waving it through', () => {
		expect(verifyZavuSignature(SECRET, BODY, '', 300, NOW).ok).toBe(false);
	});

	/**
	 * The node verifies `req.rawBody` when n8n exposes it and re-serializes the
	 * parsed body otherwise. Zavu signs compact `JSON.stringify` output and
	 * `JSON.parse` preserves key order, so the fallback reproduces the same bytes
	 * — including non-ASCII, which neither side escapes.
	 */
	it('still verifies when the raw body had to be re-serialized', async () => {
		const original = JSON.stringify({
			type: 'message.inbound',
			data: { text: 'Cómo estás? 👋', to: '+56912345678' },
		});
		const header = await signWebhookPayload(SECRET, original, 'v2', NOW);
		const roundTripped = JSON.stringify(JSON.parse(original));

		expect(roundTripped).toBe(original);
		expect(verifyZavuSignature(SECRET, roundTripped, header, 300, NOW).ok).toBe(true);
	});
});
