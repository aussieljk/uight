/**
 * A local stand-in for `@storybook/test`, which one copied story
 * (`components/avatar/avatar.stories.tsx`) uses for a spy in its `args`.
 *
 * uaight does not run `play` functions or interaction assertions (SPEC §13:
 * `play: false`, `loaders: false`), so there is nothing to assert against and
 * no reason to install a test runner. What the story actually needs is a
 * callable prop that records calls and does not explode — that is all `fn()`
 * has to be here.
 *
 * The recorded calls are kept on the returned function so a fixture or a
 * console can inspect them, which is the closest honest equivalent to what
 * Storybook's Actions panel gives you.
 */

export interface SpyFn<TArgs extends unknown[] = unknown[], TReturn = void> {
	(...args: TArgs): TReturn;
	/** Every call, in order. Mirrors the shape people expect from a spy. */
	calls: TArgs[];
	mockClear(): void;
}

/**
 * Creates a call-recording no-op. `impl` is optional and, when given, is
 * called through to so a story that relies on real behaviour still gets it.
 */
export function fn<TArgs extends unknown[] = unknown[], TReturn = void>(
	impl?: (...args: TArgs) => TReturn,
): SpyFn<TArgs, TReturn> {
	const spy = ((...args: TArgs): TReturn => {
		spy.calls.push(args);
		return impl ? impl(...args) : (undefined as TReturn);
	}) as SpyFn<TArgs, TReturn>;
	spy.calls = [];
	spy.mockClear = () => {
		spy.calls = [];
	};
	return spy;
}
