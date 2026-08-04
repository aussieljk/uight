/**
 * The same dynamically-built default export as `swatches.fixture.tsx`, with
 * one line added: `export const fixtureNames`.
 *
 * §3.4's table ends with "`export const fixtureNames` present — **wins
 * outright**". So this file is fully indexed without ever being executed, the
 * tree shows five nodes immediately, deep links resolve without a load, and
 * the warm pass has nothing to do.
 *
 * The cost is that the declaration can drift from reality. §3.4 covers that
 * too: after the module loads, the real keys are compared against the index and
 * a mismatch warns in development, naming the file and both lists. Rename a
 * grey below and leave the array alone to see it.
 */

import { Card, Text } from "frosted-ui";
import type * as React from "react";

const GREYS = ["gray", "mauve", "slate", "sage"] as const;

export const fixtureNames = ["Overview", "Gray", "Mauve", "Slate", "Sage"];

function Swatch({ grey }: { grey: (typeof GREYS)[number] }) {
	return (
		<Card size="2" style={{ width: 200 }}>
			<div
				style={{
					height: 64,
					borderRadius: "var(--radius-3)",
					background: `var(--${grey}-9)`,
				}}
			/>
			<Text size="2" style={{ display: "block", marginTop: 8 }}>
				{grey}
			</Text>
		</Card>
	);
}

const swatches: Record<string, React.ReactElement> = Object.fromEntries(
	GREYS.map((grey) => [
		grey[0]!.toUpperCase() + grey.slice(1),
		<Swatch key={grey} grey={grey} />,
	]),
);

export default {
	Overview: (
		<div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
			{GREYS.map((grey) => (
				<Swatch key={grey} grey={grey} />
			))}
		</div>
	),
	...swatches,
};
