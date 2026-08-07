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

import React from "react";

import { Checkbox, Input, Kbd, Link, Typography, textPropDefs } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Typography/Typography.Text",
	component: Typography.Text,

	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof Typography.Text>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	args: {
		children: "The quick brown fox jumps over the lazy dog.",
		size: textPropDefs.size.default,
	},
};

export const Size: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<Typography.Text {...args} size="0">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="1">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="2">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="3">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="4">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="5">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="6">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="7">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="8">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} size="9">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
		</div>
	),
};

export const Weight: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<Typography.Text {...args} weight="light">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} weight="regular">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} weight="medium">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} weight="semi-bold">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} weight="bold">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
		</div>
	),
};

export const Color: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<Typography.Text {...args} color="indigo">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} color="cyan">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} color="orange">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} color="rose">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
		</div>
	),
};

export const Align: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12, width: 500 }}>
			<Typography.Text {...args} align="left">
				Left-aligned
			</Typography.Text>
			<Typography.Text {...args} align="center">
				Center-aligned
			</Typography.Text>
			<Typography.Text {...args} align="right">
				Right-aligned
			</Typography.Text>
		</div>
	),
};

export const Trim: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<Typography.Text
				{...args}
				trim="normal"
				style={{
					background: "var(--gray-a2)",
					borderTop: "1px dashed var(--gray-a7)",
					borderBottom: "1px dashed var(--gray-a7)",
				}}
			>
				Without trim
			</Typography.Text>
			<Typography.Text
				{...args}
				trim="both"
				style={{
					background: "var(--gray-a2)",
					borderTop: "1px dashed var(--gray-a7)",
					borderBottom: "1px dashed var(--gray-a7)",
				}}
			>
				With trim
			</Typography.Text>
		</div>
	),
};

export const Formatting: Story = {
	render: (args) => (
		<Typography.Text size="5" {...args}>
			Look, such a helpful <Link href="#">link</Link>, an{" "}
			<Typography.Em>italic emphasis</Typography.Em>, a piece of computer{" "}
			<Typography.Code>code</Typography.Code>, and even a hotkey combination <Kbd>⇧⌘A</Kbd>{" "}
			within the text.
		</Typography.Text>
	),
};

export const FormControls: Story = {
	name: "With form controls",
	render: () => (
		<div style={{ maxWidth: 300 }}>
			<Typography.Text size="3" render={<div />} style={{ display: "flex", gap: 12 }}>
				<Checkbox defaultChecked /> Composing Typography.Text with a form control like
				Checkbox, RadioGroup, or Switch automatically centers the control with the first line
				of text, even when the text is multi-line.
			</Typography.Text>
		</div>
	),
};

export const HighContrast: Story = {
	name: "High Contrast",
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<Typography.Text {...args} highContrast color="indigo">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} highContrast color="cyan">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} highContrast color="orange">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
			<Typography.Text {...args} highContrast color="rose">
				The quick brown fox jumps over the lazy dog.
			</Typography.Text>
		</div>
	),
};

export const AsFormLabel: Story = {
	name: "As Form Label",
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 24, width: 300 }}>
			<Typography.Text size="2" weight="medium" render={<button type="button" />}>
				as button
			</Typography.Text>
			{/* Using the render prop to render Typography.Text as a label element */}
			<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
				<Typography.Text size="2" weight="medium" render={<label htmlFor="email-input" />}>
					Email address
				</Typography.Text>
				<Input.Root>
					<Input.Control id="email-input" placeholder="Enter your email" />
				</Input.Root>
			</div>

			{/* Another example with required indicator */}
			<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
				<Typography.Text size="2" weight="medium" render={<label htmlFor="password-input" />}>
					Password <Typography.Text color="red">*</Typography.Text>
				</Typography.Text>
				<Input.Root>
					<Input.Control
						id="password-input"
						type="password"
						placeholder="Enter your password"
					/>
				</Input.Root>
			</div>

			{/* Using render prop with htmlFor */}
			<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
				<Typography.Text size="2" weight="medium" render={<label htmlFor="username-input" />}>
					Username
				</Typography.Text>
				<Input.Root>
					<Input.Control id="username-input" placeholder="Enter your username" />
				</Input.Root>
			</div>
		</div>
	),
};
