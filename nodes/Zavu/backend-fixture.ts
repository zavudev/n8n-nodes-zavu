/**
 * Loads a module from the Zavu backend, when this package is sitting inside the
 * Zavu monorepo.
 *
 * Several suites check the node against the backend's own schemas, signer and
 * event list rather than against a copy, which is what makes them fail when the
 * API changes instead of after a customer's workflow breaks. That backend is
 * private and is not vendored into the published package, so in the public
 * mirror repository those imports cannot resolve.
 *
 * Returning `undefined` there lets each suite skip itself. A skipped test that
 * names its reason is honest; a deleted one, or a green run over assertions that
 * silently checked nothing, is not.
 *
 * The specifier is built at run time on purpose: a static import would be
 * resolved by the bundler at transform time and fail the whole file.
 */
export async function loadBackendModule<T>(relativePath: string): Promise<T | undefined> {
	const specifier = `../../../dashboard/convex/${relativePath}`;
	try {
		return (await import(/* @vite-ignore */ specifier)) as T;
	} catch {
		return undefined;
	}
}
