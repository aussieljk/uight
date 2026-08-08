/**
 * The ⌘K command palette.
 *
 * Everything the palette needs is derivable from the tree, the inventory and
 * the call sites, plus one piece of state that is not: the MRU list behind an
 * empty query. That list is persisted with the rest of the session so it
 * survives the reload a fixture edit causes, and a key naming something that no
 * longer exists is skipped by the ranker rather than repaired here — the index
 * is the authority on what exists, and a repair pass would only race it.
 */

import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
	CallSite,
	CallSiteGroup,
	CommandPaletteItem,
	FixtureId,
	InventoryItem,
	TreeNode,
} from "../shared/types.ts";
import { buildPaletteItems, rankPaletteItems } from "./palette.ts";
import { pushRecent } from "./session.ts";
import type { ExplorerSession } from "./session.ts";

/** How many ranked items the palette shows at once. */
const PALETTE_LIMIT = 50;

export interface CommandPalette {
	open: boolean;
	setOpen: Dispatch<SetStateAction<boolean>>;
	query: string;
	setQuery: (query: string) => void;
	items: CommandPaletteItem[];
	close: () => void;
	onSelect: (item: CommandPaletteItem) => void;
}

export interface CommandPaletteOptions {
	nodes: TreeNode[];
	inventory: InventoryItem[];
	callSites: CallSiteGroup[];
	restored: ExplorerSession;
	remember: (patch: Partial<ExplorerSession>) => void;
	select: (fixture: FixtureId) => void;
	selectComponent: (item: InventoryItem, site?: CallSite | null) => void;
}

export function useCommandPalette(options: CommandPaletteOptions): CommandPalette {
	const { nodes, inventory, callSites, restored, remember, select, selectComponent } =
		options;

	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [recents, setRecents] = useState<string[]>(() => restored.recents);

	const paletteItems = useMemo(
		() => buildPaletteItems({ nodes, inventory, callSites }),
		[nodes, inventory, callSites],
	);
	const items = useMemo(
		() => rankPaletteItems(paletteItems, query, PALETTE_LIMIT, recents),
		[paletteItems, query, recents],
	);

	const close = useCallback(() => {
		setOpen(false);
		setQuery("");
	}, []);

	const onSelect = useCallback(
		(item: CommandPaletteItem) => {
			close();
			setRecents((prev) => {
				const next = pushRecent(prev, item.key);
				remember({ recents: next });
				return next;
			});
			if (item.kind === "fixture" && item.fixture) {
				select(item.fixture);
				return;
			}
			if (item.component) selectComponent(item.component, item.callSite ?? null);
		},
		[close, select, selectComponent, remember],
	);

	return { open, setOpen, query, setQuery, items, close, onSelect };
}
