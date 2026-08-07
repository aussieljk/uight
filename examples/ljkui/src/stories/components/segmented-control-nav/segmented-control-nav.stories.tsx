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
import { ToggleGroupNav, Typography } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Components/ToggleGroupNav",
	component: ToggleGroupNav.Root,
	args: {},
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof ToggleGroupNav.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args

export const Default: Story = {
	render: (args) => (
		<div style={{ width: 600 }}>
			<ToggleGroupNav.Root {...args}>
				<ToggleGroupNav.Link active={true} href="#">
					Account
				</ToggleGroupNav.Link>
				<ToggleGroupNav.Link href="#">Documents</ToggleGroupNav.Link>
				<ToggleGroupNav.Link href="#">Settings</ToggleGroupNav.Link>
			</ToggleGroupNav.Root>
		</div>
	),
};

export const RenderProp: Story = {
	name: "Render Prop (Client-Side Routing)",
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-4)",
				maxWidth: 400,
			}}
		>
			<Typography.Text>
				Use the <Typography.Code>render</Typography.Code> prop to integrate with your
				framework&apos;s router for client-side navigation.
			</Typography.Text>
			<ToggleGroupNav.Root {...args}>
				<ToggleGroupNav.Link active render={<a href="/account" />}>
					Account
				</ToggleGroupNav.Link>
				<ToggleGroupNav.Link render={<a href="/documents" />}>Documents</ToggleGroupNav.Link>
				<ToggleGroupNav.Link render={<a href="/settings" />}>Settings</ToggleGroupNav.Link>
			</ToggleGroupNav.Root>
			<Typography.Text size="1" color="gray">
				In a real app, replace <Typography.Code>{"<a />"}</Typography.Code> with your
				router&apos;s Link component, e.g.{" "}
				<Typography.Code>{'<NextLink href="/account" />'}</Typography.Code> for Next.js.
			</Typography.Text>
		</div>
	),
};
