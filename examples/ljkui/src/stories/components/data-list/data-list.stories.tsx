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
import { Icons } from "ljkui/icons";
import type { Meta, StoryObj } from "../../csf-types";
import React from "react";
import {
	Badge,
	DataTable,
	IconButton,
	Link,
	Separator,
	Tooltip,
	Typography,
	dataTableRootPropDefs,
} from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Data presentation/DataTable",
	component: DataTable.Root,
	args: {
		size: dataTableRootPropDefs.size.default,
		orientation: dataTableRootPropDefs.orientation.default,
		trim: dataTableRootPropDefs.trim.default,
	},
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof DataTable.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	render: (args) => (
		<div>
			<Typography.Text render={<p />} style={{ marginBottom: 32 }}>
				<Typography.Code>{"<DataTable />"}</Typography.Code> component displays metadata as a
				list of key-value pairs.
			</Typography.Text>
			<DataTable.Root {...args}>
				<DataTable.Item align="center">
					<DataTable.Label>Status</DataTable.Label>
					<DataTable.Value>
						<Badge color="emerald" variant="soft" size="1">
							Active
						</Badge>
					</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>ID</DataTable.Label>
					<DataTable.Value>
						<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
							<Typography.Code variant="ghost">biz_AB23XH123A</Typography.Code>
							<Tooltip content="Copy">
								<IconButton size="1" aria-label="Copy value" color="gray" variant="ghost">
									<Icons.Copy />
								</IconButton>
							</Tooltip>
						</div>
					</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Name</DataTable.Label>
					<DataTable.Value>Artur Bień</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Email</DataTable.Label>
					<DataTable.Value>
						<Link href="mailto:artur@whop.com">artur@whop.com</Link>
					</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Company</DataTable.Label>
					<DataTable.Value>
						<Link target="_blank" href="https://whop.com">
							Whop
						</Link>
					</DataTable.Value>
				</DataTable.Item>
			</DataTable.Root>
		</div>
	),
};
export const Size: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
			<DataTable.Root {...args} size="1">
				<DataTable.Item>
					<DataTable.Label>Name</DataTable.Label>
					<DataTable.Value>Artur Bień</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Email</DataTable.Label>
					<DataTable.Value>
						<Link href="mailto:artur@whop.com">artur@whop.com</Link>
					</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Company</DataTable.Label>
					<DataTable.Value>
						<Link target="_blank" href="https://whop.com">
							Whop
						</Link>
					</DataTable.Value>
				</DataTable.Item>
			</DataTable.Root>
			<DataTable.Root {...args} size="2">
				<DataTable.Item>
					<DataTable.Label>Name</DataTable.Label>
					<DataTable.Value>Artur Bień</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Email</DataTable.Label>
					<DataTable.Value>
						<Link href="mailto:artur@whop.com">artur@whop.com</Link>
					</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Company</DataTable.Label>
					<DataTable.Value>
						<Link target="_blank" href="https://whop.com">
							Whop
						</Link>
					</DataTable.Value>
				</DataTable.Item>
			</DataTable.Root>
			<DataTable.Root {...args} size="3">
				<DataTable.Item>
					<DataTable.Label>Name</DataTable.Label>
					<DataTable.Value>Artur Bień</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Email</DataTable.Label>
					<DataTable.Value>
						<Link href="mailto:artur@whop.com">artur@whop.com</Link>
					</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Company</DataTable.Label>
					<DataTable.Value>
						<Link target="_blank" href="https://whop.com">
							Whop
						</Link>
					</DataTable.Value>
				</DataTable.Item>
			</DataTable.Root>
		</div>
	),
};

