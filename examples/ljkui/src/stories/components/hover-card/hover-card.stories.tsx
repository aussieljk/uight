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

import {
	Avatar,
	Button,
	DataTable,
	HoverCard,
	Inset,
	Link,
	Typography,
	hoverCardContentPropDefs,
} from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Components/HoverCard",
	component: HoverCard.Content,
	args: {},

	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof HoverCard.Content>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: (args) => (
		<Typography.Text>
			Follow{" "}
			<HoverCard.Root>
				<HoverCard.Trigger>
					<Link href="https://github.com/whopio/frosted-ui" target="_blank">
						frosted-ui
					</Link>
				</HoverCard.Trigger>
				<HoverCard.Content {...args}>
					<div style={{ display: "flex", gap: "var(--space-4)" }}>
						<Avatar size="3" fallback="FUI" />
						<div>
							<Typography.Heading size="3" render={<h3 />}>
								Frosted UI
							</Typography.Heading>
							<Typography.Text render={<div />} size="2" color="gray">
								frosted-ui
							</Typography.Text>

							<Typography.Text
								render={<div />}
								size="2"
								style={{ maxWidth: 300, marginTop: "var(--space-3)" }}
							>
								React components library built on top of Base UI primitives.
							</Typography.Text>
						</div>
					</div>
				</HoverCard.Content>
			</HoverCard.Root>{" "}
			for updates.
		</Typography.Text>
	),
};

export const Size: Story = {
	args: {
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: (args) => (
		<div style={{ display: "flex", gap: "var(--space-4)" }}>
			<HoverCard.Root>
				<HoverCard.Trigger>
					<Link href="#">Size one</Link>
				</HoverCard.Trigger>
				<HoverCard.Content {...args} size="1">
					<Typography.Text render={<div />} size="1" style={{ maxWidth: 325 }}>
						<Typography.Strong>Typography</Typography.Strong> is the art and technique of
						arranging type to make written language legible, readable and appealing when
						displayed.
					</Typography.Text>
				</HoverCard.Content>
			</HoverCard.Root>

			<HoverCard.Root>
				<HoverCard.Trigger>
					<Link href="#">Size two</Link>
				</HoverCard.Trigger>
				<HoverCard.Content {...args} size="2">
					<Typography.Text render={<div />} size="2" style={{ maxWidth: 350 }}>
						<Typography.Strong>Typography</Typography.Strong> is the art and technique of
						arranging type to make written language legible, readable and appealing when
						displayed.
					</Typography.Text>
				</HoverCard.Content>
			</HoverCard.Root>

			<HoverCard.Root>
				<HoverCard.Trigger>
					<Link href="#">Size three</Link>
				</HoverCard.Trigger>
				<HoverCard.Content {...args} size="3">
					<Typography.Text render={<div />} size="3" style={{ maxWidth: 400 }}>
						<Typography.Strong>Typography</Typography.Strong> is the art and technique of
						arranging type to make written language legible, readable and appealing when
						displayed.
					</Typography.Text>
				</HoverCard.Content>
			</HoverCard.Root>
		</div>
	),
};

export const InsetContent: Story = {
	name: "With inset content",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: (args) => (
		<Typography.Text>
			Technology revolutionized{" "}
			<HoverCard.Root>
				<HoverCard.Trigger>
					<Link href="#">typography</Link>
				</HoverCard.Trigger>

				<HoverCard.Content {...args}>
					<div style={{ display: "flex" }}>
						<Inset side="left" pr="current">
							<img
								src="https://images.unsplash.com/photo-1617050318658-a9a3175e34cb?&auto=format&fit=crop&w=300&q=80"
								alt="Bold typography"
								style={{
									display: "block",
									objectFit: "cover",
									height: "100%",
									width: 150,
									backgroundColor: "var(--gray-5)",
								}}
							/>
						</Inset>

						<Typography.Text size="2" style={{ maxWidth: 250 }} render={<p />}>
							<Typography.Strong>Typography</Typography.Strong> is the art and technique of
							arranging type to make written language legible, readable and appealing when
							displayed. The arrangement of type involves selecting typefaces, point sizes, line
							lengths, line-spacing (leading), and letter-spacing (tracking)…
						</Typography.Text>
					</div>
				</HoverCard.Content>
			</HoverCard.Root>{" "}
			in the latter twentieth century.
		</Typography.Text>
	),
};

export const Delays: Story = {
	name: "Custom Delays",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-4)",
				maxWidth: 500,
			}}
		>
			<Typography.Text>
				The <Typography.Code>delay</Typography.Code> and{" "}
				<Typography.Code>closeDelay</Typography.Code> props on{" "}
				<Typography.Code>HoverCard.Trigger</Typography.Code> control how long to wait before
				opening/closing the hover card. This is useful for preventing accidental triggers.
			</Typography.Text>

			<div style={{ display: "flex", gap: "var(--space-4)" }}>
				<HoverCard.Root>
					<HoverCard.Trigger delay={0} closeDelay={0}>
						<Link href="#">Instant (0ms)</Link>
					</HoverCard.Trigger>
					<HoverCard.Content {...args}>
						<Typography.Text size="2">
							Opens and closes instantly with no delay.
						</Typography.Text>
					</HoverCard.Content>
				</HoverCard.Root>

				<HoverCard.Root>
					<HoverCard.Trigger delay={200} closeDelay={150}>
						<Link href="#">Default (200/150ms)</Link>
					</HoverCard.Trigger>
					<HoverCard.Content {...args}>
						<Typography.Text size="2">
							Uses the default delays: 200ms open, 150ms close.
						</Typography.Text>
					</HoverCard.Content>
				</HoverCard.Root>

				<HoverCard.Root>
					<HoverCard.Trigger delay={600} closeDelay={300}>
						<Link href="#">Slow (600/300ms)</Link>
					</HoverCard.Trigger>
					<HoverCard.Content {...args}>
						<Typography.Text size="2">
							Slower delays for more deliberate interactions.
						</Typography.Text>
					</HoverCard.Content>
				</HoverCard.Root>
			</div>
		</div>
	),
};

