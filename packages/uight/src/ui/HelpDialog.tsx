/**
 * The keymap, as a dialog. SPEC.md §10.1.
 *
 * It used to be a 256px box pinned to the bottom-right of the preview, showing
 * eleven rows at the smallest size in the type scale — over the exact region a
 * fixture renders into. A keyboard-first tool's list of keys is a thing people
 * read, not a tooltip, and reading it should not require moving whatever it is
 * covering. Same surface as the palette, same dismissal, same visual language.
 */

import type { ReactElement } from "react";
import { KEYMAP } from "./constants.ts";
import { Overlay } from "./Overlay.tsx";

export interface HelpDialogProps {
	open: boolean;
	onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps): ReactElement | null {
	return (
		<Overlay open={open} label="Keyboard shortcuts" onClose={onClose}>
			<div className="flex h-9 shrink-0 items-center border-b border-[var(--u-line)] px-3">
				<h2 className="text-sm font-medium text-[var(--u-fg)]">Keyboard</h2>
				<span className="ml-auto text-xs text-[var(--u-fg-subtle)]">? to close</span>
			</div>

			<dl className="grid min-h-0 flex-1 grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 overflow-auto p-3">
				{KEYMAP.map((item) => (
					<div key={item.keys} className="contents">
						<dt className="text-sm font-medium whitespace-nowrap text-[var(--u-fg)] tabular-nums">
							{item.keys}
						</dt>
						<dd className="text-xs text-[var(--u-fg-muted)]">{item.action}</dd>
					</div>
				))}
			</dl>

			<div className="flex shrink-0 items-center border-t border-[var(--u-line)] px-3 py-1.5">
				<span className="text-xs text-[var(--u-fg-subtle)]">esc close</span>
				<button
					type="button"
					onClick={onClose}
					className="ml-auto h-6 rounded-sm px-1.5 text-xs text-[var(--u-fg-muted)] hover:bg-[var(--u-bg-hover)] hover:text-[var(--u-fg)]"
				>
					Close
				</button>
			</div>
		</Overlay>
	);
}
