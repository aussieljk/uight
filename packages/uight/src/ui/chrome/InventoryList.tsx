/**
 * InventoryList — components detected without fixtures. Ejectable (§11.3).
 *
 * §12: grouped by directory so it reads as the same shape as the fixture tree,
 * and rendering happens on EXPLICIT selection only — never on expansion, never
 * in bulk, never on hover. Nothing in this file may render a detected
 * component; it reports a choice and stops there.
 */

import { Badge, Typography } from "ljkui";
import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { InventoryItem, InventoryListProps } from "../../shared/types.ts";
import { FOCUS_RING, MOTION, SECTION_LABEL, cx } from "../cx.ts";

function groupByDirectory(components: InventoryItem[]): Array<[string, InventoryItem[]]> {
	const groups = new Map<string, InventoryItem[]>();
	for (const item of components) {
		const dir = item.path.split("/").slice(0, -1).join("/");
		const list = groups.get(dir);
		if (list) list.push(item);
		else groups.set(dir, [item]);
	}
	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
	return [...groups]
		.sort((a, b) => collator.compare(a[0], b[0]))
		.map(([dir, items]) => [dir, items.sort((a, b) => collator.compare(a.name, b.name))]);
}

function itemKey(item: InventoryItem): string {
	return `${item.globPath}#${item.exportName}`;
}

export function InventoryList({
	components,
	onSelect,
}: InventoryListProps): ReactElement {
	const groups = useMemo(() => groupByDirectory(components), [components]);
	const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
	const [focusKey, setFocusKey] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);

	const move = (delta: number) => {
		if (!flat.length) return;
		const index = flat.findIndex((i) => itemKey(i) === focusKey);
		const next =
			flat[Math.max(0, Math.min(flat.length - 1, (index < 0 ? 0 : index) + delta))];
		if (!next) return;
		const key = itemKey(next);
		setFocusKey(key);
		listRef.current
			?.querySelector<HTMLElement>(`[data-item="${CSS.escape(key)}"]`)
			?.focus();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			move(1);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			move(-1);
		}
	};

	if (!components.length) return <div className="hidden" />;

	return (
		<div ref={listRef} onKeyDown={onKeyDown} className="pb-2">
			{groups.map(([dir, items]) => (
				<div key={dir || "."}>
					<Typography.Text
						render={<p />}
						size="1"
						className={cx(SECTION_LABEL, "truncate px-2 pt-2 pb-1")}
						title={dir || "root"}
					>
						{dir || "root"}
					</Typography.Text>
					{items.map((item) => {
						const key = itemKey(item);
						return (
							<button
								key={key}
								type="button"
								data-item={key}
								tabIndex={focusKey === null || focusKey === key ? 0 : -1}
								onFocus={() => setFocusKey(key)}
								onClick={() => onSelect(item)}
								title={`${item.path} — ${item.kind}`}
								className={cx(
									"flex h-6 w-full items-center gap-2 rounded-sm border-l-2 border-l-transparent px-2 text-left text-sm",
									"text-[var(--uight-muted)] hover:bg-[var(--uight-hover)] hover:text-[var(--uight-fg)]",
									FOCUS_RING,
									MOTION,
								)}
							>
								<span className="truncate">{item.name}</span>
								{item.kind !== "function" ? (
									<Badge size="1" variant="soft" color="gray" className="ml-auto shrink-0">
										{item.kind}
									</Badge>
								) : null}
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
}
