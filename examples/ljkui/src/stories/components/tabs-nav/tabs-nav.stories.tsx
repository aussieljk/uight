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
import { TabsNav, Typography, tabsNavPropDefs } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Components/TabsNav",
	component: TabsNav.Root,
	args: {
		size: tabsNavPropDefs.size.default,
		color: tabsNavPropDefs.color.default,
		highContrast: tabsNavPropDefs.highContrast.default,
	},
	argTypes: {
		size: {
			control: "select",
			options: tabsNavPropDefs.size.values,
		},
		color: {
			control: "select",
			options: tabsNavPropDefs.color.values,
		},
		highContrast: {
			control: "boolean",
		},
	},
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof TabsNav.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args

export const Default: Story = {
	render: (args) => (
		<div style={{ width: 600 }}>
			<TabsNav.Root {...args}>
				<TabsNav.Link active={true} href="#">
					Account
				</TabsNav.Link>
				<TabsNav.Link href="#">Documents</TabsNav.Link>
				<TabsNav.Link href="#">Settings</TabsNav.Link>
			</TabsNav.Root>
		</div>
	),
};

export const Size: Story = {
	render: (args) => (
		<div
			style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: 600 }}
		>
			<TabsNav.Root {...args} size="1">
				<TabsNav.Link active href="#">
					Account
				</TabsNav.Link>
				<TabsNav.Link href="#">Documents</TabsNav.Link>
				<TabsNav.Link href="#">Settings</TabsNav.Link>
			</TabsNav.Root>

			<TabsNav.Root {...args} size="2">
				<TabsNav.Link href="#">Overview</TabsNav.Link>
				<TabsNav.Link active href="#">
					Analytics
				</TabsNav.Link>
				<TabsNav.Link href="#">Reports</TabsNav.Link>
			</TabsNav.Root>
		</div>
	),
};

export const Color: Story = {
	render: (args) => (
		<div
			style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: 600 }}
		>
			<TabsNav.Root {...args} color="indigo">
				<TabsNav.Link active={true} href="#">
					Account
				</TabsNav.Link>
				<TabsNav.Link href="#">Documents</TabsNav.Link>
				<TabsNav.Link href="#">Settings</TabsNav.Link>
			</TabsNav.Root>

			<TabsNav.Root {...args} color="cyan">
				<TabsNav.Link href="#">Overview</TabsNav.Link>
				<TabsNav.Link active href="#">
					Analytics
				</TabsNav.Link>
				<TabsNav.Link href="#">Reports</TabsNav.Link>
			</TabsNav.Root>

			<TabsNav.Root {...args} color="rose">
				<TabsNav.Link active href="#">
					One
				</TabsNav.Link>
				<TabsNav.Link href="#">Two</TabsNav.Link>
			</TabsNav.Root>
		</div>
	),
};

export const HighContrast: Story = {
	name: "High Contrast",
	render: (args) => (
		<div
			style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: 600 }}
		>
			<TabsNav.Root {...args} highContrast={false}>
				<TabsNav.Link active href="#">
					Account
				</TabsNav.Link>
				<TabsNav.Link href="#">Documents</TabsNav.Link>
				<TabsNav.Link href="#">Settings</TabsNav.Link>
			</TabsNav.Root>

			<TabsNav.Root {...args} highContrast>
				<TabsNav.Link href="#">Overview</TabsNav.Link>
				<TabsNav.Link active href="#">
					Analytics
				</TabsNav.Link>
				<TabsNav.Link href="#">Reports</TabsNav.Link>
			</TabsNav.Root>
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
				maxWidth: 600,
			}}
		>
			<Typography.Text>
				Use the <Typography.Code>render</Typography.Code> prop to integrate with your
				framework&apos;s router for client-side navigation. This is useful for frameworks like
				Next.js, React Router, or Remix.
			</Typography.Text>
			<TabsNav.Root {...args}>
				<TabsNav.Link render={<a href="/account" />}>Account</TabsNav.Link>
				<TabsNav.Link render={<a href="/documents" />}>Documents</TabsNav.Link>
				<TabsNav.Link
					active
					render={({ children, ...props }) => (
						<a href="/settings" {...props}>
							{children}
						</a>
					)}
				>
					Settings
				</TabsNav.Link>
			</TabsNav.Root>
			<Typography.Text size="1" color="gray">
				In a real app, replace <Typography.Code>{"<a />"}</Typography.Code> with your
				router&apos;s Link component, e.g.{" "}
				<Typography.Code>{'<NextLink href="/account" />'}</Typography.Code> for Next.js.
			</Typography.Text>
		</div>
	),
};
