/**
 * Constants shared across the explorer chrome.
 *
 * SPEC.md §6.2 (frame document), §6.5 (viewport), §10.1 (design), §12 (inventory).
 */

import type { ViewportPreset } from "../shared/types.ts";

/* ------------------------------------------------------------------ *
 * Frame document — §6.2
 * ------------------------------------------------------------------ */

/** The element the renderer mounts into, inside the frame document. */
export const FRAME_ROOT_ID = "uaight-root";

/**
 * A `.uaight-root` sibling written into the frame document. Renderer-side
 * chrome (error panels, notices) can render into it and pick up our scoped
 * stylesheet without putting our reset on an ancestor of the fixture itself.
 */
export const FRAME_CHROME_ID = "uaight-frame-chrome";

/** Marks the injected `<style>` so we inject once per document (§10.3). */
export const STYLE_MARKER = "data-uaight-styles";

/** Every element we render lives under this class; the compiled CSS is scoped to it. */
export const ROOT_CLASS = "uaight-root";

/** Attribute used to find this mount's search box for the `/` shortcut. */
export const SEARCH_ATTR = "data-uaight-search";

/* ------------------------------------------------------------------ *
 * Viewport — §6.5
 * ------------------------------------------------------------------ */

export const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
	{ name: "Small", width: 320, height: 568 },
	{ name: "Mobile", width: 375, height: 667 },
	{ name: "Tablet", width: 768, height: 1024 },
	{ name: "Laptop", width: 1280, height: 800 },
	{ name: "Desktop", width: 1536, height: 960 },
];

/* ------------------------------------------------------------------ *
 * Pane geometry — §10.1
 *
 * The two side panes were fixed at `w-60` and `w-72`, which is a reasonable
 * default and an unreasonable law: a deep `components/forms/fields/…` path
 * truncates in the tree and a `variant` select with long option labels wraps in
 * the panel, and "make it wider" did not exist. These are now the *starting*
 * widths and the bounds a drag or an arrow key moves between; the chosen width
 * lives in `ui/session.ts` for the tab.
 * ------------------------------------------------------------------ */

/** `w-60`, as a number, because the pane is now a style rather than a class. */
export const SIDEBAR_WIDTH = 240;
/** `w-72`. */
export const CONTROL_PANEL_WIDTH = 288;
export const PANE_MIN_WIDTH = 160;
export const PANE_MAX_WIDTH = 640;

/** Why viewport controls do nothing inline (§5.2, §6.5). */
export const VIEWPORT_INLINE_REASON =
	"Viewport presets need a separate realm. Inline, width is only a CSS box and the fixture's media queries still measure the page. Switch to frame isolation to use them.";

/* ------------------------------------------------------------------ *
 * Inventory — §12
 * ------------------------------------------------------------------ */

/** Used VERBATIM in the UI. Do not paraphrase, shorten or re-wrap the meaning. */
export const INVENTORY_SAFETY_NOTICE =
	"Rendering runs your component's real code. Frame isolation contains DOM, CSS and global listeners. It does not contain network requests, storage, cookies or backend effects.";

/**
 * Where the acknowledgement of that notice is remembered.
 *
 * It used to be `localStorage`, so the notice appeared once per browser and
 * then never again — and what it warns about is that rendering a detected
 * component executes real code with real network, storage and backend effects.
 * That is not a "got it" you make permanently on someone's behalf: the second
 * time is a different project, a different corpus and, months later, a
 * different person at the keyboard. It is now per TAB and shown on the first
 * detected component actually rendered, which is the moment it describes rather
 * than a banner at the top of an explorer nobody has clicked anything in yet.
 */
export const INVENTORY_NOTICE_KEY = "uaight:inventory-notice";

/* ------------------------------------------------------------------ *
 * Keyboard map — §10.1. Keyboard-first, no hover-only affordances.
 * ------------------------------------------------------------------ */

export const KEYMAP: ReadonlyArray<{ keys: string; action: string }> = [
	{ keys: "⌘K · Ctrl K", action: "Find any fixture, component or usage" },
	{ keys: "/", action: "Focus search" },
	{ keys: "Esc", action: "Clear search, return focus to the tree" },
	{ keys: "↓  ·  ↑", action: "Load the next / previous fixture" },
	{ keys: "→  ·  ←", action: "Next / previous variant of this file" },
	{ keys: "j  ·  k", action: "Same as ↓ and ↑" },
	{ keys: "Arrows in the tree", action: "Move focus, expand and collapse groups" },
	{ keys: "Home · End", action: "First / last row" },
	{ keys: "Enter · Space", action: "Select the focused row" },
	{ keys: "r", action: "Reset all controls — undoable from the status bar" },
	{ keys: "?", action: "Toggle this list" },
];
