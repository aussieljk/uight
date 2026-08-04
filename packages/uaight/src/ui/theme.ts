/**
 * Theme tokens. SPEC.md §10.1.
 *
 * Monochrome plus ONE accent, used only for selection and focus. The palette
 * ships as custom properties set on the `.uaight-root` element rather than as
 * a media query, so `theme="system"` resolves in one place and a host that
 * forces a theme is honoured without a cascade fight.
 *
 * One font family, three sizes, two weights. No shadows.
 */

import { useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

export type ThemeSetting = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const FONT_STACK =
	'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const LIGHT: Record<string, string> = {
	"--u-bg": "#ffffff",
	"--u-bg-sunken": "#fafafa",
	"--u-bg-hover": "#f4f4f5",
	"--u-fg": "#18181b",
	"--u-fg-muted": "#71717a",
	"--u-fg-subtle": "#a1a1aa",
	"--u-line": "#e8e8ea",
	"--u-line-strong": "#d4d4d8",
	"--u-accent": "#2563eb",
	"--u-accent-fg": "#ffffff",
	"--u-accent-soft": "#eff4ff",
	"--u-danger": "#c62828",
	"--u-danger-soft": "#fdf2f2",
	"--u-canvas": "#f4f4f5",
};

const DARK: Record<string, string> = {
	"--u-bg": "#0c0c0e",
	"--u-bg-sunken": "#121215",
	"--u-bg-hover": "#1c1c21",
	"--u-fg": "#f4f4f5",
	"--u-fg-muted": "#a1a1aa",
	"--u-fg-subtle": "#71717a",
	"--u-line": "#26262b",
	"--u-line-strong": "#3a3a42",
	"--u-accent": "#6ea8fe",
	"--u-accent-fg": "#0c0c0e",
	"--u-accent-soft": "#17233a",
	"--u-danger": "#f87171",
	"--u-danger-soft": "#2a1717",
	"--u-canvas": "#08080a",
};

/**
 * Custom properties plus the two things every descendant inherits: the single
 * font family and the resolved colour scheme (so native widgets match).
 */
export function themeVars(theme: ResolvedTheme): CSSProperties {
	return {
		...(theme === "dark" ? DARK : LIGHT),
		fontFamily: FONT_STACK,
		colorScheme: theme,
	} as CSSProperties;
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