export const Controlled: Story = {
	name: "Controlled Mode",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: function ControlledDemo(args) {
		const [open, setOpen] = React.useState(false);
		const [hoverCount, setHoverCount] = React.useState(0);

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 500,
				}}
			>
				<Typography.Text>
					Use <Typography.Code>open</Typography.Code> and{" "}
					<Typography.Code>onOpenChange</Typography.Code> props on{" "}
					<Typography.Code>HoverCard.Root</Typography.Code> for controlled mode.
				</Typography.Text>

				<DataTable.Root>
					<DataTable.Item>
						<DataTable.Label>Open state</DataTable.Label>
						<DataTable.Value>
							<Typography.Code>{String(open)}</Typography.Code>
						</DataTable.Value>
					</DataTable.Item>
					<DataTable.Item>
						<DataTable.Label>Hover count</DataTable.Label>
						<DataTable.Value>
							<Typography.Code>{hoverCount}</Typography.Code>
						</DataTable.Value>
					</DataTable.Item>
				</DataTable.Root>

				<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
					<Button variant="soft" size="1" onClick={() => setOpen(!open)}>
						Toggle programmatically
					</Button>
					<Button variant="soft" size="1" color="gray" onClick={() => setHoverCount(0)}>
						Reset count
					</Button>
				</div>

				<Typography.Text>
					Hover over{" "}
					<HoverCard.Root
						open={open}
						onOpenChange={(newOpen) => {
							setOpen(newOpen);
							if (newOpen) setHoverCount((c) => c + 1);
						}}
					>
						<HoverCard.Trigger>
							<Link href="#">this link</Link>
						</HoverCard.Trigger>
						<HoverCard.Content {...args}>
							<Typography.Text size="2">
								This is a controlled hover card. You've hovered {hoverCount} times.
							</Typography.Text>
						</HoverCard.Content>
					</HoverCard.Root>{" "}
					to see the hover card.
				</Typography.Text>
			</div>
		);
	},
};

