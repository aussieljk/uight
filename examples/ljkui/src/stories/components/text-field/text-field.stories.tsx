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
import { Button, IconButton, Input, Typography, inputPropDefs } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Controls/Input",
	component: Input.Root,
	args: {
		size: inputPropDefs.size.default,
		variant: inputPropDefs.variant.default,
		color: inputPropDefs.color.default,
	},
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof Input.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	render: (args) => (
		<div style={{ width: 300 }}>
			<Input.Root {...args}>
				<Input.Slot>
					<Icons.Search />
				</Input.Slot>
				<Input.Control placeholder="Search the docs…" />
			</Input.Root>
		</div>
	),
};

export const Size: Story = {
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-3)",
				maxWidth: 400,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
				<Input.Root {...args} size="1">
					<Input.Slot>
						<Icons.Search />
					</Input.Slot>
					<Input.Control placeholder="Search the docs…" />
				</Input.Root>
				<Button size="1" variant={args.variant}>
					Search
				</Button>
			</div>

			<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
				<Input.Root {...args} size="2">
					<Input.Slot>
						<Icons.Search />
					</Input.Slot>
					<Input.Control placeholder="Search the docs…" />
					<Input.Slot>
						<IconButton color="gray" size="1" variant="ghost">
							<Icons.DotsHorizontal />
						</IconButton>
					</Input.Slot>
				</Input.Root>
				<Button size="2" variant={args.variant}>
					Search
				</Button>
			</div>

			<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
				<Input.Root {...args} size="3">
					<Input.Slot>
						<Icons.Search />
					</Input.Slot>
					<Input.Control placeholder="Search the docs…" />
					<Input.Slot style={{ paddingRight: "var(--space-3)" }}>
						<IconButton color="gray" size="2" variant="ghost">
							<Icons.DotsHorizontal />
						</IconButton>
					</Input.Slot>
				</Input.Root>
				<Button size="3" variant={args.variant}>
					Search
				</Button>
			</div>
			<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
				<Input.Root {...args} size="4">
					<Input.Slot>
						<Icons.Search />
					</Input.Slot>
					<Input.Control placeholder="Search the docs…" />
					<Input.Slot style={{ paddingRight: "var(--space-3)" }}>
						<IconButton color="gray" size="2" variant="ghost">
							<Icons.DotsHorizontal />
						</IconButton>
					</Input.Slot>
				</Input.Root>
				<Button size="4" variant={args.variant}>
					Search
				</Button>
			</div>
		</div>
	),
};

export const Variant: Story = {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	render: ({ ref, ...args }) => (
		<div style={{ display: "flex", flexDirection: "row", gap: "var(--space-5)" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					maxWidth: 400,
				}}
			>
				<Input.Control placeholder="Search the docs…" {...args} variant="surface" />
				<Input.Control placeholder="Search the docs…" {...args} variant="soft" />
			</div>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					maxWidth: 400,
				}}
			>
				<Input.Control disabled placeholder="Search the docs…" {...args} variant="surface" />
				<Input.Control disabled placeholder="Search the docs…" {...args} variant="soft" />
			</div>
		</div>
	),
};

export const Color: Story = {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	render: ({ ref, ...args }) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-3)",
				maxWidth: 400,
			}}
		>
			<Input.Control {...args} placeholder="Search the docs…" color="indigo" />
			<Input.Control {...args} placeholder="Search the docs…" color="green" />
			<Input.Control {...args} placeholder="Search the docs…" color="red" />
		</div>
	),
};

export const WithSlot: Story = {
	name: "With Slot",
	render: (args) => {
		const [showPassword, setShowPassword] = React.useState(false);
		const [searchValue, setSearchValue] = React.useState("");

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-5)",
					maxWidth: 320,
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
					<Typography.Text size="2" weight="bold">
						Slot
					</Typography.Text>
					<Typography.Text size="1" color="gray">
						Use <Typography.Code size="1">Input.Slot</Typography.Code> to add icons, buttons, or
						text inside the input area.
					</Typography.Text>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
					<div>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							Leading icon
						</Typography.Text>
						<Input.Root {...args}>
							<Input.Slot>
								<Icons.Search />
							</Input.Slot>
							<Input.Control placeholder="Search…" />
						</Input.Root>
					</div>

					<div>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							Trailing icon
						</Typography.Text>
						<Input.Root {...args}>
							<Input.Control placeholder="Enter URL…" />
							<Input.Slot>
								<Icons.Link />
							</Input.Slot>
						</Input.Root>
					</div>

					<div>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							Both slots
						</Typography.Text>
						<Input.Root {...args}>
							<Input.Slot>
								<Icons.Mail />
							</Input.Slot>
							<Input.Control placeholder="Email address" />
							<Input.Slot>@company.com</Input.Slot>
						</Input.Root>
					</div>

					<div>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							With icon button (password toggle)
						</Typography.Text>
						<Input.Root {...args}>
							<Input.Slot>
								<Icons.Lock />
							</Input.Slot>
							<Input.Control
								type={showPassword ? "text" : "password"}
								placeholder="Password"
								defaultValue="secret"
							/>
							<Input.Slot>
								<IconButton
									size="1"
									variant="ghost"
									color="gray"
									onClick={() => setShowPassword(!showPassword)}
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
								</IconButton>
							</Input.Slot>
						</Input.Root>
					</div>

					<div>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							Clearable search
						</Typography.Text>
						<Input.Root {...args}>
							<Input.Slot>
								<Icons.Search />
							</Input.Slot>
							<Input.Control
								placeholder="Search…"
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
							/>
							{searchValue && (
								<Input.Slot>
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										onClick={() => setSearchValue("")}
										aria-label="Clear search"
									>
										<Icons.Close />
									</IconButton>
								</Input.Slot>
							)}
						</Input.Root>
					</div>

					<div>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							With copy button
						</Typography.Text>
						<Input.Root {...args}>
							<Input.Control readOnly defaultValue="https://example.com/share/abc123" />
							<Input.Slot>
								<IconButton
									size="1"
									variant="ghost"
									color="gray"
									onClick={() => navigator.clipboard.writeText("https://example.com/share/abc123")}
									aria-label="Copy to clipboard"
								>
									<Icons.Copy />
								</IconButton>
							</Input.Slot>
						</Input.Root>
					</div>

					<div>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							Colored slot
						</Typography.Text>
						<Input.Root {...args} color="green">
							<Input.Slot color="green">$</Input.Slot>
							<Input.Control placeholder="Amount" />
							<Input.Slot>USD</Input.Slot>
						</Input.Root>
					</div>
				</div>
			</div>
		);
	},
};
