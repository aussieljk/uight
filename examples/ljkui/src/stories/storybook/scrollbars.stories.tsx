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
import type { StoryObj } from "../csf-types";

import React from "react";
import { Typography } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Utilities/Scrollbars",
	//   component: AccessibleIcon,
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
			<Typography.Text>
				Frosted-UI comes with custom styles for native CSS scrollbars:
			</Typography.Text>
			<div
				style={{
					width: 400,
					height: 400,
					overflowY: "auto",
					border: "1px solid var(--gray-a5)",
				}}
			>
				<div
					style={{
						width: "100%",
						height: 1000,

						//   background: 'var(--gray-a3)'
					}}
				></div>
			</div>
			<div
				style={{
					width: 400,
					height: 400,
					overflowX: "auto",
					border: "1px solid var(--gray-a5)",
				}}
			>
				<div
					style={{
						width: 1000,
						height: "100%",

						//   background: 'var(--gray-a3)'
					}}
				></div>
			</div>
			<div
				style={{
					width: 400,
					height: 400,
					overflow: "auto",
					border: "1px solid var(--gray-a5)",
				}}
			>
				<div
					style={{
						width: 1000,
						height: 1000,

						// background: 'var(--gray-a3)'
					}}
				></div>
			</div>
		</div>
	),
};
