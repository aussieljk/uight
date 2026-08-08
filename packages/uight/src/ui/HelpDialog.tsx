/**
 * The keymap, as a dialog. SPEC.md §10.1.
 *
 * It used to be a 256px box pinned to the bottom-right of the preview, showing
 * eleven rows at the smallest size in the type scale — over the exact region a
 * fixture renders into. A keyboard-first tool's list of keys is a thing people
 * read, not a tooltip, and reading it should not require moving whatever it is
 * covering. Same surface as the palette, same dismissal, same visual language.
 */

import { Button, Kbd, Typography } from "ljkui";
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
			<div className="flex h-9 shrink-0 items-center border-b border-[var(--uight-line)] px-3">
				<Typography.Heading size="2" render={<h2 />}>
					Keyboard
				</Typography.Heading>
				<Typography.Text size="1" color="gray" className="ml-auto">
					<Kbd>?</Kbd> to close
				</Typography.Text>
			</div>

			<dl className="grid min-h-0 flex-1 grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 overflow-auto p-3">
				{KEYMAP.map((item) => (
					<div key={item.keys} className="contents">
						{/* One `Kbd` per key, not per binding: `⌘K · Ctrl K` is two
						    shortcuts for one action and reads as two key caps. */}
						<dt className="flex flex-wrap items-baseline gap-1 whitespace-nowrap">
							{item.keys.split(" · ").map((key) => (
								<Kbd key={key} size="1">
									{key}
								</Kbd>
							))}
						</dt>
						<dd>
							<Typography.Text size="1" color="gray">
								{item.action}
							</Typography.Text>
						</dd>
					</div>
				))}
			</dl>

			<div className="flex shrink-0 items-center border-t border-[var(--uight-line)] px-3 py-1.5">
				<Typography.Text size="1" color="gray">
					<Kbd size="1">esc</Kbd> close
				</Typography.Text>
				<Button size="1" variant="ghost" color="gray" onClick={onClose} className="ml-auto">
					Close
				</Button>
			</div>
		</Overlay>
	);
}
