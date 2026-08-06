/**
 * Controls (SPEC §7.6, Appendix A). This is the thing the CSF path cannot do:
 * Storybook's `args` are static values declared in a file, while
 * `useFixtureInput` registers a control from inside the render and hands back
 * the current value.
 *
 * Every control's metadata is **declared at the call site**. That is D18, and
 * the reason is in §7.6: there is no reliable mapping from an input named
 * `variant` to a particular component prop, because a fixture may compose
 * several components, transform values, or expose a control matching no prop
 * at all — as `showCount` does here.
 */

import { Badge, Button, Card, Heading, Text } from "frosted-ui";
import * as React from "react";
import { useFixtureInput } from "@aussieljk/uight";

const VARIANTS = ["classic", "solid", "soft", "surface", "ghost"] as const;
const COLORS = ["blue", "green", "orange", "red", "gray"] as const;

const column: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: "var(--space-3)",
};

export default function ButtonPlayground() {
	const [label, setLabel] = useFixtureInput("label", "Click me", {
		label: "Label",
		description: "Rendered as the button's child.",
		control: "text",
	});

	const [variant] = useFixtureInput<(typeof VARIANTS)[number]>("variant", "solid", {
		label: "Variant",
		description: "Visual treatment.",
		control: "select",
		options: VARIANTS,
	});

	const [color] = useFixtureInput<(typeof COLORS)[number]>("color", "blue", {
		label: "Colour",
		control: "radio",
		options: COLORS,
	});

	// A range control. `size` is a string enum in frosted-ui, so the fixture maps
	// a number onto it — precisely the transform §7.6 says docgen could never
	// have guessed from the prop name alone.
	const [size] = useFixtureInput("size", 2, {
		label: "Size",
		control: "range",
		min: 1,
		max: 4,
		step: 1,
	});

	const [disabled] = useFixtureInput("disabled", false, {
		label: "Disabled",
		control: "checkbox",
	});

	const [loading] = useFixtureInput("loading", false, {
		label: "Loading",
		control: "checkbox",
	});

	// No corresponding prop on Button at all. The fixture owns the meaning.
	const [showCount] = useFixtureInput("showCount", true, {
		label: "Show count badge",
		control: "checkbox",
	});

	const [clicks, setClicks] = React.useState(0);

	return (
		<Card size="2" style={{ maxWidth: 440 }}>
			<div style={column}>
				<Heading size="3">useFixtureInput</Heading>
				<Text size="2" color="gray">
					Open the control panel and edit these. The renderer owns the value; the panel owns an
					overlay of patches over it (§7.2), which is why editing this file live keeps your
					edits meaningful instead of restoring a value the new module never produced.
				</Text>

				<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
					<Button
						variant={variant}
						color={color}
						size={String(size) as "1" | "2" | "3" | "4"}
						disabled={disabled}
						loading={loading}
						onClick={() => {
							setClicks((n) => n + 1);
							// §7.3: a setter called by the fixture becomes a root-path patch,
							// so it persists exactly like a panel edit and survives re-render.
							setLabel("Clicked");
						}}
					>
						{label}
					</Button>
					{showCount ? <Badge color="gray">{clicks} clicks</Badge> : null}
				</div>

				<Text size="1" color="gray">
					<code>showCount</code> maps to no prop on any component here. Controls are declared,
					not inferred.
				</Text>
			</div>
		</Card>
	);
}
