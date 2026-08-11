import { describe, expect, it, vi } from 'vitest';
import type { IDataObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	keyValueToRecord,
	senderHeader,
	unwrapEnvelope,
	zavuApiRequest,
	zavuApiRequestAllItems,
} from './GenericFunctions';

/**
 * A stand-in for the slice of n8n's execution context these helpers touch. The
 * point is to assert what leaves the node — URL, method, headers, body — since
 * that is where the wiring breaks: a doubled slash, a header sent as a body
 * field, a cursor that never advances.
 */
function makeContext(
	responder: (options: IDataObject) => unknown,
	credentials: IDataObject = { apiKey: 'zv_test_key', baseUrl: 'https://api.zavu.dev' },
) {
	const calls: IDataObject[] = [];

	const context = {
		calls,
		getCredentials: vi.fn(async () => credentials),
		getNode: () => ({ name: 'Zavu', type: 'zavu' }),
		helpers: {
			requestWithAuthentication: vi.fn(async function (
				this: unknown,
				_credentialType: string,
				options: IDataObject,
			) {
				calls.push(options);
				return responder(options);
			}),
		},
	};

	return context;
}

describe('zavuApiRequest', () => {
	it('builds the URL from the credential and the endpoint', async () => {
		const context = makeContext(() => ({ ok: true }));
		await zavuApiRequest.call(context as never, 'GET', '/v1/me');

		expect(context.calls[0].uri).toBe('https://api.zavu.dev/v1/me');
		expect(context.calls[0].method).toBe('GET');
	});

	it('does not double the slash when the base URL has a trailing one', async () => {
		const context = makeContext(() => ({}), {
			apiKey: 'zv_test_key',
			baseUrl: 'https://api.zavu.dev/',
		});
		await zavuApiRequest.call(context as never, 'GET', '/v1/senders');

		expect(context.calls[0].uri).toBe('https://api.zavu.dev/v1/senders');
	});

	it('falls back to production when the credential has no base URL', async () => {
		const context = makeContext(() => ({}), { apiKey: 'zv_live_key' });
		await zavuApiRequest.call(context as never, 'GET', '/v1/me');

		expect(context.calls[0].uri).toBe('https://api.zavu.dev/v1/me');
	});

	it('sends the sender as a header, never as a body field', async () => {
		const context = makeContext(() => ({}));
		await zavuApiRequest.call(
			context as never,
			'POST',
			'/v1/messages',
			{ to: '+56912345678', text: 'hi' },
			{},
			senderHeader('sender_123'),
		);

		const headers = context.calls[0].headers as IDataObject;
		expect(headers['Zavu-Sender']).toBe('sender_123');
		expect(context.calls[0].body).toEqual({ to: '+56912345678', text: 'hi' });
		expect((context.calls[0].body as IDataObject)['Zavu-Sender']).toBeUndefined();
	});

	it('omits the sender header entirely when no sender is chosen', async () => {
		const context = makeContext(() => ({}));
		await zavuApiRequest.call(
			context as never,
			'POST',
			'/v1/messages',
			{ to: 'x' },
			{},
			senderHeader(''),
		);

		expect(context.calls[0].headers).not.toHaveProperty('Zavu-Sender');
	});

	it('drops an empty body so a GET is not sent with one', async () => {
		const context = makeContext(() => ({}));
		await zavuApiRequest.call(context as never, 'GET', '/v1/messages', {}, {});

		expect(context.calls[0]).not.toHaveProperty('body');
		expect(context.calls[0]).not.toHaveProperty('qs');
	});

	/**
	 * n8n's request helper wraps HTTP failures in a NodeApiError before we ever
	 * see them, and that error already carries the API's message as its
	 * `description` and the `{code, message}` body in `messages`. Re-wrapping it
	 * discarded both and left a bare "Bad request - please check your
	 * parameters", which is what a real workflow surfaced before this passthrough
	 * existed.
	 */
	it('passes an already-wrapped NodeApiError through untouched', async () => {
		const wrapped = new NodeApiError(
			{ name: 'Zavu', type: 'zavu' } as never,
			{ code: 'whatsapp_window_closed', message: 'WhatsApp 24-hour window is not open.' },
			{ httpCode: '400' },
		);

		const context = makeContext(() => {
			throw wrapped;
		});

		const thrown = await zavuApiRequest
			.call(context as never, 'POST', '/v1/messages', { to: 'x' })
			.then(() => null)
			.catch((error) => error);

		expect(thrown).toBe(wrapped);
		expect(thrown.description).toBe('WhatsApp 24-hour window is not open.');
	});

	it('wraps an error that is not already a NodeApiError', async () => {
		const context = makeContext(() => {
			throw new Error('socket hang up');
		});

		const thrown = await zavuApiRequest
			.call(context as never, 'GET', '/v1/me')
			.then(() => null)
			.catch((error) => error);

		expect(thrown.name).toBe('NodeApiError');
	});
});

