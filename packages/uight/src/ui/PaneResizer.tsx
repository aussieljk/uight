/**
 * Resizable side panes. SPEC.md §10.1.
 *
 * The sidebar was `w-60` and the control panel `w-72`, and neither could move.
 * That is fine until a real corpus arrives: the demo's deep paths truncate in
 * the tree, a `variant` select with long option labels wraps in the panel, and
 * the answer to both — "make it wider" — did not exist.
 *
 * §10.1 forbids hover-only affordances, and a drag handle is the archetype of
 * one, so this is a `separator` with a value: arrows nudge, `Home`/`End` jump to
 * the bounds, `Enter` restores the default. Pointer users drag. The two paths
 * write the same state, and the width persists for the tab (`ui/session.ts`).
 */

import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement } from "react";
import { FOCUS_RING, cx } from "./cx.ts";

export interface PaneResizerProps {
	/** Which side of the handle the pane being sized is on. */
	pane: "left" | "right";
	width: number;
	min: number;
	max: number;
	/** Restored by `Enter`, and the value used when nothing is stored. */
	initial: number;
	label: string;
	onWidth: (width: number) => void;
}

/** One arrow press. A 4px grid (§10.1) makes 8 two steps, which reads as one. */
const STEP = 8;
const COARSE_STEP = 48;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.round(value)));
}

export function PaneResizer({
	pane,
	width,
	min,
	max,
	initial,
	label,
	onWidth,
}: PaneResizerProps): ReactElement {
	const ref = useRef<HTMLDivElement | null>(null);
	const drag = useRef<{ pointer: number; startX: number; startWidth: number } | null>(
		null,
	);

	// A drag that leaves the window still has to end. Pointer capture handles the
	// element; this handles the case where the button is released outside it.
	useEffect(() => {
		const stop = () => {
			drag.current = null;
		};
		window.addEventListener("pointerup", stop);
		window.addEventListener("pointercancel", stop);
		return () => {
			window.removeEventListener("pointerup", stop);
			window.removeEventListener("pointercancel", stop);
		};
	}, []);

	const onPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) return;
			event.preventDefault();
			drag.current = { pointer: event.pointerId, startX: event.clientX, startWidth: width };
			ref.current?.setPointerCapture(event.pointerId);
			// The handle takes focus on drag, so a pointer user who then reaches for
			// the arrow keys continues from where they dropped it.
			ref.current?.focus({ preventScroll: true });
		},
		[width],
	);

	const onPointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const state = drag.current;
			if (!state || state.pointer !== event.pointerId) return;
			const delta = event.clientX - state.startX;
			onWidth(clamp(state.startWidth + (pane === "left" ? delta : -delta), min, max));
		},
		[pane, min, max, onWidth],
	);

	const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (drag.current?.pointer === event.pointerId) drag.current = null;
		if (ref.current?.hasPointerCapture(event.pointerId)) {
			ref.current.releasePointerCapture(event.pointerId);
		}
	}, []);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			// Toward the pane is bigger, away from it is smaller, whichever side it
			// is on — "left arrow shrinks" would be wrong for the right-hand panel.
			const grow = pane === "left" ? "ArrowRight" : "ArrowLeft";
			const shrink = pane === "left" ? "ArrowLeft" : "ArrowRight";
			const step = event.shiftKey ? COARSE_STEP : STEP;

			switch (event.key) {
				case grow:
					event.preventDefault();
					onWidth(clamp(width + step, min, max));
					return;
				case shrink:
					event.preventDefault();
					onWidth(clamp(width - step, min, max));
					return;
				case "Home":
					event.preventDefault();
					onWidth(min);
					return;
				case "End":
					event.preventDefault();
					onWidth(max);
					return;
				case "Enter":
				case " ":
					event.preventDefault();
					onWidth(clamp(initial, min, max));
					return;
				default:
					return;
			}
		},
		[pane, width, min, max, initial, onWidth],
	);

	return (
		<div
			ref={ref}
			role="separator"
			aria-orientation="vertical"
			aria-label={`${label}. Arrow keys resize, Enter restores the default.`}
			aria-valuenow={Math.round(width)}
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuetext={`${Math.round(width)} pixels`}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onDoubleClick={() => onWidth(clamp(initial, min, max))}
			onKeyDown={onKeyDown}
			className={cx(
				// 1px of line, 7px of grab area. The line is the visible edge the pane
				// already had, so widening the target adds nothing to the layout.
				"relative w-2 shrink-0 cursor-col-resize touch-none select-none",
				"before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2",
				"before:bg-[var(--u-line)] hover:before:bg-[var(--u-line-strong)]",
				"focus-visible:before:bg-[var(--u-accent)] focus-visible:before:w-0.5",
				FOCUS_RING,
			)}
		/>
	);
}