export const Positioning: Story = {
	name: "Positioning",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
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
				Use <Typography.Code>side</Typography.Code> and{" "}
				<Typography.Code>alignment</Typography.Code> props to control positioning.
			</Typography.Text>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: "var(--space-4)",
					padding: "var(--space-6)",
				}}
			>
				{/* Top row */}
				<div />
				<div style={{ textAlign: "center" }}>
					<HoverCard.Root>
						<HoverCard.Trigger>
							<Link href="#">Top</Link>
						</HoverCard.Trigger>
						<HoverCard.Content {...args} side="top" align="center">
							<Typography.Text size="2">Positioned on top, centered</Typography.Text>
						</HoverCard.Content>
					</HoverCard.Root>
				</div>
				<div />

				{/* Middle row */}
				<div style={{ textAlign: "center" }}>
					<HoverCard.Root>
						<HoverCard.Trigger>
							<Link href="#">Left</Link>
						</HoverCard.Trigger>
						<HoverCard.Content {...args} side="left" align="center">
							<Typography.Text size="2">Positioned on left, centered</Typography.Text>
						</HoverCard.Content>
					</HoverCard.Root>
				</div>
				<div />
				<div style={{ textAlign: "center" }}>
					<HoverCard.Root>
						<HoverCard.Trigger>
							<Link href="#">Right</Link>
						</HoverCard.Trigger>
						<HoverCard.Content {...args} side="right" align="center">
							<Typography.Text size="2">Positioned on right, centered</Typography.Text>
						</HoverCard.Content>
					</HoverCard.Root>
				</div>

				{/* Bottom row */}
				<div />
				<div style={{ textAlign: "center" }}>
					<HoverCard.Root>
						<HoverCard.Trigger>
							<Link href="#">Bottom</Link>
						</HoverCard.Trigger>
						<HoverCard.Content {...args} side="bottom" align="center">
							<Typography.Text size="2">Positioned on bottom, centered</Typography.Text>
						</HoverCard.Content>
					</HoverCard.Root>
				</div>
				<div />
			</div>

			<Typography.Text size="2" color="gray">
				Alignment options: <Typography.Code>start</Typography.Code>,{" "}
				<Typography.Code>center</Typography.Code>, <Typography.Code>end</Typography.Code>
			</Typography.Text>
		</div>
	),
};

export const ProfileCard: Story = {
	name: "Profile Card (Real World)",
	args: {
		size: "2",
		variant: "translucent",
	},
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-4)",
				maxWidth: 500,
			}}
		>
			<Typography.Text>
				A common use case is showing user profiles on hover. This provides quick context
				without navigating away.
			</Typography.Text>

			<Typography.Text>
				The project was created by{" "}
				<HoverCard.Root>
					<HoverCard.Trigger>
						<Link href="https://github.com/whopio">@whopio</Link>
					</HoverCard.Trigger>
					<HoverCard.Content {...args}>
						<div style={{ display: "flex", gap: "var(--space-4)" }}>
							<Avatar
								size="4"
								src="https://avatars.githubusercontent.com/u/91078276?s=200&v=4"
								fallback="W"
								shape="square"
							/>
							<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
								<Typography.Heading size="3" render={<h3 />}>
									Whop
								</Typography.Heading>
								<Typography.Text render={<div />} size="2" color="gray">
									@whopio
								</Typography.Text>
								<Typography.Text
									render={<div />}
									size="2"
									style={{ marginTop: "var(--space-2)", maxWidth: 280 }}
								>
									Build, sell, and engage with software products. We make it easy for creators to
									launch and grow their digital businesses.
								</Typography.Text>
								<div
									style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}
								>
									<Typography.Text size="2" color="gray">
										<Typography.Strong>127</Typography.Strong> repos
									</Typography.Text>
									<Typography.Text size="2" color="gray">
										<Typography.Strong>42</Typography.Strong> members
									</Typography.Text>
								</div>
							</div>
						</div>
					</HoverCard.Content>
				</HoverCard.Root>{" "}
				and is open source.
			</Typography.Text>
		</div>
	),
};

