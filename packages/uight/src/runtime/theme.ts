/**
 * Reading the host's theme from inside the renderer — SPEC.md §10.1.
 *
 * The host stamps `data-uight-theme` on the renderer document's
 * `documentElement` (`THEME_ATTRIBUTE` in `shared/types.ts` documents the whole
 * contract). This module is the renderer half: the read, and a subscription, so
 * a preview entry can theme the host application's providers to match the
 * chrome without a message, a context or an addition to the frozen facade.
 *
 * Deliberately not a fixture hook. `useUightTheme` needs no fixture runtime,
 * because the reader is the provider tree *above* every fixture.
 */

import { useSyncExternalStore } from "react";
import { THEME_ATTRIBUTE } from "../shared/types.ts";
import type { ResolvedUightTheme } from "../shared/types.ts";

/** Absent, unrecognized, or no DOM at all: light. §10.1 */
export function readUightTheme(doc?: Document): ResolvedUightTheme {
	const target = doc ?? (typeof document === "undefined" ? undefined : document);
	return target?.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark"
		? "dark"
		: "light";
}

/**
 * Fires when the attribute changes, including when the host stamps it for the
 * first time — a frame that mounts before the host's effect runs must not stay
 * on the default.
 */
export function subscribeUightTheme(listener: () => void, doc?: Document): () => void {
	const target = doc ?? (typeof document === "undefined" ? undefined : document);
	if (!target || typeof MutationObserver === "undefined") return () => {};
	const observer = new MutationObserver(listener);
	observer.observe(target.documentElement, {
		attributes: true,
		attributeFilter: [THEME_ATTRIBUTE],
	});
	return () => observer.disconnect();
}

export function useUightTheme(): ResolvedUightTheme {
	return useSyncExternalStore(
		subscribeUightTheme,
		() => readUightTheme(),
		() => "light" as const,
	);
}
