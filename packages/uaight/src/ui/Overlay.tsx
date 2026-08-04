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
 * So dismissal lives here, once: backdrop click, Escape, a focus trap while
 * open, and focus restored to whatever opened it. Everything above this file
 * supplies a label and contents.
 *
 * Not ejectable and not on the facade: it is presentation shared by two chrome
 * components, and §19.7 keeps that kind of thing out of the frozen surface.
 * `CommandPalette` reaches it as an ordinary import, so an ejected palette can
 * inline the behaviour or keep importing it — both work.
 */

import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";

/**
 * Tabbable candidates. `[data-uaight-overlay-skip]` exists so a trap can ignore
 * a control it renders itself, and negative tabindex is excluded because a
 * roving list's non-current rows are not tab stops.
 */
const FOCUSABLE =
	'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

export interface OverlayProps {
	open: boolean;
	/** Accessible name for the dialog. */
	label: string;
	onClose: () => void;
	/** Sized and styled by the caller; the backdrop and the trap are ours. */
	className?: string;
	/** Extra key handling for the panel, run before the shared Escape rule. */
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
	const panelRef = useRef<HTMLDivElement | null>(null);
	const restoreRef = useRef<HTMLElement | null>(null);

	// Remember the opener before the panel mounts and takes focus, and give it
	// back on close — a keyboard user who presses `?` and then Escape has to end
	// up where they started, not at the top of the document.
	useEffect(() => {
		if (!open) return;
		const active = document.activeElement;
		restoreRef.current = active instanceof HTMLElement ? active : null;
		return () => {
			const target = restoreRef.current;
			restoreRef.current = null;
			// `isConnected` guards the case where the opener was itself removed by
			// whatever the overlay did; focusing a detached node silently does nothing
			// and leaves focus on `<body>`, which is worse than leaving it alone.
			if (target?.isConnected) target.focus();
		};
	}, [open]);

	// Focus the panel itself rather than its first control: a palette wants its
	// input focused and a help dialog wants nothing in particular, and the panel
	// being focusable means Escape works before the user has tabbed anywhere.
	useEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		if (!panel) return;
		if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
	}, [open]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			onKeyDown?.(event);
			if (event.defaultPrevented) return;

			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key !== "Tab") return;

			// The trap. `aria-modal` tells assistive technology the rest of the page
			// is inert; nothing enforces that for the Tab key, so we do.
			const panel = panelRef.current;
			if (!panel) return;
			const stops = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
				(el) => el.offsetParent !== null || el === panel,
			);
			if (stops.length === 0) {
				event.preventDefault();
				panel.focus({ preventScroll: true });
				return;
			}
			const first = stops[0]!;
			const last = stops[stops.length - 1]!;
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === panel)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		},
		[onClose, onKeyDown],
	);

	if (!open) return null;

	return (
		<div
			className="absolute inset-0 z-40 flex items-start justify-center bg-[color-mix(in_srgb,var(--u-bg)_70%,transparent)] pt-[10vh]"
			onMouseDown={(event) => {
				// Only a press that STARTS on the backdrop closes. One that began
				// inside the panel and drifted out — a text selection dragged past the
				// edge — must not dismiss what the user was reading.
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={label}
				tabIndex={-1}
				onKeyDown={handleKeyDown}
				className={
					className ??
					"flex max-h-[70%] w-[min(32rem,90%)] flex-col overflow-hidden rounded-md border border-[var(--u-line-strong)] bg-[var(--u-bg)]"
				}
			>
				{children}
			</div>
		</div>
	);
}
