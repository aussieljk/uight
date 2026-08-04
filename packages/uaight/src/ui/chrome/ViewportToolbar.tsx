/**
 * ViewportToolbar. Ejectable (§11.3).
 *
 * §6.5 — viewport controls are frame-only. Inline they render DISABLED with an
 * explanation, because inline width is a CSS box and the fixture's media
 * queries still measure the page. Hiding them would be a quieter lie.
 *
 * The presets used to render as their widths alone — "320 375 768 1280 1536",
 * five bare numbers in a row, which reads as a phone number rather than as a
 * control. Each one now carries a glyph whose proportions are the device's, so
 * the row is scannable by shape before it is read, and the name appears
 * alongside once the toolbar is wide enough to hold it. The number stays: it is
 * what people actually compare against ("does this break at 375?").
 */

import type { ReactElement } from "react";
import type { ViewportPreset, ViewportToolbarProps } from "../../shared/types.ts";
import { VIEWPORT_INLINE_REASON } from "../constants.ts";
import { FOCUS_RING, MOTION, SELECTABLE, SELECTED, cx } from "../cx.ts";

function itemClass(active: boolean): string {
	return cx(
		"inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-xs tabular-nums",
		SELECTABLE,
		active
			? SELECTED
			: "text-[var(--u-fg-muted)] hover:bg-[var(--u-bg-hover)] hover:text-[var(--u-fg)]",
		"disabled:pointer-events-none disabled:opacity-40",
		FOCUS_RING,
		MOTION,
	);
}

/**
 * A device outline drawn to the preset's own aspect ratio, inside a fixed 12px
 * box. Nothing is looked up by name — the shape IS the numbers, so a custom
 * preset added through the facade gets a correct glyph for free.
 */
function DeviceGlyph({ preset }: { preset: ViewportPreset }): ReactElement {
	const ratio = preset.width / Math.max(1, preset.height);
	const height = ratio >= 1 ? 8 : 11;
	const width = Math.max(4, Math.min(11, height * ratio));
	return (
		<svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0">
			<rect
				x={(12 - width) / 2}
				y={(12 - height) / 2}
				width={width}
				height={height}
				rx="1.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1"
				opacity="0.7"
			/>
		</svg>
	);
}

/** "Fit" has no dimensions, so its glyph is the frame filled edge to edge. */
function FitGlyph(): ReactElement {
	return (
		<svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0">
			<rect
				x="0.5"
				y="1.5"
				width="11"
				height="9"
				rx="1.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1"
				strokeDasharray="2 1.5"
				opacity="0.7"
			/>
		</svg>
	);
}

export function ViewportToolbar({
	current,
	presets,
	onChange,
	supported,
}: ViewportToolbarProps): ReactElement {
	const hint = supported ? undefined : VIEWPORT_INLINE_REASON;

	return (
		<div
			role="group"
			aria-label="Viewport"
			// §5.2 — the isolation badge points at the same element, so "these are
			// greyed out" and "because this mount is inline" are one explanation.
			aria-describedby={supported ? undefined : "uaight-viewport-hint"}
			className="flex items-center gap-0.5"
			title={hint}
		>
			<button
				type="button"
				disabled={!supported}
				aria-pressed={current === null}
				onClick={() => onChange(null)}
				className={itemClass(current === null)}
				title={hint ?? "Fill the available space"}
			>
				<FitGlyph />
				Fit
			</button>
			{presets.map((preset) => {
				const active = current?.name === preset.name;
				return (
					<button
						key={preset.name}
						type="button"
						disabled={!supported}
						aria-pressed={active}
						aria-label={`${preset.name}, ${preset.width} by ${preset.height}`}
						onClick={() => onChange(preset)}
						className={itemClass(active)}
						title={hint ?? `${preset.name} — ${preset.width}×${preset.height}`}
					>
						<DeviceGlyph preset={preset} />
						{preset.width}
						{/* The name is the first thing to go when the bar is tight; the
						    number and the glyph together still identify the preset. */}
						<span className="hidden 2xl:inline">{preset.name}</span>
					</button>
				);
			})}
			{supported ? null : (
				<span id="uaight-viewport-hint" className="sr-only">
					{VIEWPORT_INLINE_REASON}
				</span>
			)}
		</div>
	);
}
