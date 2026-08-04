/**
 * The command palette — ⌘K over everything selectable.
 *
 * The demo corpus is 591 fixtures across 82 files, and a tree is a haystack at
 * that size: `/` filters what is already on screen, but finding a component you
 * half-remember the name of means scrolling. This is the other half of the
 * keyboard story (§10.1, "keyboard-first, no hover-only affordances") — one
 * shortcut that reaches any fixture, any detected component, and any harvested
 * call site without touching the mouse.
 *
 * Filtering and ranking happen in `UaightUI` — including the recency blend, so
 * an empty ⌘K opens on what you were just looking at rather than on a static
 * alphabetical list. A replacement palette gets the ordered result and never
 * reimplements the matcher.
 *
 * The dialog shell — backdrop, Escape, focus trap, focus restore — is
 * `ui/Overlay.tsx`, shared with the keyboard help so the two surfaces cannot
 * drift into two dismissal models (§10.1).
 */

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { CommandPaletteItem, CommandPaletteProps } from "../../shared/types.ts";
import { FOCUS_RING, MOTION, SELECTABLE, SELECTED, cx } from "../cx.ts";
import { Overlay } from "../Overlay.tsx";

const KIND_LABEL: Record<CommandPaletteItem["kind"], string> = {
	fixture: "fixture",
	component: "component",
	"call-site": "usage",
};

export function CommandPalette(props: CommandPaletteProps): ReactElement | null {
	const { open, items, query, onQueryChange, onSelect, onClose } = props;
	const [active, setActive] = useState(0);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);

	// A new query means a new list; keeping the old index would leave the
	// highlight on whatever happens to be in that position now.
	useEffect(() => {
		setActive(0);
	}, [query]);

	useEffect(() => {
		if (open) inputRef.current?.focus();
	}, [open]);

	// Keep the highlighted row in view when the arrows walk past the fold.
	useEffect(() => {
		if (!open) return;
		const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
		row?.scrollIntoView({ block: "nearest" });
	}, [active, open]);

	const commit = (index: number): void => {
		const item = items[index];
		if (item) onSelect(item);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setActive((i) => (items.length ? (i + 1) % items.length : 0));
				return;
			case "ArrowUp":
				event.preventDefault();
				setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
				return;
			case "Home":
				event.preventDefault();
				setActive(0);
				return;
			case "End":
				event.preventDefault();
				setActive(Math.max(0, items.length - 1));
				return;
			case "Enter":
				event.preventDefault();
				commit(active);
				return;
			default:
				// Escape and the focus trap belong to the overlay, which handles
				// everything this switch leaves alone.
				return;
		}
	};

	return (
		<Overlay
			open={open}
			label="Find a fixture or component"
			onClose={onClose}
			onKeyDown={onKeyDown}
		>
			<input
				ref={inputRef}
				value={query}
				onChange={(event) => onQueryChange(event.target.value)}
				placeholder="Find a fixture, component or usage…"
				aria-label="Search"
				aria-controls="uaight-palette-list"
				aria-activedescendant={items[active] ? `uaight-palette-${active}` : undefined}
				className="h-10 shrink-0 border-b border-[var(--u-line)] bg-transparent px-3 text-base text-[var(--u-fg)] outline-none placeholder:text-[var(--u-fg-subtle)]"
			/>

			<div
				ref={listRef}
				id="uaight-palette-list"
				role="listbox"
				className="uaight-scroll min-h-0 flex-1 py-1"
			>
				{items.length === 0 ? (
					<p className="px-3 py-6 text-center text-sm text-[var(--u-fg-subtle)]">
						Nothing matches “{query}”.
					</p>
				) : (
					items.map((item, index) => (
						<button
							key={item.key}
							id={`uaight-palette-${index}`}
							type="button"
							role="option"
							aria-selected={index === active}
							data-index={index}
							onMouseMove={() => setActive(index)}
							onClick={() => commit(index)}
							className={cx(
								"flex w-full items-baseline gap-2 px-3 py-1.5 text-left",
								SELECTABLE,
								index === active ? SELECTED : "text-[var(--u-fg)] hover:bg-[var(--u-bg-hover)]",
								FOCUS_RING,
								MOTION,
							)}
						>
							<span className="min-w-0 shrink truncate text-sm">{item.label}</span>
							{item.hint ? (
								<span className="min-w-0 flex-1 truncate text-xs text-[var(--u-fg-subtle)]">
									{item.hint}
								</span>
							) : (
								<span className="flex-1" />
							)}
							<span className="shrink-0 text-xs tracking-wide text-[var(--u-fg-subtle)] uppercase">
								{KIND_LABEL[item.kind]}
							</span>
						</button>
					))
				)}
			</div>

			<div className="flex shrink-0 items-center gap-3 border-t border-[var(--u-line)] px-3 py-1.5 text-xs text-[var(--u-fg-subtle)]">
				<span>↑↓ move</span>
				<span>↵ open</span>
				<span>esc close</span>
				<span className="ml-auto tabular-nums">{items.length}</span>
			</div>
		</Overlay>
	);
}