export const Orientation: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
			<div>
				<Typography.Heading size="3">Horizontal</Typography.Heading>
				<Separator
					orientation="horizontal"
					size="4"
					style={{ marginBottom: 16, marginTop: 16 }}
				/>
				<DataTable.Root {...args} orientation={"horizontal"}>
					<DataTable.Item>
						<DataTable.Label>Name</DataTable.Label>
						<DataTable.Value>Artur Bień</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label>Email</DataTable.Label>
						<DataTable.Value>
							<Link href="mailto:artur@whop.com">artur@whop.com</Link>
						</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label>Company</DataTable.Label>
						<DataTable.Value>
							<Link target="_blank" href="https://whop.com">
								Whop
							</Link>
						</DataTable.Value>
					</DataTable.Item>
				</DataTable.Root>
			</div>
			<div>
				<Typography.Heading size="3">Vertical</Typography.Heading>
				<Separator
					orientation="horizontal"
					size="4"
					style={{ marginBottom: 16, marginTop: 16 }}
				/>
				<DataTable.Root {...args} orientation={"vertical"}>
					<DataTable.Item>
						<DataTable.Label>Name</DataTable.Label>
						<DataTable.Value>Artur Bień</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label>Email</DataTable.Label>
						<DataTable.Value>
							<Link href="mailto:artur@whop.com">artur@whop.com</Link>
						</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label>Company</DataTable.Label>
						<DataTable.Value>
							<Link target="_blank" href="https://whop.com">
								Whop
							</Link>
						</DataTable.Value>
					</DataTable.Item>
				</DataTable.Root>
			</div>
		</div>
	),
};

export const Color: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
			<Typography.Text>
				Use the <Typography.Code>color</Typography.Code> prop on the{" "}
				<Typography.Code>{"<DataTable.Label />"}</Typography.Code> component to assign a
				specific color.
			</Typography.Text>
			<DataTable.Root orientation="vertical" {...args}>
				<DataTable.Item>
					<DataTable.Label color="indigo" style={{ minWidth: 40 }}>
						Color:
					</DataTable.Label>
					<DataTable.Value>Iris</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label color="cyan" style={{ minWidth: 40 }}>
						Color:
					</DataTable.Label>
					<DataTable.Value>Cyan</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label color="lime" style={{ minWidth: 40 }}>
						Color:
					</DataTable.Label>
					<DataTable.Value>Lime</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label color="rose" style={{ minWidth: 40 }}>
						Color:
					</DataTable.Label>
					<DataTable.Value>Crimson</DataTable.Value>
				</DataTable.Item>
			</DataTable.Root>
		</div>
	),
};
export const HighContrast: Story = {
	name: "High Contrast",
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
			<Typography.Text>
				Use the <Typography.Code>highContrast</Typography.Code> prop on the{" "}
				<Typography.Code>{"<DataTable.Label />"}</Typography.Code> component <br /> to
				increase color contrast with the background.
			</Typography.Text>
			<div style={{ display: "flex", gap: "var(--space-9)" }}>
				<DataTable.Root orientation="vertical" {...args}>
					<DataTable.Item>
						<DataTable.Label color="indigo">Name</DataTable.Label>
						<DataTable.Value>Iris</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label color="cyan">Name</DataTable.Label>
						<DataTable.Value>Cyan</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label color="lime">Name</DataTable.Label>
						<DataTable.Value>Lime</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label color="rose">Name</DataTable.Label>
						<DataTable.Value>Crimson</DataTable.Value>
					</DataTable.Item>
				</DataTable.Root>

				<DataTable.Root orientation="vertical" {...args}>
					<DataTable.Item>
						<DataTable.Label color="indigo" highContrast>
							Name
						</DataTable.Label>
						<DataTable.Value>Iris</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label color="cyan" highContrast>
							Name
						</DataTable.Label>
						<DataTable.Value>Cyan</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label color="lime" highContrast>
							Name
						</DataTable.Label>
						<DataTable.Value>Lime</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label color="rose" highContrast>
							Name
						</DataTable.Label>
						<DataTable.Value>Crimson</DataTable.Value>
					</DataTable.Item>
				</DataTable.Root>
			</div>
		</div>
	),
};
