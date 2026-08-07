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

import { Typography, headingPropDefs } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Typography/Typography.Heading",
	component: Typography.Heading,
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof Typography.Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	args: {
		children: "The quick brown fox jumps over the lazy dog.",
		size: headingPropDefs.size.default,
	},
};

export const Size: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<Typography.Heading {...args} size="0">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="1">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="2">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="3">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="4">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="5">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="6">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="7">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="8">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} size="9">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
		</div>
	),
};

export const Color: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<Typography.Heading {...args} color="indigo">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} color="cyan">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} color="orange">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} color="rose">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
		</div>
	),
};

export const Align: Story = {
	render: (args) => (
		<div
			style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: 500 }}
		>
			<Typography.Heading {...args} align="left">
				Left-aligned
			</Typography.Heading>
			<Typography.Heading {...args} align="center">
				Center-aligned
			</Typography.Heading>
			<Typography.Heading {...args} align="right">
				Right-aligned
			</Typography.Heading>
		</div>
	),
};

export const Trim: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<Typography.Heading
				{...args}
				trim="normal"
				style={{
					background: "var(--gray-a2)",
					borderTop: "1px dashed var(--gray-a7)",
					borderBottom: "1px dashed var(--gray-a7)",
				}}
			>
				Without trim
			</Typography.Heading>
			<Typography.Heading
				{...args}
				trim="both"
				style={{
					background: "var(--gray-a2)",
					borderTop: "1px dashed var(--gray-a7)",
					borderBottom: "1px dashed var(--gray-a7)",
				}}
			>
				With trim
			</Typography.Heading>
		</div>
	),
};

export const HighContrast: Story = {
	name: "High Contrast",
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<Typography.Heading {...args} highContrast color="indigo">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} highContrast color="cyan">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} highContrast color="orange">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
			<Typography.Heading {...args} highContrast color="rose">
				The quick brown fox jumps over the lazy dog.
			</Typography.Heading>
		</div>
	),
};
