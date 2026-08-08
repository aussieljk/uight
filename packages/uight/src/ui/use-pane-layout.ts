/**
 * Pane widths and the inventory disclosure — §10.1, `ui/session.ts`.
 *
 * Every setter here writes through to session memory in the same call that
 * updates state. Splitting the two is how a resize survives until the next
 * reload and then quietly forgets itself.
 */

import { useCallback, useState } from "react";
import { CONTROL_PANEL_WIDTH, SIDEBAR_WIDTH } from "./constants.ts";
import type { ExplorerSession } from "./session.ts";

export interface PaneLayout {
	sidebarWidth: number;
	panelWidth: number;
	inventoryOpen: boolean;
	resizeSidebar: (width: number) => void;
	resizePanel: (width: number) => void;
	toggleInventory: () => void;
}

export function usePaneLayout(
	restored: ExplorerSession,
	remember: (patch: Partial<ExplorerSession>) => void,
): PaneLayout {
	const [sidebarWidth, setSidebarWidth] = useState(
		() => restored.sidebarWidth ?? SIDEBAR_WIDTH,
	);
	const [panelWidth, setPanelWidth] = useState(
		() => restored.panelWidth ?? CONTROL_PANEL_WIDTH,
	);
	const [inventoryOpen, setInventoryOpen] = useState(() => restored.inventoryOpen);

	const resizeSidebar = useCallback(
		(width: number) => {
			setSidebarWidth(width);
			remember({ sidebarWidth: width });
		},
		[remember],
	);
	const resizePanel = useCallback(
		(width: number) => {
			setPanelWidth(width);
			remember({ panelWidth: width });
		},
		[remember],
	);
	const toggleInventory = useCallback(() => {
		setInventoryOpen((open) => {
			remember({ inventoryOpen: !open });
			return !open;
		});
	}, [remember]);

	return {
		sidebarWidth,
		panelWidth,
		inventoryOpen,
		resizeSidebar,
		resizePanel,
		toggleInventory,
	};
}
