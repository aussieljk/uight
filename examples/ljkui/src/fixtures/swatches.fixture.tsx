/**
 * An **undecidable** fixture file, here to exercise progressive disclosure
 * (SPEC §3.5).
 *
 * §3.4 parses only the default export, and its table is unambiguous: an object
 * literal containing a spread cannot have its keys enumerated statically, so
 * the index records `names: null`. Note that the parser never executes this
 * module — names are data, modules are code, and reading one must not run the
 * other.
 *
 * What that buys, per §3.5:
 *
 * 1. The tree shows **one node for this file** rather than five.
 * 2. Selecting it loads the module and expands to the real names.
 * 3. It does **not** auto-select a child. The file node stays selected and
 *    renders the first fixture with a note saying so — auto-selecting would
 *    rewrite a URL the user never chose.
 * 4. A deep link to a name in here loads the module first, then validates.
 *
 * With `index: 'warm'` (the default) a development-only background pass loads
 * this file after first paint and caches the names, so in practice you rarely
 * see step 1. `index: 'static'` is how you see it.
 *
 * See `swatches-declared.fixture.tsx` for the escape hatch.
 */

import { Card, Typography } from "ljkui";
import type * as React from "react";

const ACCENTS = ["blue", "green", "orange", "purple"] as const;

function Swatch({ accent }: { accent: (typeof ACCENTS)[number] }) {
	return (
		<Card size="2" style={{ width: 200 }}>
			<div
				style={{
					height: 64,
					borderRadius: "var(--radius-3)",
					background: `var(--${accent}-9)`,
				}}
			/>
			<Typography.Text size="2" style={{ display: "block", marginTop: 8 }}>
				{accent}
			</Typography.Text>
		</Card>
	);
}

const swatches: Record<string, React.ReactElement> = Object.fromEntries(
	ACCENTS.map((accent) => [`Accent ${accent}`, <Swatch key={accent} accent={accent} />]),
);

export default {
	// A static key, sitting next to a spread. The spread is what makes the whole
	// object literal undecidable — one dynamic key is enough.
	Overview: (
		<div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
			{ACCENTS.map((accent) => (
				<Swatch key={accent} accent={accent} />
			))}
		</div>
	),
	...swatches,
};