export const LinkPreview: Story = {
	name: "Link Preview",
	args: {
		size: "2",
		variant: "translucent",
	},
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-4)",
				maxWidth: 500,
			}}
		>
			<Typography.Text>
				HoverCard is perfect for showing link previews, giving users a glimpse of what they'll
				see before clicking.
			</Typography.Text>

			<Typography.Text>
				The principles of good{" "}
				<HoverCard.Root>
					<HoverCard.Trigger>
						<Link href="https://en.wikipedia.org/wiki/Typography" target="_blank">
							typography
						</Link>
					</HoverCard.Trigger>
					<HoverCard.Content {...args}>
						<Inset side="top" pb="current">
							<img
								src="https://images.unsplash.com/photo-1619615391095-dfa29e1672ef?q=80&w=448&h=200&fit=crop"
								alt="Typography example"
								style={{
									display: "block",
									width: "100%",
									height: 120,
									objectFit: "cover",
									backgroundColor: "var(--gray-5)",
								}}
							/>
						</Inset>
						<div style={{ maxWidth: 300 }}>
							<Typography.Text size="2" weight="medium" render={<div />}>
								Typography - Wikipedia
							</Typography.Text>
							<Typography.Text
								size="1"
								color="gray"
								render={<div />}
								style={{ marginTop: "var(--space-1)" }}
							>
								en.wikipedia.org
							</Typography.Text>
							<Typography.Text size="2" render={<div />} style={{ marginTop: "var(--space-2)" }}>
								Typography is the art and science of arranging type to make written language
								clear, visually appealing, and effective in communication.
							</Typography.Text>
						</div>
					</HoverCard.Content>
				</HoverCard.Root>{" "}
				remain into the digital age.
			</Typography.Text>
		</div>
	),
};

export const OpenChangeComplete: Story = {
	name: "Open Change Complete Callback",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: function OpenChangeCompleteDemo(args) {
		const [events, setEvents] = React.useState<string[]>([]);

		const addEvent = (event: string) => {
			const time = new Date().toLocaleTimeString("en-US", { hour12: false });
			setEvents((prev) => [`${time} - ${event}`, ...prev].slice(0, 6));
		};

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 500,
				}}
			>
				<Typography.Text>
					<Typography.Code>onOpenChange</Typography.Code> fires immediately, while{" "}
					<Typography.Code>onOpenChangeComplete</Typography.Code> fires after animations
					complete. Useful for cleanup actions that should wait for exit animations.
				</Typography.Text>

				<Typography.Text>
					Hover over{" "}
					<HoverCard.Root
						onOpenChange={(open) => addEvent(`onOpenChange: ${open}`)}
						onOpenChangeComplete={(open) => addEvent(`onOpenChangeComplete: ${open}`)}
					>
						<HoverCard.Trigger>
							<Link href="#">this link</Link>
						</HoverCard.Trigger>
						<HoverCard.Content {...args}>
							<Typography.Text size="2">
								Watch the event log to see the timing difference.
							</Typography.Text>
						</HoverCard.Content>
					</HoverCard.Root>{" "}
					to see the events.
				</Typography.Text>

				<div
					style={{
						padding: "var(--space-3)",
						backgroundColor: "var(--gray-2)",
						borderRadius: "var(--radius-2)",
						fontFamily: "monospace",
						fontSize: "var(--font-size-1)",
						minHeight: 100,
					}}
				>
					<Typography.Text
						size="1"
						color="gray"
						weight="medium"
						style={{ display: "block", marginBottom: "var(--space-2)" }}
					>
						Event Log:
					</Typography.Text>
					{events.length === 0 ? (
						<Typography.Text size="1" color="gray">
							Hover to generate events...
						</Typography.Text>
					) : (
						events.map((event, i) => (
							<div key={i} style={{ color: "var(--gray-11)" }}>
								{event}
							</div>
						))
					)}
				</div>
			</div>
		);
	},
};

