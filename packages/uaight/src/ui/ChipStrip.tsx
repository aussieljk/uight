/**
 * The variant / call-site strip. SPEC.md §10.1.
 *
 * Two things were wrong with it and they were the same thing twice. The strip
 * scrolls horizontally with no indication that it does, so a corpus with more
 * chips than fit looks like a corpus with exactly that many chips. And it
 * carried `role="tablist"` while implementing none of the tab pattern: arrows
 * stepped variants only because the *explorer's* key handler was listening
 * several elements up, which is the right behaviour reached by the wrong route
 * — announce a tablist to a screen reader and its user is owed arrow keys, a
 * roving tab stop, and one tab stop for the whole set.
 *
 * So: real roving tabindex, automatic activation (arrow moves focus and selects,
 * which is what stepping variants already did), `Home`/`End`, and a gradient at
 * each end that appears only when there is something past it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { FOCUS_RING, MOTION, cx } from "./cx.ts";

export interface Chip {
	key: string;
	label: string;
	title?: string;
	selected: boolean;
	onSelect: () => void;
}

export interface ChipStripProps {
	label: string;
	chips: Chip[];
	/** A hairline is drawn after this many chips; `0` for none. */
	dividerAfter?: number;
	/** Controls pushed past the end of the strip, outside the tablist. */
	trailing?: ReactNode;
}

export function ChipStrip({
	label,
	chips,
	dividerAfter = 0,
	trailing,
}: ChipStripProps): ReactElement {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [edges, setEdges] = useState({ start: false, end: false });

	const measure = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const start = el.scrollLeft > 1;
		const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
		setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
	}, []);

	useEffect(() => {
		measure();
		const el = scrollRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [measure, chips]);

	// The selected chip is the tab stop; with nothing selected the first one is,
	// so the strip is never a set of elements Tab cannot reach.
	const selectedIndex = chips.findIndex((chip) => chip.selected);
	const stop = selectedIndex < 0 ? 0 : selectedIndex;

	const focusAt = (index: number): void => {
		const chip = chips[index];
		if (!chip) return;
		const el = scrollRef.current?.querySelector<HTMLElement>(`[data-chip="${index}"]`);
		el?.focus();
		el?.scrollIntoView({ block: "nearest", inline: "nearest" });
		// Automatic activation: for a tablist whose panel is already rendered ARIA
		// prefers it, and it is exactly what ←/→ did before this file existed.
		chip.onSelect();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (chips.length === 0) return;
		const attribute = (event.target as HTMLElement).getAttribute?.("data-chip");
		const current = attribute === null || attribute === undefined ? -1 : Number(attribute);
		const from = Number.isInteger(current) && current >= 0 ? current : stop;
		switch (event.key) {
			case "ArrowRight":
				event.preventDefault();
				focusAt((from + 1) % chips.length);
				return;
			case "ArrowLeft":
				event.preventDefault();
				focusAt((from - 1 + chips.length) % chips.length);
				return;
			case "Home":
				event.preventDefault();
				focusAt(0);
				return;
			case "End":
				event.preventDefault();
				focusAt(chips.length - 1);
				return;
			default:
				return;
		}
	};

	return (
		<div className="flex items-center gap-2 px-3 py-1">
			<div className="relative min-w-0 flex-1">
				<div
					ref={scrollRef}
					role="tablist"
					aria-label={label}
					onKeyDown={onKeyDown}
					onScroll={measure}
					className="uaight-scroll flex items-center gap-1 overflow-x-auto"
				>
					{chips.map((chip, index) => (
						<div key={chip.key} className="contents">
							{dividerAfter > 0 && index === dividerAfter ? (
								<span
									aria-hidden="true"
									className="mx-1 h-3 w-px shrink-0 bg-[var(--u-line)]"
								/>
							) : null}
							<button
								type="button"
								role="tab"
								data-chip={index}
								aria-selected={chip.selected}
								tabIndex={index === stop ? 0 : -1}
								onClick={chip.onSelect}
								title={chip.title ?? chip.label}
								className={cx(
									"inline-flex h-6 shrink-0 items-center rounded-sm border-l-2 px-1.5 text-xs whitespace-nowrap",
									chip.selected
										? "border-l-[var(--u-accent)] bg-[var(--u-accent-soft)] font-medium text-[var(--u-accent)]"
										: "border-l-transparent text-[var(--u-fg-muted)] hover:bg-[var(--u-bg-hover)] hover:text-[var(--u-fg)]",
									FOCUS_RING,
									MOTION,
								)}
							>
								{chip.label}
							</button>
						</div>
					))}
				</div>

				{/* Edge affordances. Presentational only — arrows and roving focus are
				    the keyboard's answer to the same problem (§10.1). */}
				<span
					aria-hidden="true"
					className={cx(
						"pointer-events-none absolute inset-y-0 left-0 w-6",
						"bg-linear-to-r from-[var(--u-bg-sunken)] to-transparent",
						"motion-safe:transition-opacity motion-safe:duration-100",
						edges.start ? "opacity-100" : "opacity-0",
					)}
				/>
				<span
					aria-hidden="true"
					className={cx(
						"pointer-events-none absolute inset-y-0 right-0 w-6",
						"bg-linear-to-l from-[var(--u-bg-sunken)] to-transparent",
						"motion-safe:transition-opacity motion-safe:duration-100",
						edges.end ? "opacity-100" : "opacity-0",
					)}
				/>
			</div>

			{trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
		</div>
	);
}
