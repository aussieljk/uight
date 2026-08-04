/**
 * The command palette — ⌘K over everything selectable.
 *
 * The demo corpus is 589 fixtures across 82 files, and a tree is a haystack at
 * that size: `/` filters what is already on screen, but finding a component you
 * half-remember the name of means scrolling. This is the other half of the
 * keyboard story (§10.1, "keyboard-first, no hover-only affordances") — one
 * shortcut that reaches any fixture, any detected component, and any harvested
 * call site without touching the mouse.
 *
 * Filtering and ranking happen in `UaightUI`, so a replacement palette gets a
 * list that is already ordered and never has to reimplement the matcher.
 */

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { CommandPaletteItem, CommandPaletteProps } from "../../shared/types.ts";
import { FOCUS_RING, MOTION, cx } from "../cx.ts";

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

	if (!open) return null;

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
			case "Escape":
				event.preventDefault();
				onClose();
				return;
			default:
				return;
		}
	};

	return (
		<div
			className="absolute inset-0 z-40 flex items-start justify-center bg-[color-mix(in_srgb,var(--u-bg)_70%,transparent)] pt-[10vh]"
			onMouseDown={(event) => {
				// Only a click on the backdrop itself closes; one that started
				// inside the panel and drifted out must not.
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Find a fixture or component"
				onKeyDown={onKeyDown}
				className="flex max-h-[70%] w-[min(32rem,90%)] flex-col overflow-hidden rounded-sm border border-[var(--u-line-strong)] bg-[var(--u-bg)] shadow-lg"
			>
				<input
					ref={inputRef}
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder="Find a fixture, component or usage…"
					aria-label="Search"
					aria-controls="uaight-palette-list"
					aria-activedescendant={items[active] ? `uaight-palette-${active}` : undefined}
					className={cx(
						"h-10 shrink-0 border-b border-[var(--u-line)] bg-transparent px-3 text-[13px] text-[var(--u-fg)] outline-none placeholder:text-[var(--u-fg-subtle)]",
					)}
				/>

				<div
					ref={listRef}
					id="uaight-palette-list"
					role="listbox"
					className="min-h-0 flex-1 overflow-auto py-1"
				>
					{items.length === 0 ? (
						<p className="px-3 py-6 text-center text-[12px] text-[var(--u-fg-subtle)]">
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
									index === active
										? "bg-[var(--u-accent-soft)] text-[var(--u-accent)]"
										: "text-[var(--u-fg)] hover:bg-[var(--u-bg-hover)]",
									FOCUS_RING,
									MOTION,
								)}
							>
								<span className="min-w-0 shrink truncate text-[12px]">{item.label}</span>
								{item.hint ? (
									<span className="min-w-0 flex-1 truncate text-[11px] text-[var(--u-fg-subtle)]">
										{item.hint}
									</span>
								) : (
									<span className="flex-1" />
								)}
								<span className="shrink-0 text-[10px] tracking-wide text-[var(--u-fg-subtle)] uppercase">
									{KIND_LABEL[item.kind]}
								</span>
							</button>
						))
					)}
				</div>

				<div className="flex shrink-0 items-center gap-3 border-t border-[var(--u-line)] px-3 py-1.5 text-[11px] text-[var(--u-fg-subtle)]">
					<span>↑↓ move</span>
					<span>↵ open</span>
					<span>esc close</span>
					<span className="ml-auto tabular-nums">{items.length}</span>
				</div>
			</div>
		</div>
	);
}