export const Anchor: Story = {
	name: "Custom Anchor",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: function AnchorDemo(args) {
		const avatarRef = React.useRef<HTMLDivElement>(null);

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 500,
				}}
			>
				<Typography.Text>
					Use the <Typography.Code>anchor</Typography.Code> prop on{" "}
					<Typography.Code>HoverCard.Content</Typography.Code> to position relative to a
					different element.
				</Typography.Text>

				<div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
					<div style={{ display: "flex" }} ref={avatarRef}>
						<Avatar size="4" fallback="JD" shape="circle" color="lime" />
					</div>

					<HoverCard.Root>
						<HoverCard.Trigger>
							<Link href="#" color="lime">
								John Doe
							</Link>
						</HoverCard.Trigger>
						<HoverCard.Content {...args} anchor={avatarRef}>
							<div style={{ display: "flex", gap: "var(--space-3)" }}>
								<div>
									<Typography.Text size="2" weight="medium" render={<div />}>
										John Doe
									</Typography.Text>
									<Typography.Text size="2" color="gray" render={<div />}>
										Software Engineer
									</Typography.Text>
									<Typography.Text
										size="2"
										render={<div />}
										style={{ marginTop: "var(--space-2)", maxWidth: 200 }}
									>
										Building great user experiences with React and TypeScript.
									</Typography.Text>
								</div>
							</div>
						</HoverCard.Content>
					</HoverCard.Root>

					<Typography.Text size="2" color="gray">
						← Hover the link, card appears near avatar
					</Typography.Text>
				</div>
			</div>
		);
	},
};

export const WithButton: Story = {
	name: "With Button Trigger",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-4)",
				maxWidth: 500,
			}}
		>
			<Typography.Text>
				The trigger can be any element. Use the <Typography.Code>render</Typography.Code>{" "}
				pattern to wrap buttons or other interactive elements.
			</Typography.Text>

			<div style={{ display: "flex", gap: "var(--space-3)" }}>
				<HoverCard.Root>
					<HoverCard.Trigger>
						<Button variant="soft">Hover me</Button>
					</HoverCard.Trigger>
					<HoverCard.Content {...args}>
						<Typography.Text size="2">
							This hover card is triggered by a button instead of a link.
						</Typography.Text>
					</HoverCard.Content>
				</HoverCard.Root>

				<HoverCard.Root>
					<HoverCard.Trigger>
						<Avatar fallback="AB" shape="circle" style={{ cursor: "pointer" }} />
					</HoverCard.Trigger>
					<HoverCard.Content {...args}>
						<div style={{ display: "flex", gap: "var(--space-3)" }}>
							<div>
								<Typography.Text size="2" weight="medium" render={<div />}>
									Alice Brown
								</Typography.Text>
								<Typography.Text size="2" color="gray" render={<div />}>
									Product Designer
								</Typography.Text>
							</div>
						</div>
					</HoverCard.Content>
				</HoverCard.Root>
			</div>
		</div>
	),
};

export const CollisionBoundary: Story = {
	name: "Collision Boundary",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: function CollisionBoundaryDemo(args) {
		const [boundary, setBoundary] = React.useState<HTMLDivElement | null>(null);

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 600,
				}}
			>
				<Typography.Text>
					The <Typography.Code>collisionBoundary</Typography.Code> prop constrains the hover
					card to stay within a specific element instead of the viewport.
				</Typography.Text>

				<div
					ref={setBoundary}
					style={{
						border: "2px dashed var(--gray-6)",
						borderRadius: "var(--radius-3)",
						padding: "var(--space-6)",
						height: 300,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						position: "relative",
					}}
				>
					<Typography.Text
						size="1"
						color="gray"
						style={{ position: "absolute", top: "var(--space-2)", left: "var(--space-2)" }}
					>
						Collision boundary
					</Typography.Text>
					<HoverCard.Root>
						<HoverCard.Trigger>
							<Link href="#">Hover me</Link>
						</HoverCard.Trigger>
						<HoverCard.Content
							{...args}
							collisionBoundary={boundary ?? undefined}
							side="bottom"
						>
							<Typography.Text size="2" style={{ maxWidth: 250 }}>
								This hover card is constrained to stay within the dashed boundary, not the
								viewport.
							</Typography.Text>
						</HoverCard.Content>
					</HoverCard.Root>
				</div>
			</div>
		);
	},
};

