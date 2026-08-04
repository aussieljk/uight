/**
 * The frozen chrome facade. SPEC.md §19.3, §11.4.
 *
 * This module is deliberately tiny and imports nothing but React and the
 * shared types: `uaight/chrome` re-exports it, and a consumer importing the
 * facade must not pull the explorer in behind it.
 *
 * The surface freezes at v1.2 — implementation detail must not leak into it.
 */

import { createContext, useContext } from "react";
import type {
	CallSite,
	CallSiteGroup,
	CommandPaletteItem,
	ComponentSelection,
	DroppedPatchReport,
	EditableWire,
	FixtureId,
	InputOverlay,
	InventoryItem,
	PathSegment,
	RegisteredInput,
	RendererError,
	TreeNode,
	ViewportPreset,
} from "../shared/types.ts";

export interface UaightChromeApiV1 {
	fixtureTree: {
		nodes: TreeNode[];
		expanded: ReadonlySet<string>;
		toggle(path: string): void;
		search(q: string): TreeNode[];
	};
	inventory: { components: InventoryItem[]; enabled: boolean };
	selection: {
		current: FixtureId | null;
		select(id: FixtureId | null): void;
		next(): void;
		previous(): void;
	};
	/**
	 * §12's detected components, which `selection` cannot express: an
	 * `InventoryItem` has no fixture file, so it has no `FixtureId`, and
	 * `select(id: FixtureId | null)` can neither carry it nor carry the call site
	 * chosen for it. A sibling group rather than a widened `selection`, because
	 * the two are genuinely different selections and widening the one method
	 * would make every chrome component destructure a union to ask "which?".
	 *
	 * Selecting a component clears `selection.current`, and vice versa: one thing
	 * renders in the preview.
	 */
	component: {
		current: ComponentSelection | null;
		/** `null` clears the component selection without selecting a fixture. */
		select(component: InventoryItem | null, callSite?: CallSite | null): void;
		/** Harvested usages, grouped by component name. Empty when off. */
		callSites: CallSiteGroup[];
	};
	/**
	 * The palette is the one chrome component that needs the *whole* catalogue —
	 * fixtures, components and call sites ranked together — and it is ejectable,
	 * so a *replacement* mounted somewhere the packaged layout does not pass
	 * props must be able to get it from here. `items` is already filtered and
	 * ranked against `query`, exactly as `CommandPaletteProps` receives it.
	 *
	 * The overlap with `CommandPaletteProps` and `InventoryListProps` is
	 * deliberate and permanent — NOTES.md, "Two ways to the same data". A copy
	 * ejected per §11.3 should prefer its props; this facade is the escape hatch
	 * for a component that needs more than its props carry, and using it costs
	 * the ability to render outside an explorer.
	 */
	palette: {
		open: boolean;
		setOpen(open: boolean): void;
		query: string;
		setQuery(query: string): void;
		items: CommandPaletteItem[];
		select(item: CommandPaletteItem): void;
	};
	inputs: {
		registered: RegisteredInput[];
		overlay: InputOverlay[];
		set(name: string, path: PathSegment[], value: EditableWire): void;
		reset(name?: string): void;
	};
	viewport: {
		current: ViewportPreset | null;
		presets: ViewportPreset[];
		set(p: ViewportPreset | null): void;
		supported: boolean;
	};
	status: {
		loading: boolean;
		error: RendererError | null;
		isolation: "frame" | "inline";
		droppedPatches: number;
		/** The same loss, named per input (§7.3). `droppedPatches` is its total. */
		droppedInputs: DroppedPatchReport[];
	};
}

export const UaightChromeContext = createContext<UaightChromeApiV1 | null>(null);

export function useUaightChrome(): UaightChromeApiV1 {
	const api = useContext(UaightChromeContext);
	if (!api) {
		throw new Error(
			"[uaight] useUaightChrome() was called outside <Uaight />. Chrome components " +
				"read the explorer's state from the mount that renders them, so they have to " +
				"be rendered by one — pass them through <Uaight components={{ … }} /> (or " +
				"UaightProvider) rather than mounting them yourself.",
		);
	}
	return api;
}
