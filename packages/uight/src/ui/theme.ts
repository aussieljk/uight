/**
 * Theme resolution. SPEC.md §10.1.
 *
 * The chrome is built from ljkui, so the palette is ljkui's: `<Theme>` writes
 * the scales onto its own element and flips them with a `.light` / `.dark`
 * class. `styles/uight.css` maps our `--uight-*` tokens onto those scales, so
 * there is exactly one palette and nothing here has to restate it.
 *
 * What is left is the one thing ljkui cannot do for us: `theme="system"`.
 * `appearance="inherit"` would inherit from *the host's* document, which is a
 * different question from "what does this user's OS prefer" — a host that never
 * set an appearance would leave the explorer light on a dark desktop. So we
 * resolve the media query ourselves and hand `<Theme>` a concrete answer.
 */

import { useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

export type ThemeSetting = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * What the theme element needs beyond ljkui's own classes: the resolved colour
 * scheme, so native widgets (scrollbars, date pickers, form controls the host's
 * fixtures render) match the chrome around them.
 */
export function themeVars(theme: ResolvedTheme): CSSProperties {
	return { colorScheme: theme };
}

const QUERY = "(prefers-color-scheme: dark)";

function subscribeToScheme(cb: () => void): () => void {
	if (typeof window === "undefined" || !window.matchMedia) return () => {};
	const mql = window.matchMedia(QUERY);
	mql.addEventListener("change", cb);
	return () => mql.removeEventListener("change", cb);
}

function schemeSnapshot(): ResolvedTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "light";
	return window.matchMedia(QUERY).matches ? "dark" : "light";
}

export function useResolvedTheme(setting: ThemeSetting | undefined): ResolvedTheme {
	const system = useSyncExternalStore(
		subscribeToScheme,
		schemeSnapshot,
		() => "light" as const,
	);
	if (setting === "light" || setting === "dark") return setting;
	return system;
}
