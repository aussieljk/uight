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
import { Link, linkPropDefs } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Typography/Link",
	component: Link,
	args: {
		children: "Frosted-UI",
		href: "https://storybook.whop.dev/",
		target: "_blank",
		color: linkPropDefs.color.default,
		size: linkPropDefs.size.default,
	},
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {};

export const Size: Story = {
	args: {
		children: "Frosted-UI",
		href: "https://storybook.whop.dev/",
		target: "_blank",
		color: linkPropDefs.color.default,
	},
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<Link {...args} size="0" />
			<Link {...args} size="1" />
			<Link {...args} size="2" />
			<Link {...args} size="3" />
			<Link {...args} size="4" />
			<Link {...args} size="5" />
			<Link {...args} size="6" />
			<Link {...args} size="7" />
			<Link {...args} size="8" />
			<Link {...args} size="9" />
		</div>
	),
};

export const Color: Story = {
	args: {
		children: "Frosted-UI",
		href: "https://storybook.whop.dev/",
		target: "_blank",
		color: linkPropDefs.color.default,
	},
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "start",
				gap: "var(--space-2)",
			}}
		>
			<Link {...args} color="indigo" />
			<Link {...args} color="cyan" />
			<Link {...args} color="orange" />
			<Link {...args} color="rose" />
		</div>
	),
};

export const Underline: Story = {
	args: {
		children: "Frosted-UI",
		href: "https://storybook.whop.dev/",
		target: "_blank",
		color: linkPropDefs.color.default,
	},
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "start",
				gap: "var(--space-2)",
			}}
		>
			<Link {...args} underline="auto" />
			<Link {...args} underline="hover" />
			<Link {...args} underline="always" />
		</div>
	),
};

export const HighContrast: Story = {
	name: "High Contrast",
	args: {
		children: "Frosted-UI",
		href: "https://storybook.whop.dev/",
		target: "_blank",
		color: linkPropDefs.color.default,
	},
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column" }}>
			<Link {...args} />
			<Link {...args} highContrast />
		</div>
	),
};

export const AsButton: Story = {
	name: "As Button",
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", alignItems: "start", gap: 16 }}>
			{/* Link rendered as a button - useful for actions that look like links */}
			<Link
				render={<button type="button" onClick={() => alert("Button clicked!")} />}
				size="2"
			>
				Click me (I&apos;m a button!)
			</Link>
		</div>
	),
};
