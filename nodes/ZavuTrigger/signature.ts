import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifier for the `X-Zavu-Signature` header.
 *
 * Ported from the signer in the Zavu backend (convex/lib/webhookSignature.ts).
 * The header looks like `t=<unix seconds>,v1=<hex>,v2=<hex>` and carries one or
 * both signatures:
 *
 *   v1 = HMAC_SHA256(secret, body)
 *   v2 = HMAC_SHA256(secret, `${t}.${body}`)
 *
 * v1 is the older scheme. Its weakness is that `t` is not covered by the HMAC,
 * so an attacker holding one valid (body, v1) pair can rewrite `t` and replay it
 * forever — which is why the freshness check below is only meaningful under v2.
 * Senders created recently default to v2; older ones stay on v1 until they are
 * migrated through `v1+v2`, so both are accepted here and v2 is preferred when
 * a delivery carries both.
 */

export type SignatureCheck = { ok: true; version: 'v1' | 'v2' } | { ok: false; reason: string };

interface ParsedSignatureHeader {
	t?: number;
	v1?: string;
	v2?: string;
}

/** Unknown parts are ignored, so a future v3 does not break this parser. */
export function parseSignatureHeader(header: string): ParsedSignatureHeader {
	const parsed: ParsedSignatureHeader = {};

	for (const part of header.split(',')) {
		const index = part.indexOf('=');
		if (index < 0) continue;

		const key = part.slice(0, index).trim();
		const value = part.slice(index + 1).trim();

		if (key === 't') {
			const seconds = Number(value);
			if (Number.isFinite(seconds)) parsed.t = seconds;
		} else if (key === 'v1') {
			parsed.v1 = value;
		} else if (key === 'v2') {
			parsed.v2 = value;
		}
	}

	return parsed;
}

function hmacHex(secret: string, payload: string): string {
	return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
	// Compare lengths first: timingSafeEqual throws on a length mismatch, and the
	// caller controls one side.
	if (a.length !== b.length) return false;
	return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export function verifyZavuSignature(
	secret: string,
	rawBody: string,
	header: string,
	toleranceSeconds = 300,
	nowMs: number = Date.now(),
): SignatureCheck {
	if (!header) return { ok: false, reason: 'no X-Zavu-Signature header' };
	if (!secret) return { ok: false, reason: 'no webhook secret configured' };

	const parsed = parseSignatureHeader(header);
	if (parsed.v1 === undefined && parsed.v2 === undefined) {
		return { ok: false, reason: 'header carries no v1 or v2 part' };
	}

	if (toleranceSeconds > 0) {
		if (parsed.t === undefined) return { ok: false, reason: 'header carries no usable t part' };

		const age = Math.floor(nowMs / 1000) - parsed.t;
		if (age > toleranceSeconds) return { ok: false, reason: `delivery is ${age}s old` };
		// A little slack for clock skew between n8n and Zavu.
		if (age < -60) return { ok: false, reason: 'timestamp is in the future' };
	}

	if (parsed.v2 !== undefined && parsed.t !== undefined) {
		if (constantTimeEqual(hmacHex(secret, `${parsed.t}.${rawBody}`), parsed.v2)) {
			return { ok: true, version: 'v2' };
		}
		// Fall through: a sender on "v1+v2" whose v2 we somehow cannot match still
		// has a real v1 to check.
	}

	if (parsed.v1 !== undefined) {
		if (constantTimeEqual(hmacHex(secret, rawBody), parsed.v1)) {
			return { ok: true, version: 'v1' };
		}
	}

	return { ok: false, reason: 'signature mismatch' };
}
