/**
 * ViewportToolbar. Ejectable (§11.3).
 *
 * §6.5 — viewport controls are frame-only. Inline they render DISABLED with an
 * explanation, because inline width is a CSS box and the fixture's media
 * queries still measure the page. Hiding them would be a quieter lie.
 */

import type { ReactElement } from "react";
import type { ViewportToolbarProps } from "../../shared/types.ts";
import { VIEWPORT_INLINE_REASON } from "../constants.ts";
import { FOCUS_RING, MOTION, cx } from "../cx.ts";

function itemClass(active: boolean): string {
	return cx(
		"h-6 min-w-9 rounded-sm px-1.5 text-[11px] tabular-nums",
		active
			? "bg-[var(--u-accent-soft)] text-[var(--u-accent)]"
			: "text-[var(--u-fg-muted)] hover:bg-[var(--u-bg-hover)] hover:text-[var(--u-fg)]",
		"disabled:pointer-events-none disabled:opacity-40",
		FOCUS_RING,
		MOTION,
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
						{preset.width}
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