describe('zavuApiRequestAllItems', () => {
	it('follows nextCursor to the end and returns every item', async () => {
		const pages: Record<string, IDataObject> = {
			start: { items: [{ id: '1' }, { id: '2' }], nextCursor: 'cursor-2' },
			'cursor-2': { items: [{ id: '3' }], nextCursor: null },
		};

		const context = makeContext((options) => {
			const cursor = ((options.qs as IDataObject)?.cursor as string) ?? 'start';
			return pages[cursor];
		});

		const items = await zavuApiRequestAllItems.call(context as never, '/v1/messages');

		expect(items.map((item) => item.id)).toEqual(['1', '2', '3']);
		expect(context.calls).toHaveLength(2);
		expect((context.calls[0].qs as IDataObject).limit).toBe(100);
		expect((context.calls[1].qs as IDataObject).cursor).toBe('cursor-2');
	});

	it('stops on an empty page even if a cursor is still returned', async () => {
		// Guards against a loop that would otherwise never terminate.
		const context = makeContext(() => ({ items: [], nextCursor: 'always-the-same' }));
		const items = await zavuApiRequestAllItems.call(context as never, '/v1/messages');

		expect(items).toEqual([]);
		expect(context.calls).toHaveLength(1);
	});
});

describe('unwrapEnvelope', () => {
	it('unwraps the single-key envelopes the API uses', () => {
		expect(unwrapEnvelope({ message: { id: 'msg_1', status: 'queued' } })).toEqual({
			id: 'msg_1',
			status: 'queued',
		});
		expect(unwrapEnvelope({ broadcast: { id: 'brd_1' } })).toEqual({ id: 'brd_1' });
	});

	it('leaves a bare entity alone', () => {
		// Templates, senders and contacts come back unwrapped.
		expect(unwrapEnvelope({ id: 'tmpl_1', name: 'order_confirmation' })).toEqual({
			id: 'tmpl_1',
			name: 'order_confirmation',
		});
	});

	it('leaves a multi-key response alone', () => {
		expect(unwrapEnvelope({ success: true, profile: { about: 'x' } })).toEqual({
			success: true,
			profile: { about: 'x' },
		});
	});

	it('does not mistake a one-key list response for an envelope', () => {
		expect(unwrapEnvelope({ items: [{ id: '1' }] })).toEqual({ items: [{ id: '1' }] });
	});
});

describe('keyValueToRecord', () => {
	it('flattens the UI collection into the string map the API takes', () => {
		expect(
			keyValueToRecord({
				variable: [
					{ name: '1', value: 'John' },
					{ name: '2', value: 'ORD-12345' },
				],
			}),
		).toEqual({ '1': 'John', '2': 'ORD-12345' });
	});

	it('returns undefined for an empty collection, so no empty object is sent', () => {
		expect(keyValueToRecord({})).toBeUndefined();
		expect(keyValueToRecord({ variable: [] })).toBeUndefined();
	});

	it('skips entries with no key and stringifies values', () => {
		expect(
			keyValueToRecord({
				variable: [
					{ name: '', value: 'x' },
					{ name: 'n', value: 42 },
				],
			}),
		).toEqual({ n: '42' });
	});
});