export const CollisionAvoidance: Story = {
	name: "Collision Avoidance",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
	render: function CollisionAvoidanceDemo(args) {
		const [boundary, setBoundary] = React.useState<HTMLDivElement | null>(null);

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 600,
				}}
			>
				<Typography.Text>
					The <Typography.Code>collisionAvoidance</Typography.Code> prop controls how the hover
					card avoids collisions. It accepts an object with{" "}
					<Typography.Code>side</Typography.Code> and <Typography.Code>align</Typography.Code>{" "}
					properties.
				</Typography.Text>
				<ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
					<li>
						<Typography.Text size="2">
							<Typography.Code>side: 'flip'</Typography.Code> (default) - Flips to opposite side
							if not enough space
						</Typography.Text>
					</li>
					<li>
						<Typography.Text size="2">
							<Typography.Code>side: 'none'</Typography.Code> - No side collision avoidance
						</Typography.Text>
					</li>
					<li>
						<Typography.Text size="2">
							<Typography.Code>align: 'flip' | 'shift' | 'none'</Typography.Code> - Controls
							alignment axis behavior
						</Typography.Text>
					</li>
				</ul>

				<div
					ref={setBoundary}
					style={{
						height: 400,
						overflow: "auto",
						border: "1px solid var(--gray-6)",
						borderRadius: "var(--radius-2)",
						position: "relative",
					}}
				>
					<div style={{ height: 400 }} />
					<div
						style={{
							display: "flex",
							gap: "var(--space-6)",
							justifyContent: "center",
							padding: "var(--space-4)",
						}}
					>
						<HoverCard.Root>
							<HoverCard.Trigger>
								<Link href="#">flip (default)</Link>
							</HoverCard.Trigger>
							<HoverCard.Content
								{...args}
								side="top"
								collisionAvoidance={{ side: "flip" }}
								collisionBoundary={boundary ?? undefined}
							>
								<Typography.Text size="2" style={{ maxWidth: 200 }}>
									This will flip to bottom if there's not enough space on top.
								</Typography.Text>
							</HoverCard.Content>
						</HoverCard.Root>

						<HoverCard.Root>
							<HoverCard.Trigger>
								<Link href="#">align: shift</Link>
							</HoverCard.Trigger>
							<HoverCard.Content
								{...args}
								side="top"
								collisionAvoidance={{ side: "flip", align: "shift" }}
								collisionBoundary={boundary ?? undefined}
							>
								<Typography.Text size="2" style={{ maxWidth: 200 }}>
									Flips side, shifts alignment to stay in view.
								</Typography.Text>
							</HoverCard.Content>
						</HoverCard.Root>

						<HoverCard.Root>
							<HoverCard.Trigger>
								<Link href="#">none</Link>
							</HoverCard.Trigger>
							<HoverCard.Content
								{...args}
								side="top"
								collisionAvoidance={{ side: "none", align: "none" }}
								collisionBoundary={boundary ?? undefined}
							>
								<Typography.Text size="2" style={{ maxWidth: 200 }}>
									This won't avoid collisions at all.
								</Typography.Text>
							</HoverCard.Content>
						</HoverCard.Root>
					</div>
					<div style={{ height: 400 }} />
				</div>

				<Typography.Text size="2" color="gray">
					Scroll the box above so triggers are near the top edge to see flip vs none behavior.
				</Typography.Text>
			</div>
		);
	},
};

