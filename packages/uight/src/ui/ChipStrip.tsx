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
 * Both are now answered by things that already exist. The tab pattern is
 * ljkui's `Tabs`, which is where the roving tabindex, the arrows, `Home`/`End`
 * and activate-on-focus come from — the sixty lines of hand-rolled key handling
 * that used to live here were a second implementation of it. The scroll is
 * still ours: a gradient at each end that appears only when there is something
 * past it.
 *
 * There are no tab PANELS. The chips select what the preview renders, and the
 * preview is not inside this strip; `Tabs.Trigger` without a `Tabs.Content` is
 * a tablist that controls something elsewhere, which is exactly the situation.
 */

import { Tabs } from "ljkui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { cx } from "./cx.ts";

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

	const selected = chips.find((chip) => chip.selected);

	return (
		<div className="flex items-center gap-2 px-3 py-1">
			<div className="relative min-w-0 flex-1">
				<Tabs.Root
					value={selected?.key ?? null}
					onValueChange={(next) => {
						chips.find((chip) => chip.key === next)?.onSelect();
					}}
				>
					<Tabs.List
						ref={scrollRef}
						size="1"
						aria-label={label}
						onScroll={measure}
						className="uight-scroll flex items-center gap-1 overflow-x-auto"
					>
						{chips.map((chip, index) => (
							<div key={chip.key} className="contents">
								{dividerAfter > 0 && index === dividerAfter ? (
									<span aria-hidden="true" className="mx-1 h-3 w-px shrink-0 bg-[var(--u-line)]" />
								) : null}
								<Tabs.Trigger
									value={chip.key}
									title={chip.title ?? chip.label}
									className="shrink-0 whitespace-nowrap"
								>
									{chip.label}
								</Tabs.Trigger>
							</div>
						))}
					</Tabs.List>
				</Tabs.Root>

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
