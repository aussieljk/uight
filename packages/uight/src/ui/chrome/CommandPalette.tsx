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
 * Filtering and ranking happen in `UightUI` — including the recency blend, so
 * an empty ⌘K opens on what you were just looking at rather than on a static
 * alphabetical list. A replacement palette gets the ordered result and never
 * reimplements the matcher. That is why ljkui's `Command` is handed
 * `filter={() => true}`: it owns the roving highlight, the arrow keys, Enter
 * and scroll-into-view, and it is told to keep the list exactly as ranked.
 *
 * The dialog shell — backdrop, Escape, focus trap, focus restore — is
 * `ui/Overlay.tsx`, shared with the keyboard help so the two surfaces cannot
 * drift into two dismissal models (§10.1).
 */

import { Command, Kbd, Typography } from "ljkui";
import type { ReactElement } from "react";
import type { CommandPaletteItem, CommandPaletteProps } from "../../shared/types.ts";
import { Overlay } from "../Overlay.tsx";

const KIND_LABEL: Record<CommandPaletteItem["kind"], string> = {
	fixture: "fixture",
	component: "component",
	"call-site": "usage",
};

/** Keep the ranked order and the ranked membership; `UightUI` already filtered. */
const KEEP_EVERYTHING = (): boolean => true;

export function CommandPalette(props: CommandPaletteProps): ReactElement | null {
	const { open, items, query, onQueryChange, onSelect, onClose } = props;

	return (
		<Overlay open={open} label="Find a fixture or component" onClose={onClose}>
			<Command.Root
				value={query}
				onValueChange={onQueryChange}
				filter={KEEP_EVERYTHING}
				className="flex min-h-0 flex-1 flex-col"
			>
				<Command.Input
					autoFocus
					placeholder="Find a fixture, component or usage…"
					aria-label="Search"
				/>

				<Command.List className="uight-scroll min-h-0 flex-1">
					<Command.Empty>Nothing matches “{query}”.</Command.Empty>
					{items.map((item) => (
						// `value` is the item's key rather than its label: two files can
						// hold a `Default` fixture, and Command keys its highlight by
						// value — equal values would move the highlight to the wrong row.
						<Command.Item key={item.key} value={item.key} onSelect={() => onSelect(item)}>
							<span className="min-w-0 shrink truncate">{item.label}</span>
							{item.hint ? (
								<Typography.Text size="1" color="gray" className="min-w-0 flex-1 truncate">
									{item.hint}
								</Typography.Text>
							) : (
								<span className="flex-1" />
							)}
							<Command.Shortcut>{KIND_LABEL[item.kind]}</Command.Shortcut>
						</Command.Item>
					))}
				</Command.List>
			</Command.Root>

			<div className="flex shrink-0 items-center gap-3 border-t border-[var(--uight-line)] px-3 py-1.5">
				<Typography.Text size="1" color="gray" className="flex items-center gap-3">
					<span>
						<Kbd size="1">↑↓</Kbd> move
					</span>
					<span>
						<Kbd size="1">↵</Kbd> open
					</span>
					<span>
						<Kbd size="1">esc</Kbd> close
					</span>
				</Typography.Text>
				<Typography.Text size="1" color="gray" className="ml-auto tabular-nums">
					{items.length}
				</Typography.Text>
			</div>
		</Overlay>
	);
}