export const Sticky: Story = {
	name: "Sticky",
	args: {
		size: hoverCardContentPropDefs.size.default,
		variant: hoverCardContentPropDefs.variant.default,
	},
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
				The <Typography.Code>sticky</Typography.Code> prop controls whether the hover card
				repositions to stay in the viewport when the anchor scrolls toward the edge.
			</Typography.Text>
			<ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
				<li>
					<Typography.Text size="2">
						<Typography.Code>sticky=false</Typography.Code> (default) - The popup hides when
						anchor scrolls out of viewport
					</Typography.Text>
				</li>
				<li>
					<Typography.Text size="2">
						<Typography.Code>sticky=true</Typography.Code> - The popup stays at viewport edge as
						anchor scrolls away
					</Typography.Text>
				</li>
			</ul>

			<div style={{ display: "flex", gap: "var(--space-4)" }}>
				<HoverCard.Root>
					<HoverCard.Trigger>
						<Link href="#">sticky=false</Link>
					</HoverCard.Trigger>
					<HoverCard.Content {...args} sticky={false} side="top">
						<Typography.Text size="2" style={{ maxWidth: 200 }}>
							Scroll the page down - this hover card will disappear when the anchor leaves the
							viewport.
						</Typography.Text>
					</HoverCard.Content>
				</HoverCard.Root>

				<HoverCard.Root>
					<HoverCard.Trigger>
						<Link href="#">sticky=true</Link>
					</HoverCard.Trigger>
					<HoverCard.Content {...args} sticky={true} side="top">
						<Typography.Text size="2" style={{ maxWidth: 200 }}>
							Scroll the page down - this hover card will stick to the viewport edge.
						</Typography.Text>
					</HoverCard.Content>
				</HoverCard.Root>
			</div>

			<Typography.Text size="2" color="gray">
				Open a hover card, then scroll the page (not a container) to see the difference. Works
				best when this story is near the top of the viewport.
			</Typography.Text>

			{/* Spacer to enable page scrolling */}
			<div style={{ height: 800 }} />
		</div>
	),
};

