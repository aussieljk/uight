/**
 * Loading a module that may not exist yet.
 *
 * The plugin, runtime and UI are written by other hands in parallel, so a test
 * for `src/vite/**` has to be able to describe a module that is not there. A
 * static import would fail the whole file — and, worse, would fail the type
 * check for everyone. The specifier is therefore a variable, which keeps
 * TypeScript out of it, and a rejection is treated as "not written yet".
 *
 * NOTE: specifiers resolve relative to THIS file, because that is where the
 * `import()` call lives. Pass `"../../src/…"` from `tests/*.test.ts`.
 */
export async function optional<T>(...specifiers: string[]): Promise<T | null> {
	for (const specifier of specifiers) {
		try {
			return (await import(/* @vite-ignore */ specifier)) as T;
		} catch {
			// Next candidate.
		}
	}
	return null;
}

/**
 * `describe` for a module that may be absent. Vitest reports the suite as
 * skipped, which is the honest outcome: not passing, not failing.
 */
export function present(mod: unknown): boolean {
	return mod !== null && mod !== undefined;
}
