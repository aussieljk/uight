/**
 * The one overlay surface. SPEC.md §10.1.
 *
 * There were two, and they disagreed about everything that matters: the palette
 * was a `role="dialog"` with a backdrop, `aria-modal` and its own Escape
 * handler; the keyboard help was a bare floating `div` with none of the three,
 * pinned into the bottom-right corner of the preview. Two dismissal models in
 * one keyboard-first tool is a bug in the tool, not a styling difference — a
 * user who learns that Escape closes the palette has learned nothing about the
 * help panel, and a screen reader is told one of them is modal and the other is
 * a paragraph that appeared.
 *
 * So dismissal lives here, once — and it is now ljkui's `Dialog`, which is
 * where the backdrop, the Escape rule, the focus trap and focus restoration
 * come from. This file is what is left: the portal container (§10.3 — a popup
 * in the host's `<body>` would be outside our scoped stylesheet), the caller's
 * extra key handling, and the panel box.
 *
 * Not ejectable and not on the facade: it is presentation shared by two chrome
 * components, and §19.7 keeps that kind of thing out of the frozen surface.
 * `CommandPalette` reaches it as an ordinary import, so an ejected palette can
 * inline the behaviour or keep importing it — both work.
 */

import { Dialog, VisuallyHidden } from "ljkui";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { useUightRoot } from "./root-context.ts";

export interface OverlayProps {
	open: boolean;
	/** Accessible name for the dialog. */
	label: string;
	onClose: () => void;
	/** Sized and styled by the caller; the backdrop and the trap are ours. */
	className?: string;
	/** Extra key handling for the panel, run before ljkui's own Escape rule. */
	onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
	children: ReactNode;
}

export function Overlay({
	open,
	label,
	onClose,
	className,
	onKeyDown,
	children,
}: OverlayProps): ReactElement | null {
	const root = useUightRoot();

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<Dialog.Content
				container={root}
				aria-label={label}
				onKeyDown={onKeyDown}
				className={
					className ?? "flex max-h-[70%] w-[min(32rem,90%)] flex-col overflow-hidden p-0"
				}
			>
				{/* Every ljkui dialog wants a title. The chrome's overlays name
				    themselves in their own header, so this is the same string again
				    for assistive technology rather than a second visible one. */}
				<VisuallyHidden>
					<Dialog.Title>{label}</Dialog.Title>
				</VisuallyHidden>
				{children}
			</Dialog.Content>
		</Dialog.Root>
	);
}
