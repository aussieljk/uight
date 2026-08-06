/**
 * The default chrome, and how `props.components` replaces it. SPEC.md §11.
 *
 * Every item in §11.3's ejectable list is one file and one entry here, and
 * every one of them is now a member of `UightComponents` with its props type
 * in `shared/types.ts` — `ControlPanelInputs` and `PropTable` were the two that
 * were not, which made them ejectable at runtime and rejected by the type
 * check. `UightChromeSet` survives as an alias so the internal call sites that
 * name it keep working.
 */

import type { UightComponents } from "../../shared/types.ts";
import { CommandPalette } from "./CommandPalette.tsx";
import { ControlPanel } from "./ControlPanel.tsx";
import { ControlPanelInputs } from "./ControlPanelInputs.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ErrorState } from "./ErrorState.tsx";
import { FixtureTree } from "./FixtureTree.tsx";
import { InventoryList } from "./InventoryList.tsx";
import { PropTable } from "./PropTable.tsx";
import { PreviewShell } from "./PreviewShell.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { ViewportToolbar } from "./ViewportToolbar.tsx";

export type UightChromeSet = UightComponents;

export const DEFAULT_COMPONENTS: UightChromeSet = {
	PreviewShell,
	FixtureTree,
	ControlPanel,
	ControlPanelInputs,
	Toolbar,
	ViewportToolbar,
	EmptyState,
	ErrorState,
	InventoryList,
	CommandPalette,
	PropTable,
};

export function resolveComponents(
	...overrides: Array<Partial<UightChromeSet> | undefined>
): UightChromeSet {
	let set = DEFAULT_COMPONENTS;
	for (const override of overrides) {
		if (override) set = { ...set, ...override };
	}
	return set;
}
