/**
 * Toolbar — the preview's own bar. Ejectable (§11.3).
 *
 * A container and nothing else: what sits in it is the explorer's decision, so
 * replacing this file changes the bar's presentation without touching wiring.
 */

import type { ReactElement } from "react";
import type { ToolbarProps } from "../../shared/types.ts";

export function Toolbar({ children }: ToolbarProps): ReactElement {
	return (
		<div
			role="toolbar"
			aria-label="Preview"
			className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--u-line)] bg-[var(--u-bg)] px-2"
		>
			{children}
		</div>
	);
}
