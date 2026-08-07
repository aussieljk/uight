/**
 * The preview entry (SPEC §6.4). This module executes **inside the frame
 * realm**, once, before any fixture renders. It is where a consumer declares
 * what fixtures need in order to look and behave like they do in the real app:
 * global CSS and app-wide providers.
 *
 * It is the frame-realm counterpart to ljkui's own
 * `.storybook/preview.tsx` global decorator, which wraps every story in
 * `<Theme accentColor="blue" grayColor="gray" appearance={theme}>` and renders
 * a `<Toaster />` alongside it. uight declines to read Storybook's global
 * decorators (§13: `globalDecorators: false`) precisely because they are a
 * Storybook-runtime concept; reproducing the wrapper here is the supported
 * equivalent, and it is four lines.
 *
 * Two rules this file exists to demonstrate:
 *
 * 1. **Nothing is constructed per render.** The appearance store below is
 *    module scope. Building it inside `Preview` would hand every render a new
 *    subscription and reset fixture state on each commit.
 * 2. **Providers belong here, decorators do not.** `Preview` runs once per
 *    frame realm; decorators (§3.3) run per fixture render. `Theme` must not
 *    remount when you click a different story, so it lives here.
 */

import "ljkui/styles.css";
// ljkui's icons are a registry, not a set of files: `Icons.Bell` draws
// whatever the registered adapter provides. This side-effect import is what
// registers one — swap it for `ljkui/icons/phosphor` and every icon changes.
import "ljkui/icons/lucide";
import "./uight.preview.css";

import { Theme, Toaster } from "ljkui";
import * as React from "react";

type Appearance = "light" | "dark";

/**
 * Storybook drove ljkui's `appearance` from a toolbar global. uight has
 * no equivalent in the frozen chrome API (§19.3), so the frame reads its own
 * environment instead: an explicit theme attribute if the host stamped one on
 * the frame document, otherwise the OS preference. Both are observed, so the
 * fixtures follow a theme change without a reload.
 */
function readAppearance(): Appearance {
	if (typeof document === "undefined") return "light";
	const root = document.documentElement;
	const explicit = root.dataset.uightTheme ?? root.dataset.theme;
	if (explicit === "light" || explicit === "dark") return explicit;
	if (root.classList.contains("dark")) return "dark";
	if (root.classList.contains("light")) return "light";
	return typeof matchMedia === "function" &&
		matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function subscribeToAppearance(onChange: () => void): () => void {
	if (typeof document === "undefined") return () => {};

	const media = matchMedia("(prefers-color-scheme: dark)");
	media.addEventListener("change", onChange);

	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "data-theme", "data-uight-theme"],
	});

	return () => {
		media.removeEventListener("change", onChange);
		observer.disconnect();
	};
}

/** `readAppearance` returns a primitive, so it is safe as a snapshot getter. */
function useAppearance(): Appearance {
	return React.useSyncExternalStore(
		subscribeToAppearance,
		readAppearance,
		() => "light" as const,
	);
}

export function Preview({ children }: { children: React.ReactNode }) {
	const appearance = useAppearance();

	return (
		<Theme accentColor="blue" grayColor="gray" appearance={appearance}>
			{children}
			<Toaster />
		</Theme>
	);
}
