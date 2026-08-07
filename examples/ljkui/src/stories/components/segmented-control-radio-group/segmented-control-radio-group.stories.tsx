/**
 * Adapted from frosted-ui — Whop's design system — and used here under the MIT
 * licence. Copyright (c) 2023 WorkOS. Copyright (c) 2023 Whop.
 * Full licence text: src/stories/LICENSE-frosted-ui.md
 *
 * Changes from upstream: imports of frosted-ui internals rewritten to the
 * published `frosted-ui` package, and `@storybook/react` types replaced with
 * the local shim in src/stories/csf-types.ts. Any further change to a story
 * body is marked with a comment in place.
 * uight is not affiliated with Whop or frosted-ui.
 */
import type { Meta, StoryObj } from "../../csf-types";

import { Icons } from "ljkui/icons";
import React from "react";
import { Button, ToggleGroupRadioGroup, Typography } from "ljkui";
// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Controls/ToggleGroupRadioGroup",
	component: ToggleGroupRadioGroup.Root,
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof ToggleGroupRadioGroup.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	render: (args) => (
		<ToggleGroupRadioGroup.Root
			defaultValue="system"
			{...args}
			onValueChange={(value) => console.log("🟢 onValueChange ", value)}
		>
			<ToggleGroupRadioGroup.Item value="system">
				<Icons.Server />
			</ToggleGroupRadioGroup.Item>
			<ToggleGroupRadioGroup.Item value="light-mode">
				<Icons.Sun />
			</ToggleGroupRadioGroup.Item>
			<ToggleGroupRadioGroup.Item value="dark-mode">
				<Icons.Moon />
			</ToggleGroupRadioGroup.Item>
		</ToggleGroupRadioGroup.Root>
	),
};

export const InputRef: Story = {
	name: "Input Ref",
	render: (args) => {
		const inputRef = React.useRef<HTMLInputElement>(null);

		const handleFocus = () => {
			inputRef.current?.focus();
		};

		const handleReportValidity = () => {
			const isValid = inputRef.current?.reportValidity();
			console.log("Validity:", isValid);
		};

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 400,
				}}
			>
				<Typography.Text>
					The <Typography.Code>inputRef</Typography.Code> prop provides access to the
					underlying hidden input element, enabling programmatic control for focus management,
					form validation, and integration with form libraries.
				</Typography.Text>

				<ToggleGroupRadioGroup.Root
					{...args}
					name="theme-preference"
					required
					inputRef={inputRef}
				>
					<ToggleGroupRadioGroup.Item value="system">
						<Icons.Server />
					</ToggleGroupRadioGroup.Item>
					<ToggleGroupRadioGroup.Item value="light-mode">
						<Icons.Sun />
					</ToggleGroupRadioGroup.Item>
					<ToggleGroupRadioGroup.Item value="dark-mode">
						<Icons.Moon />
					</ToggleGroupRadioGroup.Item>
				</ToggleGroupRadioGroup.Root>

				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					<Button size="1" variant="soft" onClick={handleFocus}>
						Focus Input
					</Button>
					<Button size="1" variant="soft" onClick={handleReportValidity}>
						Check Validity
					</Button>
				</div>

				<Typography.Text size="1" color="gray">
					Click &quot;Check Validity&quot; without selecting an option to see the
					browser&apos;s native validation message in the console (the group has{" "}
					<Typography.Code>required</Typography.Code> set).
				</Typography.Text>
			</div>
		);
	},
};

export const Controlled: Story = {
	name: "Controlled",
	render: () => {
		const [theme, setTheme] = React.useState("system");

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 400,
				}}
			>
				<Typography.Text>
					Use <Typography.Code>value</Typography.Code> and{" "}
					<Typography.Code>onValueChange</Typography.Code> for controlled state.
				</Typography.Text>

				<ToggleGroupRadioGroup.Root value={theme} onValueChange={setTheme}>
					<ToggleGroupRadioGroup.Item value="system">
						<Icons.Server />
					</ToggleGroupRadioGroup.Item>
					<ToggleGroupRadioGroup.Item value="light">
						<Icons.Sun />
					</ToggleGroupRadioGroup.Item>
					<ToggleGroupRadioGroup.Item value="dark">
						<Icons.Moon />
					</ToggleGroupRadioGroup.Item>
				</ToggleGroupRadioGroup.Root>

				<Typography.Text size="2">
					Selected: <Typography.Code>{theme}</Typography.Code>
				</Typography.Text>
			</div>
		);
	},
};

export const TypeSafeValues: Story = {
	name: "Type-Safe Values",
	render: () => {
		type Theme = "system" | "light" | "dark";
		const [theme, setTheme] = React.useState<Theme>("system");

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 400,
				}}
			>
				<Typography.Text>
					Pass a string union type to get autocomplete and catch typos at compile time. Without
					an explicit type parameter, the value type is inferred from props like{" "}
					<Typography.Code>value</Typography.Code> and{" "}
					<Typography.Code>onValueChange</Typography.Code>.
				</Typography.Text>

				<ToggleGroupRadioGroup.Root<Theme> value={theme} onValueChange={setTheme}>
					<ToggleGroupRadioGroup.Item value="system">
						<Icons.Server />
					</ToggleGroupRadioGroup.Item>
					<ToggleGroupRadioGroup.Item value="light">
						<Icons.Sun />
					</ToggleGroupRadioGroup.Item>
					<ToggleGroupRadioGroup.Item value="dark">
						<Icons.Moon />
					</ToggleGroupRadioGroup.Item>
				</ToggleGroupRadioGroup.Root>

				<Typography.Text size="2">
					Selected: <Typography.Code>{theme}</Typography.Code>
				</Typography.Text>

				<Typography.Text size="1" color="gray">
					Try changing a value to <Typography.Code>&quot;sytsem&quot;</Typography.Code> —
					TypeScript will catch the typo!
				</Typography.Text>
			</div>
		);
	},
};
