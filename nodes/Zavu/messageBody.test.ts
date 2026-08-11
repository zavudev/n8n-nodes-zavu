import { describe, expect, it } from 'vitest';

import { buildSendMessageBody, type SendMessageParams } from './messageBody';
import { loadBackendModule } from './backend-fixture';

/**
 * The API's own request validator, used rather than reproduced. A body this node
 * would send that the endpoint would reject fails here — the failure mode these
 * tests exist for: a node that looks right in the UI and is refused by the API
 * at run time.
 *
 * It lives in the Zavu monorepo and is deliberately not vendored into the
 * published package. Outside the monorepo the suite skips itself instead of
 * quietly asserting nothing.
 */
type ValidationModule = {
	messageRequestSchema: {
		safeParse(value: unknown): { success: boolean; error?: any; data?: any };
	};
};

const validation = await loadBackendModule<ValidationModule>('lib/validation');
const messageRequestSchema = validation?.messageRequestSchema;
const withBackend = describe.skipIf(!validation);

function build(params: Partial<SendMessageParams>) {
	return buildSendMessageBody({
		to: '+56912345678',
		channel: 'auto',
		messageType: 'text',
		...params,
	});
}

function expectAccepted(body: unknown) {
	const result = messageRequestSchema!.safeParse(body);
	if (!result.success) {
		throw new Error(
			`The API would reject this body: ${JSON.stringify(result.error.errors, null, 2)}\n${JSON.stringify(body, null, 2)}`,
		);
	}
	return result.data;
}

/** Schema check where the backend is reachable; a no-op in the mirror repo. */
function expectAcceptedIfBackend(body: unknown) {
	if (messageRequestSchema) expectAccepted(body);
}

withBackend('bodies the node builds are accepted by the API schema', () => {
	it('plain SMS', () => {
		expectAccepted(build({ channel: 'sms', text: 'Your code is 123456' }));
	});

	it('WhatsApp text', () => {
		expectAccepted(build({ channel: 'whatsapp', text: 'Hello from n8n' }));
	});

	it('email with subject and HTML body', () => {
		const body = build({
			to: 'user@example.com',
			channel: 'email',
			text: 'Your order shipped.',
			subject: 'Order shipped',
			htmlBody: '<h1>Order shipped</h1>',
		});
		expectAccepted(body);
		expect(body.subject).toBe('Order shipped');
	});

	it('image with a caption', () => {
		expectAccepted(
			build({
				channel: 'whatsapp',
				messageType: 'image',
				text: 'Check this out',
				mediaUrl: 'https://example.com/product.jpg',
			}),
		);
	});

	it('document with a filename', () => {
		expectAccepted(
			build({
				messageType: 'document',
				mediaUrl: 'https://example.com/invoice.pdf',
				filename: 'invoice.pdf',
			}),
		);
	});

	it('location', () => {
		expectAccepted(
			build({
				messageType: 'location',
				latitude: -33.4489,
				longitude: -70.6693,
				locationName: 'Santiago',
			}),
		);
	});

	it('contact card, with the comma-separated phone list split apart', () => {
		const body = build({
			messageType: 'contact',
			contacts: [{ name: 'Jane Doe', phones: '+14155551234, +14155559999' }],
		});
		const parsed = expectAccepted(body);
		expect(parsed.content?.contacts?.[0].phones).toEqual(['+14155551234', '+14155559999']);
	});

	it('interactive buttons', () => {
		expectAccepted(
			build({
				messageType: 'buttons',
				text: 'How did we do?',
				buttons: [
					{ id: 'great', title: 'Great' },
					{ id: 'bad', title: 'Not good' },
				],
			}),
		);
	});

	it('list with sections and rows', () => {
		expectAccepted(
			build({
				messageType: 'list',
				text: 'Pick a slot',
				listButton: 'See slots',
				sections: [
					{
						title: 'Morning',
						rows: [{ id: 'am9', title: '9:00', description: 'Tomorrow' }],
					},
				],
			}),
		);
	});

	it('CTA URL button with a header and footer', () => {
		expectAccepted(
			build({
				channel: 'whatsapp',
				messageType: 'cta_url',
				text: 'Tap below to book.',
				ctaDisplayText: 'See Dates',
				ctaUrl: 'https://example.com/schedule',
				options: {
					ctaHeaderType: 'image',
					ctaHeaderMediaUrl: 'https://example.com/banner.png',
					footerText: 'Dates subject to change.',
				},
			}),
		);
	});

	it('template with positional variables', () => {
		expectAccepted(
			build({
				messageType: 'template',
				templateId: 'tmpl_abc123',
				templateVariables: { '1': 'John', '2': 'ORD-12345' },
			}),
		);
	});

	it('template with a dynamic URL button variable', () => {
		expectAccepted(
			build({
				messageType: 'template',
				templateId: 'tmpl_abc123',
				templateVariables: { '1': 'John' },
				templateButtonVariables: { '0': 'abc-report-token' },
			}),
		);
	});

	it('voice text-to-speech', () => {
		expectAccepted(
			build({
				channel: 'voice',
				text: 'Your verification code is 1 2 3 4 5 6',
				options: { voiceLanguage: 'es-ES' },
			}),
		);
	});

	it('message to a WhatsApp BSUID rather than a phone number', () => {
		expectAccepted(
			build({ to: 'US.13491208655302741918', channel: 'whatsapp', text: 'Thanks for writing' }),
		);
	});

	it('message to a numeric Telegram chat ID', () => {
		expectAccepted(build({ to: '123456789', channel: 'telegram', text: 'Hello' }));
	});
});

withBackend('the body-only interactive types', () => {
	// These take no content object at all. Sending one is rejected, and it is the
	// exact shape the API refuses, so it is pinned here.
	it.each(['location_request', 'request_contact_info'])('%s sends text and no content', (type) => {
		const body = build({ channel: 'whatsapp', messageType: type, text: 'Share it with us' });
		expect(body.content).toBeUndefined();
		expectAccepted(body);
	});

	it('the API rejects a body-only type that carries a content object', () => {
		// Proves the rule above is the API's, not this node's invention.
		const result = messageRequestSchema!.safeParse({
			to: '+56912345678',
			messageType: 'location_request',
			content: { mediaUrl: 'https://example.com/x.jpg' },
		});
		expect(result.success).toBe(false);
	});
});

describe('shape details that would otherwise be silent', () => {
	it('omits channel when it is auto, letting the backend route', () => {
		expect(build({ text: 'hi' }).channel).toBeUndefined();
	});

	it('never sends an empty content object', () => {
		expect(build({ text: 'hi' }).content).toBeUndefined();
	});

	it('carries metadata as a flat string map', () => {
		const body = build({ text: 'hi', options: { metadata: { orderId: 'ORD-1' } } });
		expectAcceptedIfBackend(body);
		expect(body.metadata).toEqual({ orderId: 'ORD-1' });
	});

	it('passes the idempotency key through, so a retry does not double-send', () => {
		const body = build({ text: 'hi', options: { idempotencyKey: 'n8n-run-42' } });
		expectAcceptedIfBackend(body);
		expect(body.idempotencyKey).toBe('n8n-run-42');
	});
});
