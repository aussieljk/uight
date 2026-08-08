/**
 * Toolbar — the preview's own bar. Ejectable (§11.3).
 *
 * A container and nothing else: what sits in it is the explorer's decision, so
 * replacing this file changes the bar's presentation without touching wiring.
 */

import { HStack } from "ljkui";
import type { ReactElement } from "react";
import type { ToolbarProps } from "../../shared/types.ts";

export function Toolbar({ children }: ToolbarProps): ReactElement {
	return (
		<HStack
			role="toolbar"
			aria-label="Preview"
			className="h-9 shrink-0 gap-2 border-b border-[var(--uight-line)] bg-[var(--uight-surface)] px-2"
		>
			{children}
		</HStack>
	);
}
