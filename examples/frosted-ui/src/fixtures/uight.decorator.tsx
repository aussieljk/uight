/**
 * A decorator (SPEC §3.3). It applies to every fixture **at or below this
 * directory**, so it wraps the hand-written fixtures here and leaves the 581
 * copied frosted-ui stories in `src/stories/` untouched.
 *
 * Contract, as spelled out in §3.3:
 *
 * - Props are `{ children }` and nothing else. A decorator that wants to know
 *   which fixture it is wrapping calls `useFixtureId()`, which is what the
 *   caption below does.
 * - Composition is outermost-first by directory depth, so a decorator at
 *   `src/` would wrap this one.
 * - A decorator is not a fixture and never appears in the tree.
 * - Providers that must survive a fixture change do **not** belong here —
 *   this component remounts on every fixture switch. Those go in the preview
 *   entry (`src/uight.preview.tsx`).
 */

import { Text } from "frosted-ui";
import type * as React from "react";
import { useFixtureId } from "@aussieljk/uight";

export default function Decorator({ children }: { children: React.ReactNode }) {
	const id = useFixtureId();

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-3)",
				padding: "var(--space-4)",
				minHeight: "100%",
				boxSizing: "border-box",
			}}
		>
			<div>{children}</div>
			<Text size="1" color="gray">
				wrapped by src/fixtures/uight.decorator.tsx — {id.path}
				{id.name === null ? " (single fixture)" : ` · ${id.name || "(unnamed)"}`}
			</Text>
		</div>
	);
}
