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
import { Breadcrumb, breadcrumbPropDefs } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Components/Breadcrumb",
	component: Breadcrumb.Root,
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof Breadcrumb.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLinks: Story = {
	name: "With links",
	args: {
		color: breadcrumbPropDefs.color.default,
	},
	render: (args) => (
		<Breadcrumb.Root {...args}>
			<Breadcrumb.Item render={<a href="#" />} nativeButton={false}>
				Home
			</Breadcrumb.Item>
			<Breadcrumb.Item render={<a href="#user-profiles" />} nativeButton={false}>
				User Profiles
			</Breadcrumb.Item>
			<Breadcrumb.Item>Products</Breadcrumb.Item>
		</Breadcrumb.Root>
	),
};

export const WithOnClick: Story = {
	name: "With onClick",
	args: {
		color: breadcrumbPropDefs.color.default,
	},
	render: (args) => (
		<Breadcrumb.Root {...args}>
			<Breadcrumb.Item onClick={() => alert("Home")}>Home</Breadcrumb.Item>
			<Breadcrumb.Item onClick={() => alert("Products")}>Products</Breadcrumb.Item>
			<Breadcrumb.Item onClick={() => alert("Sneaker Bot")}>Sneaker Bot</Breadcrumb.Item>
		</Breadcrumb.Root>
	),
};

export const Truncated: Story = {
	name: "Truncated",
	args: {
		color: breadcrumbPropDefs.color.default,
	},
	render: (args) => (
		<Breadcrumb.Root {...args}>
			<Breadcrumb.Item render={<a href="#">Home</a>} />
			<Breadcrumb.Dropdown>
				<Breadcrumb.DropdownItem render={<a href="#">Products</a>} />
				<Breadcrumb.DropdownItem render={<a href="#">Categories</a>} />
				<Breadcrumb.DropdownItem render={<a href="#">Software</a>} />
			</Breadcrumb.Dropdown>
			<Breadcrumb.Item render={<a href="#">Bots</a>} />
			<Breadcrumb.Item>Sneaker Bot</Breadcrumb.Item>
		</Breadcrumb.Root>
	),
};
