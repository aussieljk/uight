/**
 * The default chrome, and how `props.components` replaces it. SPEC.md §11.
 *
 * Every item in §11.3's ejectable list is one file and one entry here.
 * `ControlPanelInputs` is ejectable too but is not a member of the frozen
 * `UaightComponents` type, so it is accepted as an extra key at runtime and
 * typed here rather than in `shared/types.ts`, which we do not own.
 */

import type { ComponentType } from "react";
import type { UaightComponents } from "../../shared/types.ts";
import { ControlPanel } from "./ControlPanel.tsx";
import { ControlPanelInputs } from "./ControlPanelInputs.tsx";
import type { ControlPanelInputsProps } from "./ControlPanelInputs.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ErrorState } from "./ErrorState.tsx";
import { FixtureTree } from "./FixtureTree.tsx";
import { InventoryList } from "./InventoryList.tsx";
import { PreviewShell } from "./PreviewShell.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { ViewportToolbar } from "./ViewportToolbar.tsx";

export interface UaightChromeSet extends UaightComponents {
	ControlPanelInputs: ComponentType<ControlPanelInputsProps>;
}

export const DEFAULT_COMPONENTS: UaightChromeSet = {
	PreviewShell,
	FixtureTree,
	ControlPanel,
	ControlPanelInputs,
	Toolbar,
	ViewportToolbar,
	EmptyState,
	ErrorState,
	InventoryList,
};

export function resolveComponents(
	...overrides: Array<Partial<UaightChromeSet> | undefined>
): UaightChromeSet {
	let set = DEFAULT_COMPONENTS;
	for (const override of overrides) {
		if (override) set = { ...set, ...override };
	}
	return set;
}