export const DisableAnchorTracking: Story = {
	name: "Disable Anchor Tracking",
	args: {
		size: "2",
		variant: "translucent",
	},
	render: function Render(args) {
		const [position, setPosition] = React.useState(0);

		return (
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
				<Typography.Text>
					The <Typography.Code>disableAnchorTracking</Typography.Code> prop controls whether
					the hover card repositions when the anchor element moves due to layout changes (not
					scrolling). This is useful for performance optimization or when you want the hover
					card to stay in its original position.
				</Typography.Text>

				<Button size="1" onClick={() => setPosition((p) => (p === 0 ? 80 : 0))}>
					Move anchors
				</Button>

				<div style={{ display: "flex", gap: "var(--space-6)" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
						<Typography.Text size="1" weight="medium">
							Default (tracking enabled)
						</Typography.Text>
						<Typography.Text size="1" color="gray" style={{ maxWidth: 180 }}>
							Hover card follows when anchor moves
						</Typography.Text>
						<div
							style={{
								width: 220,
								height: 100,
								border: "1px solid var(--gray-6)",
								borderRadius: "var(--radius-2)",
								padding: "var(--space-3)",
								position: "relative",
							}}
						>
							<HoverCard.Root open>
								<HoverCard.Trigger>
									<Link
										href="#"
										style={{
											display: "inline-block",
											transform: `translateX(${position}px)`,
											transition: "transform 300ms ease",
										}}
									>
										Hover target
									</Link>
								</HoverCard.Trigger>
								<HoverCard.Content {...args} side="bottom">
									<Typography.Text size="2">Follows anchor movement</Typography.Text>
								</HoverCard.Content>
							</HoverCard.Root>
						</div>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
						<Typography.Text size="1" weight="medium">
							disableAnchorTracking=true
						</Typography.Text>
						<Typography.Text size="1" color="gray" style={{ maxWidth: 180 }}>
							Hover card stays in original position
						</Typography.Text>
						<div
							style={{
								width: 220,
								height: 100,
								border: "1px solid var(--gray-6)",
								borderRadius: "var(--radius-2)",
								padding: "var(--space-3)",
								position: "relative",
							}}
						>
							<HoverCard.Root open>
								<HoverCard.Trigger>
									<Link
										href="#"
										style={{
											display: "inline-block",
											transform: `translateX(${position}px)`,
											transition: "transform 300ms ease",
										}}
									>
										Hover target
									</Link>
								</HoverCard.Trigger>
								<HoverCard.Content {...args} disableAnchorTracking side="bottom">
									<Typography.Text size="2">Stays in place</Typography.Text>
								</HoverCard.Content>
							</HoverCard.Root>
						</div>
					</div>
				</div>

				<Typography.Text size="1" color="gray">
					Click the button above to move the anchor elements. The left hover card will follow,
					while the right one stays fixed at its original position.
				</Typography.Text>
			</div>
		);
	},
};

interface UserPayload {
	name: string;
	username: string;
	avatar: string;
	bio: string;
	repos: number;
	followers: number;
}

const users: Record<string, UserPayload> = {
	whop: {
		name: "Whop",
		username: "@whopio",
		avatar: "https://avatars.githubusercontent.com/u/91078276?s=200&v=4",
		bio: "Build, sell, and engage with software products.",
		repos: 127,
		followers: 1200,
	},
	vercel: {
		name: "Vercel",
		username: "@vercel",
		avatar: "https://avatars.githubusercontent.com/u/14985020?s=200&v=4",
		bio: "Develop. Preview. Ship. Creators of Next.js.",
		repos: 154,
		followers: 8500,
	},
	baseui: {
		name: "Base UI",
		username: "@base-ui-components",
		avatar: "https://avatars.githubusercontent.com/u/195592562?s=200&v=4",
		bio: "Unstyled UI components for building accessible web apps and design systems.",
		repos: 1,
		followers: 430,
	},
};

export const MultipleTriggers: Story = {
	name: "Multiple Triggers",
	args: {
		size: "2",
		variant: "translucent",
	},
	render: function MultipleTriggersDemo(args) {
		const handle = React.useMemo(() => HoverCard.createHandle<UserPayload>(), []);

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 500,
				}}
			>
				<Typography.Text>
					A single hover card can be opened by multiple triggers using{" "}
					<Typography.Code>HoverCard.createHandle()</Typography.Code>. Each trigger can pass a
					unique <Typography.Code>payload</Typography.Code> to render different content in the
					same card.
				</Typography.Text>

				<Typography.Text>
					Check out{" "}
					<HoverCard.Trigger handle={handle} payload={users.whop}>
						<Link href="https://github.com/whopio">Whop</Link>
					</HoverCard.Trigger>
					,{" "}
					<HoverCard.Trigger handle={handle} payload={users.vercel}>
						<Link href="https://github.com/vercel">Vercel</Link>
					</HoverCard.Trigger>
					, or{" "}
					<HoverCard.Trigger handle={handle} payload={users.baseui}>
						<Link href="https://github.com/base-ui-components">Base UI</Link>
					</HoverCard.Trigger>{" "}
					on GitHub.
				</Typography.Text>

				<HoverCard.Root handle={handle}>
					{({ payload }) => (
						<HoverCard.Content {...args}>
							{payload !== undefined && (
								<div style={{ display: "flex", gap: "var(--space-4)" }}>
									<Avatar
										size="4"
										src={payload.avatar}
										fallback={payload.name[0]}
										shape="square"
									/>
									<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
										<Typography.Heading size="3" render={<h3 />}>
											{payload.name}
										</Typography.Heading>
										<Typography.Text render={<div />} size="2" color="gray">
											{payload.username}
										</Typography.Text>
										<Typography.Text
											render={<div />}
											size="2"
											style={{ marginTop: "var(--space-2)", maxWidth: 280 }}
										>
											{payload.bio}
										</Typography.Text>
										<div
											style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}
										>
											<Typography.Text size="2" color="gray">
												<Typography.Strong>{payload.repos}</Typography.Strong> repos
											</Typography.Text>
											<Typography.Text size="2" color="gray">
												<Typography.Strong>{payload.followers.toLocaleString()}</Typography.Strong>{" "}
												followers
											</Typography.Text>
										</div>
									</div>
								</div>
							)}
						</HoverCard.Content>
					)}
				</HoverCard.Root>
			</div>
		);
	},
};
