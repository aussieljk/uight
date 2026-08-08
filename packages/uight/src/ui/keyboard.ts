/**
 * Keyboard shortcuts — §10.1.
 *
 * Every shortcut here is scoped to the mount, never to the document. An
 * embedded explorer sharing a page with its host must not take ⌘K, `/` or `?`
 * away from it, and a `document` listener cannot make that distinction.
 *
 * Lifted out of the component as a plain function over an explicit dependency
 * bag: the routing is the interesting part, it is pure apart from the callbacks
 * it is handed, and in that shape it can be exercised without mounting an
 * explorer.
 */

import type { KeyboardEvent, RefObject } from "react";
import { SEARCH_ATTR } from "./constants.ts";

export interface KeyboardDeps {
	rootRef: RefObject<HTMLDivElement | null>;
	/** Move the selection through the flattened tree. */
	step: (delta: number) => void;
	/** Move through the current fixture's variants, when it has any. */
	stepVariant: (delta: number) => void;
	variants: boolean;
	/** Compact layout keeps search inside the drawer, so `/` has to open it. */
	compact: boolean;
	drawerOpen: boolean;
	setDrawerOpen: (open: boolean) => void;
	helpOpen: boolean;
	setHelpOpen: (update: (open: boolean) => boolean) => void;
	togglePalette: () => void;
	gridSupported: boolean;
	setGridOpen: (update: (open: boolean) => boolean) => void;
	hasOverlays: boolean;
	resetInput: () => void;
}

export function handleKeyDown(
	event: KeyboardEvent<HTMLDivElement>,
	deps: KeyboardDeps,
): void {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		deps.togglePalette();
		return;
	}
	if (event.metaKey || event.ctrlKey || event.altKey) return;

	const element = event.target as HTMLElement | null;
	const typing = !!element?.closest?.("input, textarea, select, [contenteditable='true']");

	if (event.key === "Escape" && deps.helpOpen) {
		event.preventDefault();
		deps.setHelpOpen(() => false);
		return;
	}
	if (event.key === "Escape" && deps.drawerOpen) {
		event.preventDefault();
		deps.setDrawerOpen(false);
		return;
	}
	if (typing) return;
	// The tree owns arrows while focus is inside it — there they rove and
	// expand — and it has already called preventDefault on the ones it took.
	if (event.defaultPrevented) return;

	switch (event.key) {
		case "ArrowDown":
			event.preventDefault();
			deps.step(1);
			return;
		case "ArrowUp":
			event.preventDefault();
			deps.step(-1);
			return;
		case "ArrowRight":
			if (!deps.variants) return;
			event.preventDefault();
			deps.stepVariant(1);
			return;
		case "ArrowLeft":
			if (!deps.variants) return;
			event.preventDefault();
			deps.stepVariant(-1);
			return;
		case "/":
			event.preventDefault();
			// Compact: the search box lives in the drawer, so open it first. The
			// input is not in the DOM until that has painted.
			if (deps.compact) deps.setDrawerOpen(true);
			requestAnimationFrame(() =>
				deps.rootRef.current?.querySelector<HTMLInputElement>(`[${SEARCH_ATTR}]`)?.focus(),
			);
			return;
		case "?":
			event.preventDefault();
			deps.setHelpOpen((v) => !v);
			return;
		case "j":
			event.preventDefault();
			deps.step(1);
			return;
		case "k":
			event.preventDefault();
			deps.step(-1);
			return;
		case "r":
			if (deps.hasOverlays) {
				event.preventDefault();
				deps.resetInput();
			}
			return;
		case "g":
			if (!deps.gridSupported) return;
			event.preventDefault();
			deps.setGridOpen((v) => !v);
			return;
		default:
			return;
	}
}
