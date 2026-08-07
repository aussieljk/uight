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
import { Avatar, Card, Typography, cardPropDefs } from "ljkui";

const CardContentExample = () => (
	<div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
		<Avatar size="3" fallback="IM" color="indigo" />
		<div>
			<Typography.Text render={<div />} size="2" weight="bold">
				Ilya Miskov
			</Typography.Text>
			<Typography.Text render={<div />} size="2" color="gray">
				I love how we have the freedom to explore skeuomorphism
			</Typography.Text>
		</div>
	</div>
);
// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Components/Card",
	component: Card,

	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	argTypes: {
		size: {
			control: "select",
			options: cardPropDefs.size.values,
		},
		variant: {
			control: "select",
			options: cardPropDefs.variant.values,
		},
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	args: {
		children: <CardContentExample />,
		size: cardPropDefs.size.default,
	},
};

export const Size: Story = {
	args: {
		size: cardPropDefs.size.default,
	},
	render: (args) => (
		<div style={{ display: "flex", gap: "var(--space-3)", flexDirection: "column" }}>
			<Card {...args} size="1" style={{ width: 350 }}>
				<div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
					<Avatar size="3" fallback="T" color="indigo" />
					<div>
						<Typography.Text render={<div />} size="2" weight="bold">
							Teodros Girmay
						</Typography.Text>
						<Typography.Text render={<div />} size="2" color="gray">
							Engineering
						</Typography.Text>
					</div>
				</div>
			</Card>

			<Card {...args} size="2" style={{ width: 425 }}>
				<div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
					<Avatar size="4" fallback="T" color="indigo" />
					<div>
						<Typography.Text render={<div />} weight="bold">
							Teodros Girmay
						</Typography.Text>
						<Typography.Text render={<div />} color="gray">
							Engineering
						</Typography.Text>
					</div>
				</div>
			</Card>

			<Card {...args} size="3" style={{ width: 500 }}>
				<div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
					<Avatar size="5" fallback="T" color="indigo" />
					<div>
						<Typography.Text render={<div />} size="4" weight="bold">
							Teodros Girmay
						</Typography.Text>
						<Typography.Text render={<div />} size="4" color="gray">
							Engineering
						</Typography.Text>
					</div>
				</div>
			</Card>

			<Card {...args} size="4" style={{ width: 500 }}>
				<div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
					<Avatar size="5" fallback="T" color="indigo" />
					<div>
						<Typography.Text render={<div />} size="4" weight="bold">
							Teodros Girmay
						</Typography.Text>
						<Typography.Text render={<div />} size="4" color="gray">
							Engineering
						</Typography.Text>
					</div>
				</div>
			</Card>

			<Card {...args} size="5" style={{ width: 500 }}>
				<div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
					<Avatar size="5" fallback="T" color="indigo" />
					<div>
						<Typography.Text render={<div />} size="4" weight="bold">
							Teodros Girmay
						</Typography.Text>
						<Typography.Text render={<div />} size="4" color="gray">
							Engineering
						</Typography.Text>
					</div>
				</div>
			</Card>
		</div>
	),
};

export const Variant: Story = {
	args: {
		children: <CardContentExample />,
	},
	render: ({ children, ...args }) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
			<Card {...args} variant="surface">
				{children}
			</Card>
			<Card {...args} variant="outline">
				{children}
			</Card>
			<Card {...args} variant="soft">
				{children}
			</Card>
			<Card {...args} variant="ghost">
				{children}
			</Card>
		</div>
	),
};

export const InsetContent: Story = {
	name: "Inset Content",
	render: (args) => (
		<Card size="2" style={{ maxWidth: 240, padding: 0 }} {...args}>
			<img
				src="https://images.unsplash.com/photo-1617050318658-a9a3175e34cb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80"
				alt="Bold typography"
				style={{
					display: "block",
					objectFit: "cover",
					width: "100%",
					height: 140,
					backgroundColor: "var(--gray-5)",
				}}
			/>

			<div style={{ padding: "var( --card-padding)" }}>
				<Typography.Text render={<p />} size="3">
					This is a really nice image description.
				</Typography.Text>
			</div>
		</Card>
	),
};

export const AsAnotherElement: Story = {
	name: "As another element",
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
			<div>
				<Typography.Text>
					Use the <Typography.Code>render</Typography.Code> prop to render the card as a link
					or a button. This prop adds styles for the interactive states, like hover and focus.
				</Typography.Text>
			</div>
			<div>
				<Card {...args} render={<a href="#" />} style={{ maxWidth: 350 }}>
					<CardContentExample />
				</Card>
			</div>
		</div>
	),
};
