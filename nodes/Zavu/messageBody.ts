import type { IDataObject } from 'n8n-workflow';

/**
 * Turning the node's flat parameters into a `POST /v1/messages` body.
 *
 * This lives apart from the node so it can be unit-tested against the API's own
 * request schema. Every field name and every shape below is what the endpoint
 * validates — a body assembled here that the API would reject is a bug caught by
 * `messageBody.test.ts`, not by a customer's workflow.
 */

/** Types carried by a URL, with `text` acting as the caption. */
export const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

/**
 * Interactive types whose whole payload is the body text: WhatsApp fixes the
 * button label, so there is nothing to put in `content` and sending one is a 400.
 */
export const BODY_ONLY_TYPES = ['location_request', 'request_contact_info'];

export interface SendMessageParams {
	to: string;
	channel: string;
	messageType: string;
	text?: string;
	subject?: string;
	htmlBody?: string;
	mediaUrl?: string;
	filename?: string;
	latitude?: number;
	longitude?: number;
	locationName?: string;
	locationAddress?: string;
	/** `[{ name, phones: "+1..., +2..." }]` as collected by the UI. */
	contacts?: Array<{ name?: string; phones?: string }>;
	buttons?: Array<{ id?: string; title?: string }>;
	listButton?: string;
	sections?: Array<{
		title?: string;
		rows?: Array<{ id?: string; title?: string; description?: string }>;
	}>;
	ctaDisplayText?: string;
	ctaUrl?: string;
	templateId?: string;
	templateVariables?: Record<string, string>;
	templateButtonVariables?: Record<string, string>;
	templateHeaderVariables?: Record<string, string>;
	options?: IDataObject;
}

export function buildMessageContent(params: SendMessageParams): IDataObject | undefined {
	const { messageType, options = {} } = params;

	// text, location_request and request_contact_info take no content object.
	if (messageType === 'text' || BODY_ONLY_TYPES.includes(messageType)) return undefined;

	const content: IDataObject = {};

	if (MEDIA_TYPES.includes(messageType)) {
		if (params.mediaUrl) content.mediaUrl = params.mediaUrl;
		if (params.filename) content.filename = params.filename;
		if (options.mimeType) content.mimeType = options.mimeType;
		return content;
	}

	if (messageType === 'location') {
		content.latitude = params.latitude;
		content.longitude = params.longitude;
		if (params.locationName) content.locationName = params.locationName;
		if (params.locationAddress) content.locationAddress = params.locationAddress;
		return content;
	}

	if (messageType === 'contact') {
		content.contacts = (params.contacts ?? []).map((entry) => ({
			name: entry.name ?? '',
			phones: String(entry.phones ?? '')
				.split(',')
				.map((phone) => phone.trim())
				.filter(Boolean),
		}));
		return content;
	}

	if (messageType === 'buttons') {
		content.buttons = (params.buttons ?? []).map((button) => ({
			id: button.id ?? '',
			title: button.title ?? '',
		}));
		return content;
	}

	if (messageType === 'list') {
		if (params.listButton) content.listButton = params.listButton;
		content.sections = (params.sections ?? []).map((section) => ({
			title: section.title ?? '',
			rows: (section.rows ?? []).map((row) => {
				const mapped: IDataObject = { id: row.id ?? '', title: row.title ?? '' };
				if (row.description) mapped.description = row.description;
				return mapped;
			}),
		}));
		return content;
	}

	if (messageType === 'cta_url') {
		if (params.ctaDisplayText) content.ctaDisplayText = params.ctaDisplayText;
		if (params.ctaUrl) content.ctaUrl = params.ctaUrl;
		if (options.ctaHeaderType) content.ctaHeaderType = options.ctaHeaderType;
		if (options.ctaHeaderText) content.ctaHeaderText = options.ctaHeaderText;
		if (options.ctaHeaderMediaUrl) content.ctaHeaderMediaUrl = options.ctaHeaderMediaUrl;
		if (options.footerText) content.footerText = options.footerText;
		return content;
	}

	if (messageType === 'template') {
		if (params.templateId) content.templateId = params.templateId;
		if (params.templateVariables) content.templateVariables = params.templateVariables;
		if (params.templateButtonVariables) {
			content.templateButtonVariables = params.templateButtonVariables;
		}
		if (params.templateHeaderVariables) {
			content.templateHeaderVariables = params.templateHeaderVariables;
		}
		return content;
	}

	return content;
}

export function buildSendMessageBody(params: SendMessageParams): IDataObject {
	const { channel, messageType, options = {} } = params;

	const body: IDataObject = { to: params.to, messageType };

	// "auto" is the API default. Omitting it keeps the request minimal and lets
	// the backend route on the sender's capabilities.
	if (channel && channel !== 'auto') body.channel = channel;

	if (params.text) body.text = params.text;

	const content = buildMessageContent(params);
	if (content && Object.keys(content).length > 0) body.content = content;

	if (channel === 'email') {
		if (params.subject) body.subject = params.subject;
		if (params.htmlBody) body.htmlBody = params.htmlBody;
	}

	if (options.idempotencyKey) body.idempotencyKey = options.idempotencyKey;
	if (options.fallbackEnabled !== undefined) body.fallbackEnabled = options.fallbackEnabled;
	if (options.voiceLanguage) body.voiceLanguage = options.voiceLanguage;
	if (options.replyTo) body.replyTo = options.replyTo;
	if (options.metadata) body.metadata = options.metadata;

	return body;
}
