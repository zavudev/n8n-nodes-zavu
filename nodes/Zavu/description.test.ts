import { describe, expect, it } from 'vitest';
import type { INodeProperties } from 'n8n-workflow';

import { Zavu } from './Zavu.node';
import { ZavuTrigger } from '../ZavuTrigger/ZavuTrigger.node';
import { WEBHOOK_EVENT_OPTIONS } from './descriptions/SenderDescription';
import { loadBackendModule } from './backend-fixture';

/**
 * The backend's own list of events a sender can subscribe to. Absent in the
 * published mirror, where the comparison cannot be made and is skipped rather
 * than asserted against a copy that would drift.
 */
type EventsModule = { WEBHOOK_EVENTS: Array<{ value: string; requiresWhatsappAlt?: boolean }> };
const events = await loadBackendModule<EventsModule>('lib/webhookEvents');
const WEBHOOK_EVENTS = events?.WEBHOOK_EVENTS ?? [];
const withBackend = describe.skipIf(!events);

const node = new Zavu();
const trigger = new ZavuTrigger();
const properties = node.description.properties;

function optionValues(property: INodeProperties): string[] {
	return ((property.options ?? []) as Array<{ value?: string }>)
		.map((option) => option.value)
		.filter((value): value is string => typeof value === 'string');
}

const resourceProperty = properties.find((property) => property.name === 'resource')!;
const resources = optionValues(resourceProperty);

/** The operation dropdown belonging to one resource. */
function operationsFor(resource: string): string[] {
	const property = properties.find(
		(candidate) =>
			candidate.name === 'operation' &&
			(candidate.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
	);
	return property ? optionValues(property) : [];
}

describe('node description', () => {
	it('gives every resource an operation list', () => {
		for (const resource of resources) {
			expect(operationsFor(resource), `resource "${resource}"`).not.toHaveLength(0);
		}
	});

	/**
	 * A field whose displayOptions name an operation that does not exist never
	 * appears in the UI, and nothing tells you: the node just silently lacks an
	 * input and the request goes out missing a field.
	 */
	it('only shows fields on operations that exist', () => {
		const known = new Map(resources.map((resource) => [resource, operationsFor(resource)]));

		for (const property of properties) {
			const shownResources = property.displayOptions?.show?.resource as string[] | undefined;
			const shownOperations = property.displayOptions?.show?.operation as string[] | undefined;
			if (!shownResources || !shownOperations) continue;

			for (const resource of shownResources) {
				expect(known.has(resource), `"${property.name}" names unknown resource "${resource}"`).toBe(
					true,
				);

				for (const operation of shownOperations) {
					expect(
						known.get(resource),
						`"${property.name}" is shown for ${resource}.${operation}, which is not an operation`,
					).toContain(operation);
				}
			}
		}
	});

	it('wires every loadOptionsMethod to a method the node actually implements', () => {
		const implemented = Object.keys(node.methods.loadOptions);

		const referenced = new Set<string>();
		const walk = (items: INodeProperties[]) => {
			for (const property of items) {
				const method = property.typeOptions?.loadOptionsMethod;
				if (method) referenced.add(method);
				// collection / fixedCollection nest their own properties
				const nested = (property.options ?? []) as Array<Record<string, unknown>>;
				for (const option of nested) {
					if (Array.isArray(option.values)) walk(option.values as INodeProperties[]);
					if (typeof option.name === 'string' && option.typeOptions) {
						walk([option as unknown as INodeProperties]);
					}
				}
			}
		};
		walk(properties);

		for (const method of referenced) {
			expect(implemented, `loadOptionsMethod "${method}"`).toContain(method);
		}
		expect(referenced.size).toBeGreaterThan(0);
	});

	it('is usable as a tool by n8n AI Agents', () => {
		expect(node.description.usableAsTool).toBe(true);
	});

	it('requires the Zavu credential on both nodes', () => {
		expect(node.description.credentials?.[0]).toMatchObject({ name: 'zavuApi', required: true });
		expect(trigger.description.credentials?.[0]).toMatchObject({
			name: 'zavuApi',
			required: true,
		});
	});
});

withBackend('webhook events offered by the trigger', () => {
	/**
	 * The event list has drifted across surfaces before — the REST route once
	 * rejected four events the docs promised. Pinning it to the backend's list
	 * means adding an event there fails here until this node offers it too.
	 */
	const publicEvents = WEBHOOK_EVENTS.filter((event) => !event.requiresWhatsappAlt).map(
		(event) => event.value,
	);

	it('offers exactly the events the API accepts', () => {
		expect([...WEBHOOK_EVENT_OPTIONS.map((option) => option.value)].sort()).toEqual(
			[...publicEvents].sort(),
		);
	});

	it('defaults the trigger to an event that exists', () => {
		const events = trigger.description.properties.find((property) => property.name === 'events')!;
		for (const value of events.default as string[]) {
			expect(publicEvents).toContain(value);
		}
	});
});
