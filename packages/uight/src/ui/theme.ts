/**
 * Theme tokens. SPEC.md §10.1.
 *
 * Monochrome plus ONE accent, used only for selection and focus. The palette
 * ships as custom properties set on the `.uight-root` element rather than as
 * a media query, so `theme="system"` resolves in one place and a host that
 * forces a theme is honoured without a cascade fight.
 *
 * Every grey is a step of Tailwind's `neutral` ramp, verbatim; the accent is
 * Tailwind `blue` and danger is Tailwind `red`. Keep these in step with
 * `styles/uight.css` and `styles/chrome-tokens.css`, which say the same thing
 * for the packaged and the ejected build.
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
	"--u-bg-hover": "#f5f5f5",
	"--u-fg": "#171717",
	"--u-fg-muted": "#737373",
	"--u-fg-subtle": "#a3a3a3",
	"--u-line": "#e5e5e5",
	"--u-line-strong": "#d4d4d4",
	"--u-accent": "#2563eb",
	"--u-accent-fg": "#ffffff",
	"--u-accent-soft": "#eff6ff",
	"--u-danger": "#b91c1c",
	"--u-danger-soft": "#fef2f2",
	"--u-canvas": "#f5f5f5",
};

const DARK: Record<string, string> = {
	"--u-bg": "#0a0a0a",
	"--u-bg-sunken": "#171717",
	"--u-bg-hover": "#262626",
	"--u-fg": "#f5f5f5",
	"--u-fg-muted": "#a3a3a3",
	"--u-fg-subtle": "#737373",
	"--u-line": "#262626",
	"--u-line-strong": "#404040",
	"--u-accent": "#60a5fa",
	"--u-accent-fg": "#0a0a0a",
	"--u-accent-soft": "#172554",
	"--u-danger": "#f87171",
	"--u-danger-soft": "#450a0a",
	"--u-canvas": "#000000",
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
