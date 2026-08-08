/**
 * Theme resolution — §10.1.
 *
 * The palette is ljkui's: `<Theme>` writes the scales onto its own element and
 * flips them with a `.light` / `.dark` class, and `styles/uight.css` maps our
 * `--uight-*` tokens onto those scales. The one thing ljkui cannot do for us is
 * `theme="system"` — its `appearance="inherit"` inherits from *the host's*
 * document, a different question from "what does this user's OS prefer", and a
 * host that never set an appearance would leave the explorer light on a dark
 * desktop. So we answer the media query ourselves and hand `<Theme>` a concrete
 * appearance.
 */

import { useSyncExternalStore } from "react";
import type { ResolvedUightTheme, ThemeSetting } from "../shared/types.ts";

const SCHEME_QUERY = "(prefers-color-scheme: dark)";

function subscribeToScheme(cb: () => void): () => void {
	if (typeof window === "undefined" || !window.matchMedia) return () => {};
	const mql = window.matchMedia(SCHEME_QUERY);
	mql.addEventListener("change", cb);
	return () => mql.removeEventListener("change", cb);
}

function schemeSnapshot(): ResolvedUightTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "light";
	return window.matchMedia(SCHEME_QUERY).matches ? "dark" : "light";
}

export function useResolvedTheme(setting: ThemeSetting | undefined): ResolvedUightTheme {
	const system = useSyncExternalStore(
		subscribeToScheme,
		schemeSnapshot,
		() => "light" as const,
	);
	if (setting === "light" || setting === "dark") return setting;
	return system;
}
