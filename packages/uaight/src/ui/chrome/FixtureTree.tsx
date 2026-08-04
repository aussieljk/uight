/**
 * FixtureTree — hierarchical navigation. Ejectable (§11.3).
 *
 * Reads `useUaightChrome().fixtureTree` for expansion and search, and reports
 * selection through `onSelect` — the contract the registry item advertises
 * (§11.2), and the reason the facade is what freezes rather than these props.
 *
 * Keyboard-first (§10.1): every row is reachable with arrows alone, there is a
 * single tab stop, and nothing is hover-only. `component` nodes are skipped
 * here; detected components are navigated by `InventoryList`, whose props can
 * express selecting one.
 *
 * ── Why it is virtualized ───────────────────────────────────────────────────
 * Normally the flat row list is small: files are leaves, so a collapsed corpus
 * is a few dozen rows. Search is the exception and it is not a rare one —
 * searching sets `forceOpen`, which expands *everything* including every file's
 * fixtures, so the demo's 591 fixtures across 82 files become hundreds of rows
 * rendered on every keystroke. Capping the results with a "47 more" row was the
 * alternative and was rejected: the row a user is hunting for is as likely to
 * be 60th as 6th, and a search that hides matches is worse than a slow one.
 *
 * So the list is windowed, above a threshold the non-search case never reaches.
 * The window is arithmetic on a fixed row height — no dependency, no
 * measurement pass — and the padding standing in for the rows outside it goes
 * on the scroll container itself rather than on spacer elements, because
 * `role="tree"` owns its `treeitem` children and a spacer `div` between them
 * would be a stranger in that relationship.
 *
 * Everything the keyboard contract needs survives: `aria-level` is computed
 * rather than counted from the DOM; `aria-setsize` / `aria-posinset` are stated,
 * because a windowed list cannot be counted from the DOM at all; and both
 * roving focus and scroll-on-selection go through the scroll offset rather than
 * through an element that may not currently exist.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import { fixtureIdsEqual, serializeFixtureId } from "../../shared/fixture-id.ts";
import type { FixtureTreeProps, TreeNode } from "../../shared/types.ts";
import { useUaightChrome } from "../chrome-context.ts";
import { FOCUS_RING, MOTION, SELECTABLE, SELECTED, cx } from "../cx.ts";

interface Row {
	node: TreeNode;
	depth: number;
	/** Key of the row above at depth - 1. */
	parent: string | null;
	group: boolean;
	open: boolean;
}

/** `h-6`. Rows are a fixed height by design, which is what makes the arithmetic. */
const ROW_HEIGHT = 24;

/** At or below this many rows everything renders and the window code is inert. */
export const VIRTUALIZE_ABOVE = 120;

/** Rows kept rendered past each edge, so a fast scroll never shows a gap. */
const OVERSCAN = 8;

function isGroup(node: TreeNode): boolean {
	return Array.isArray(node.children) && node.children.length > 0;
}

function flatten(
	nodes: readonly TreeNode[],
	expanded: ReadonlySet<string>,
	forceOpen: boolean,
	depth = 0,
	parent: string | null = null,
	out: Row[] = [],
): Row[] {
	for (const node of nodes) {
		if (node.kind === "component") continue;
		// A file is a leaf: selecting it renders every fixture in it as one page,
		// and the individual fixtures are listed in the toolbar rather than nested
		// here. While searching they do appear, so a fixture can still be found
		// and selected by name.
		const group = isGroup(node) && !(node.kind === "file" && !forceOpen);
		const open = group && (forceOpen || expanded.has(node.key));
		out.push({ node, depth, parent, group, open });
		if (group && open) {
			flatten(node.children ?? [], expanded, forceOpen, depth + 1, node.key, out);
		}
	}
	return out;
}

/** The half-open row range to render at a scroll position. Pure, so it is tested. */
export function windowRange(
	total: number,
	scrollTop: number,
	viewportHeight: number,
	rowHeight = ROW_HEIGHT,
	overscan = OVERSCAN,
): { start: number; end: number } {
	if (total <= VIRTUALIZE_ABOVE) return { start: 0, end: total };
	const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
	const visible = Math.ceil(Math.max(rowHeight, viewportHeight) / rowHeight);
	const start = Math.max(0, Math.min(total, first - overscan));
	const end = Math.min(total, first + visible + overscan);
	return { start, end: Math.max(start, end) };
}

