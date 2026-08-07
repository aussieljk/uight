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

import { ToggleGroupRadioGroup } from "ljkui";
import type { ReactElement } from "react";
import type { ViewportPreset, ViewportToolbarProps } from "../../shared/types.ts";
import { VIEWPORT_INLINE_REASON } from "../constants.ts";

/** "Fit" is a preset like any other to the segmented control; `null` to callers. */
const FIT = "__fit__";

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
		<>
			{/*
			 * One choice among a fixed few, which is what a segmented control is
			 * for. §5.2 — the isolation badge points at the same description, so
			 * "these are greyed out" and "because this mount is inline" are one
			 * explanation rather than two.
			 */}
			<ToggleGroupRadioGroup.Root
				aria-label="Viewport"
				aria-describedby={supported ? undefined : "uight-viewport-hint"}
				disabled={!supported}
				title={hint}
				value={current?.name ?? FIT}
				onValueChange={(next) => {
					if (next === FIT) {
						onChange(null);
						return;
					}
					const preset = presets.find((p) => p.name === next);
					if (preset) onChange(preset);
				}}
			>
				<ToggleGroupRadioGroup.Item value={FIT} title={hint ?? "Fill the available space"}>
					<FitGlyph />
					Fit
				</ToggleGroupRadioGroup.Item>
				{presets.map((preset) => (
					<ToggleGroupRadioGroup.Item
						key={preset.name}
						value={preset.name}
						aria-label={`${preset.name}, ${preset.width} by ${preset.height}`}
						title={hint ?? `${preset.name} — ${preset.width}×${preset.height}`}
						className="tabular-nums"
					>
						<DeviceGlyph preset={preset} />
						{preset.width}
						{/* The name is the first thing to go when the bar is tight; the
						    number and the glyph together still identify the preset. */}
						<span className="hidden 2xl:inline">{preset.name}</span>
					</ToggleGroupRadioGroup.Item>
				))}
			</ToggleGroupRadioGroup.Root>
			{supported ? null : (
				<span id="uight-viewport-hint" className="uight-sr-only">
					{VIEWPORT_INLINE_REASON}
				</span>
			)}
		</>
	);
}
