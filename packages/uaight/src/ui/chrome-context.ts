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