function Chevron({ open }: { open: boolean }): ReactElement {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className={cx(
				"size-3 shrink-0 fill-current text-[var(--u-fg-subtle)]",
				"motion-safe:transition-transform motion-safe:duration-100",
				open ? "rotate-90" : "",
			)}
		>
			<path d="M4.5 2.5 8 6l-3.5 3.5z" />
		</svg>
	);
}

export function FixtureTree({
	nodes,
	selected,
	onSelect,
	search = true,
}: FixtureTreeProps): ReactElement {
	const chrome = useUaightChrome();
	const [query, setQuery] = useState("");
	const [focusKey, setFocusKey] = useState<string | null>(null);
	const rowRefs = useRef(new Map<string, HTMLElement>());
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	/** A key whose row has to take focus as soon as the window contains it. */
	const pendingFocus = useRef<string | null>(null);

	const visible = useMemo(
		() => (query.trim() ? chrome.fixtureTree.search(query) : nodes),
		// `search` is a pure function of the tree; re-running it on every tree
		// change is what keeps HMR topology changes visible.
		[query, nodes, chrome.fixtureTree],
	);

	const rows = useMemo(
		() => flatten(visible, chrome.fixtureTree.expanded, query.trim().length > 0),
		[visible, chrome.fixtureTree.expanded, query],
	);

	const selectedKey = selected ? serializeFixtureId(selected) : null;

	useEffect(() => {
		const el = scrollRef.current;
		if (!el || typeof ResizeObserver === "undefined") {
			// No observer: render a generous window rather than none at all.
			setViewportHeight((height) => (height === 0 ? 640 : height));
			return;
		}
		const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
		observer.observe(el);
		setViewportHeight(el.clientHeight);
		return () => observer.disconnect();
	}, []);

	const { start, end } = windowRange(rows.length, scrollTop, viewportHeight);
	const windowed = rows.slice(start, end);

	/**
	 * Bring a row into view by index rather than by element: outside the window
	 * there is no element to call `scrollIntoView` on, and inside it the two
	 * answers are the same one.
	 */
	const revealIndex = useCallback((index: number) => {
		const el = scrollRef.current;
		if (!el || index < 0) return;
		const top = index * ROW_HEIGHT;
		const bottom = top + ROW_HEIGHT;
		if (top < el.scrollTop) el.scrollTop = top;
		else if (bottom > el.scrollTop + el.clientHeight) {
			el.scrollTop = bottom - el.clientHeight;
		}
	}, []);

	// Keep the selected row on screen when selection moves without the mouse.
	useEffect(() => {
		if (!selectedKey) return;
		const index = rows.findIndex((row) => row.node.key === selectedKey);
		if (index >= 0) revealIndex(index);
	}, [selectedKey, rows, revealIndex]);

	// Focus follows the window: `focusRow` can name a row that is not rendered
	// yet, so the `.focus()` itself happens on the render where it is.
	useLayoutEffect(() => {
		const key = pendingFocus.current;
		if (!key) return;
		const el = rowRefs.current.get(key);
		if (!el) return;
		pendingFocus.current = null;
		el.focus();
	});

	const focusRow = (key: string | null) => {
		if (!key) return;
		setFocusKey(key);
		revealIndex(rows.findIndex((row) => row.node.key === key));
		const el = rowRefs.current.get(key);
		if (el) el.focus();
		else pendingFocus.current = key;
	};

	const activate = (row: Row) => {
		if (row.group) chrome.fixtureTree.toggle(row.node.key);
		else if (row.node.fixture) onSelect(row.node.fixture);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const index = rows.findIndex((r) => r.node.key === focusKey);
		const row = index >= 0 ? rows[index] : undefined;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				focusRow(rows[Math.min(rows.length - 1, index + 1)]?.node.key ?? null);
				return;
			case "ArrowUp":
				event.preventDefault();
				focusRow(rows[Math.max(0, index - 1)]?.node.key ?? null);
				return;
			case "Home":
				event.preventDefault();
				focusRow(rows[0]?.node.key ?? null);
				return;
			case "End":
				event.preventDefault();
				focusRow(rows[rows.length - 1]?.node.key ?? null);
				return;
			case "ArrowRight":
				if (!row) return;
				event.preventDefault();
				if (row.group && !row.open) chrome.fixtureTree.toggle(row.node.key);
				else if (row.group) focusRow(rows[index + 1]?.node.key ?? null);
				return;
			case "ArrowLeft":
				if (!row) return;
				event.preventDefault();
				if (row.group && row.open) chrome.fixtureTree.toggle(row.node.key);
				else focusRow(row.parent);
				return;
			case "Enter":
			case " ":
				if (!row) return;
				event.preventDefault();
				activate(row);
				return;
			default:
				return;
		}
	};

	const tabbableKey = focusKey ?? selectedKey ?? rows[0]?.node.key ?? null;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{search ? (
				<div className="shrink-0 px-2 pb-2">
					<input
						// Matches SEARCH_ATTR — how the `/` shortcut finds this mount's box.
						data-uaight-search=""
						type="search"
						value={query}
						placeholder="Search"
						aria-label="Search fixtures"
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault();
								if (query) setQuery("");
								else focusRow(tabbableKey);
							} else if (e.key === "ArrowDown") {
								e.preventDefault();
								focusRow(rows[0]?.node.key ?? null);
							} else if (e.key === "Enter") {
								e.preventDefault();
								const first = rows.find((r) => !r.group && r.node.fixture);
								if (first) activate(first);
							}
						}}
						className={cx(
							"h-7 w-full rounded-sm border border-[var(--u-line)] bg-[var(--u-bg)] px-2",
							"text-sm text-[var(--u-fg)] placeholder:text-[var(--u-fg-subtle)]",
							"[&::-webkit-search-cancel-button]:hidden",
							FOCUS_RING,
							MOTION,
						)}
					/>
				</div>
			) : null}

			<div
				ref={scrollRef}
				role="tree"
				aria-label="Fixtures"
				onKeyDown={onKeyDown}
				onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
				// The rows outside the window are represented as padding on this
				// element, so `role="tree"` goes on owning every `treeitem` directly.
				style={{
					paddingTop: start * ROW_HEIGHT,
					paddingBottom: Math.max(0, rows.length - end) * ROW_HEIGHT,
				}}
				className="uaight-scroll min-h-0 flex-1 px-1"
			>
				{rows.length === 0 ? (
					<p className="px-2 py-3 text-xs text-[var(--u-fg-subtle)]">
						{query.trim() ? "No match." : "No fixtures."}
					</p>
				) : null}

				{windowed.map((row, offset) => {
					const { node } = row;
					const index = start + offset;
					const isSelected =
						!row.group && !!node.fixture && fixtureIdsEqual(node.fixture, selected);
					return (
						<div
							key={node.key}
							ref={(el) => {
								if (el) rowRefs.current.set(node.key, el);
								else rowRefs.current.delete(node.key);
							}}
							role="treeitem"
							aria-level={row.depth + 1}
							// Stated rather than inferred: a windowed list has fewer DOM
							// children than rows, so nothing could count them correctly.
							aria-setsize={rows.length}
							aria-posinset={index + 1}
							aria-selected={row.group ? undefined : isSelected}
							aria-expanded={row.group ? row.open : undefined}
							tabIndex={node.key === tabbableKey ? 0 : -1}
							onFocus={() => setFocusKey(node.key)}
							onClick={() => {
								setFocusKey(node.key);
								activate(row);
							}}
							style={{ paddingLeft: 4 + row.depth * 12 }}
							title={node.fixture?.path ?? node.label}
							className={cx(
								"flex h-6 cursor-pointer items-center gap-1 rounded-sm pr-2 text-sm select-none",
								SELECTABLE,
								isSelected
									? SELECTED
									: row.group
										? "text-[var(--u-fg-muted)] hover:bg-[var(--u-bg-hover)]"
										: "text-[var(--u-fg)] hover:bg-[var(--u-bg-hover)]",
								FOCUS_RING,
								MOTION,
							)}
						>
							{row.group ? <Chevron open={row.open} /> : <span className="size-3 shrink-0" />}
							<span className="truncate">{node.label}</span>
							{node.undecidable ? (
								// §3.5 — one node until the module is loaded.
								<span
									aria-label="Names not statically known"
									title="This file's fixture names could not be read without running it. Select it to load the module."
									className="ml-auto shrink-0 text-xs text-[var(--u-fg-subtle)]"
								>
									…
								</span>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}
