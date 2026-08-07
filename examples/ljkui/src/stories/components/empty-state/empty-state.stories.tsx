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
import {
	Avatar,
	AvatarStack,
	Button,
	Checkbox,
	Empty,
	Field,
	Input,
	InputOTP,
	Kbd,
	Link,
	Shine,
	Typography,
	getColorForEmoji,
} from "ljkui";

const meta = {
	title: "Components/Empty",
	component: Empty.Root,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof Empty.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media>
					<Icons.Folder />
				</Empty.Media>
				<Empty.Title>No projects found</Empty.Title>
				<Empty.Description>
					Projects help you organize your work. Get started by creating a new project or
					importing an existing one.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions
				style={{
					display: "flex",
					flexDirection: "row",
				}}
			>
				<Button variant="surface">Clear search</Button>
				<Button variant="solid">Create project</Button>
			</Empty.Actions>
			<Link underline="always" href="#" size="2">
				Learn more
			</Link>
		</Empty.Root>
	),
};

export const SearchResults: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media>
					<Icons.Smile />
				</Empty.Media>
				<Empty.Title>No results found</Empty.Title>
				<Empty.Description>
					We couldn't find anything matching your search. Try using different keywords.
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	),
};

export const Minimal: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Title>Nothing here yet</Empty.Title>
				<Empty.Description>
					This section will be populated once you add some items.
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	),
};

export const Colors: Story = {
	render: () => (
		<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
			<Empty.Root>
				<Empty.Header>
					<Empty.Media color="blue">
						<Icons.File />
					</Empty.Media>
					<Empty.Title>No documents</Empty.Title>
					<Empty.Description>Create your first document to get started.</Empty.Description>
				</Empty.Header>
				<Empty.Actions>
					<Button variant="surface" color="blue">
						<Icons.Plus />
						New document
					</Button>
				</Empty.Actions>
			</Empty.Root>

			<Empty.Root>
				<Empty.Header>
					<Empty.Media color="green">
						<Icons.Plus />
					</Empty.Media>
					<Empty.Title>No deployments</Empty.Title>
					<Empty.Description>Deploy your first app to see it here.</Empty.Description>
				</Empty.Header>
				<Empty.Actions>
					<Button variant="soft" color="green">
						Deploy now
					</Button>
				</Empty.Actions>
			</Empty.Root>

			<Empty.Root>
				<Empty.Header>
					<Empty.Media color="yellow">
						<Icons.Bell />
					</Empty.Media>
					<Empty.Title>No notifications</Empty.Title>
					<Empty.Description>Configure alerts to stay informed.</Empty.Description>
				</Empty.Header>
				<Empty.Actions>
					<Button variant="solid" color="yellow">
						Set up alerts
					</Button>
				</Empty.Actions>
			</Empty.Root>

			<Empty.Root>
				<Empty.Header>
					<Empty.Media color="danger">
						<Icons.Smile />
					</Empty.Media>
					<Empty.Title>Too many errors</Empty.Title>
					<Empty.Description>
						Your application has critical issues that need attention.
					</Empty.Description>
				</Empty.Header>
				<Empty.Actions>
					<Button variant="solid" color="danger">
						View errors
					</Button>
				</Empty.Actions>
			</Empty.Root>
		</div>
	),
};

export const Emojis: Story = {
	render: () => {
		const emojis = [
			{
				emoji: "💕",
				title: "No favorites",
				description: "Save items you love for quick access.",
				action: "Browse items",
			},
			{
				emoji: "🎉",
				title: "No celebrations",
				description: "Complete milestones to earn achievements.",
				action: "View goals",
			},
			{
				emoji: "💩",
				title: "No bugs found",
				description: "Your code is squeaky clean. Nice work!",
				action: "Run tests",
			},
			{
				emoji: "🌱",
				title: "No projects",
				description: "Plant the seed for your next big idea.",
				action: "Start project",
			},
		];

		return (
			<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
				{emojis.map(({ emoji, title, description, action }) => {
					const color = getColorForEmoji(emoji) ?? "gray";
					return (
						<Empty.Root key={emoji}>
							<Empty.Header>
								<Empty.Media color={color}>{emoji}</Empty.Media>
								<Empty.Title>{title}</Empty.Title>
								<Empty.Description>{description}</Empty.Description>
							</Empty.Header>
							<Empty.Actions>
								<Button variant="solid" color={color}>
									{action}
								</Button>
							</Empty.Actions>
						</Empty.Root>
					);
				})}
			</div>
		);
	},
};

export const ShinyEmojis: Story = {
	render: () => {
		const emojis = [
			{
				emoji: "💕",
				title: "No favorites",
				description: "Save items you love for quick access.",
				action: "Browse items",
			},
			{
				emoji: "🎉",
				title: "No celebrations",
				description: "Complete milestones to earn achievements.",
				action: "View goals",
			},
			{
				emoji: "💩",
				title: "No bugs found",
				description: "Your code is squeaky clean. Nice work!",
				action: "Run tests",
			},
			{
				emoji: "🌱",
				title: "No projects",
				description: "Plant the seed for your next big idea.",
				action: "Start project",
			},
		];

		return (
			<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
				{emojis.map(({ emoji, title, description, action }) => {
					const color = getColorForEmoji(emoji) ?? "gray";
					return (
						<Empty.Root key={emoji}>
							<Shine
								style={{
									fontSize: 64,
									lineHeight: 1,
								}}
							>
								{emoji}
							</Shine>
							<Empty.Header>
								<Empty.Title>{title}</Empty.Title>
								<Empty.Description>{description}</Empty.Description>
							</Empty.Header>

							<Empty.Actions>
								<Button variant="solid" color={color}>
									{action}
								</Button>
							</Empty.Actions>
						</Empty.Root>
					);
				})}
			</div>
		);
	},
};

export const WithAvatar: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="ghost">
					<Avatar
						size="5"
						fallback="Luna Rose"
						color="pink"
						src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&q=70&crop=faces&fit=crop"
					/>
				</Empty.Media>
				<Empty.Title>User Offline</Empty.Title>
				<Empty.Description>
					This user is currently offline. You can leave a message to notify them or try again
					later.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<Button>
					<Icons.Message />
					Leave Message
				</Button>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const WithAvatarStack: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="ghost">
					<AvatarStack.Root size="5">
						<AvatarStack.Avatar
							fallback="Cameron Zoub"
							color="blue"
							src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=256&h=256&q=70&crop=focalpoint&fp-x=0.5&fp-y=0.3&fp-z=1&fit=crop"
						/>
						<AvatarStack.Avatar fallback="Luna Rose" color="pink" />
						<AvatarStack.Avatar fallback="Ethan Livers" color="green" />
					</AvatarStack.Root>
				</Empty.Media>
				<Empty.Title>No Team Members</Empty.Title>
				<Empty.Description>
					Invite your team to collaborate on this project.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<Button variant="solid">
					<Icons.Plus />
					Invite Members
				</Button>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const WithTextFieldAndButton: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media color="green">
					<Icons.Users />
				</Empty.Media>
				<Empty.Title>Invite teammates</Empty.Title>
				<Empty.Description>Enter an email address to send an invitation.</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<div style={{ display: "flex", gap: 8, width: "100%" }}>
					<Input.Root style={{ flex: 1 }}>
						<Input.Control type="email" placeholder="colleague@company.com" />
					</Input.Root>
					<Button variant="solid" color="green">
						Invite
					</Button>
				</div>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const WithCheckbox: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media color="blue">
					<Icons.Smile />
				</Empty.Media>
				<Empty.Title>Welcome to the app!</Empty.Title>
				<Empty.Description>
					We've prepared a quick tour to help you get started with the main features.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<Button variant="solid" color="blue">
					Start tour
				</Button>
				<Field.Root>
					<Field.Label
						style={{
							display: "flex",
							margin: "auto",
							alignItems: "center",
							gap: 8,
							cursor: "pointer",
						}}
					>
						<Checkbox size="1" />
						<Typography.Text size="1" color="gray">
							Don't show this again
						</Typography.Text>
					</Field.Label>
				</Field.Root>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const FileDropHint: Story = {
	render: () => (
		<Empty.Root
			style={{
				border: "2px dashed var(--color-stroke)",
			}}
		>
			<Empty.Header>
				<Empty.Media>
					<Icons.List />
				</Empty.Media>
				<Empty.Title>Cloud Storage empty</Empty.Title>
				<Empty.Description>
					Upload files to your cloud storage to access them anywhere.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<Button variant="surface">
					<Icons.Upload />
					Upload files
				</Button>
				<Typography.Text size="1" color="gray">
					Supports PDF, PNG, JPG up to 10MB
				</Typography.Text>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const ErrorWithRetry: Story = {
	render: () => {
		const [loading, setLoading] = React.useState(false);

		const handleRetry = () => {
			setLoading(true);
			setTimeout(() => setLoading(false), 2000);
		};

		return (
			<Empty.Root>
				<Empty.Header>
					<Empty.Media color="danger">
						<Icons.Close />
					</Empty.Media>
					<Empty.Title>Connection failed</Empty.Title>
					<Empty.Description>
						We couldn't connect to the server. Please check your internet connection and try
						again.
					</Empty.Description>
				</Empty.Header>
				<Empty.Actions>
					<Button variant="solid" color="danger" onClick={handleRetry} loading={loading}>
						Try again
					</Button>
					<Link href="#" size="2" underline="always">
						View status page
					</Link>
				</Empty.Actions>
			</Empty.Root>
		);
	},
};

export const Achievement: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="ghost">
					<Typography.Text size="8">🏆</Typography.Text>
				</Empty.Media>
				<Empty.Title>Achievement Unlocked!</Empty.Title>
				<Empty.Description>
					You've completed your first project. Keep going to unlock more achievements and
					rewards.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<Button variant="solid" color="amber">
					View all achievements
				</Button>
				<Typography.Text size="1" color="gray">
					3 of 12 achievements unlocked
				</Typography.Text>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const WithKeyboardShortcut: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media color="gray">
					<Icons.Search />
				</Empty.Media>
				<Empty.Title>Quick search</Empty.Title>
				<Empty.Description>
					Find anything in your workspace instantly using the command palette.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<Typography.Text size="2" color="gray">
						Press
					</Typography.Text>
					<Kbd size="2">⌘</Kbd>
					<Kbd size="2">K</Kbd>
					<Typography.Text size="2" color="gray">
						to search
					</Typography.Text>
				</div>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const WithOTPField: Story = {
	render: () => (
		<Empty.Root>
			<Empty.Header>
				<Empty.Media color="green">
					<Icons.Settings />
				</Empty.Media>
				<Empty.Title>Verify your device</Empty.Title>
				<Empty.Description>
					Enter the 6-digit code sent to your phone ending in ••••42.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<InputOTP.Root
					color="green"
					maxLength={6}
					render={({ slots }) => (
						<>
							<InputOTP.Group>
								{slots.slice(0, 3).map((slot, index) => (
									<InputOTP.Slot key={index} {...slot} />
								))}
							</InputOTP.Group>
							<InputOTP.Separator />
							<InputOTP.Group>
								{slots.slice(3).map((slot, index) => (
									<InputOTP.Slot key={index + 3} {...slot} />
								))}
							</InputOTP.Group>
						</>
					)}
				/>
				<Button
					variant="ghost"
					size="2"
					color="green"
					style={{ textDecoration: "underline" }}
				>
					Resend code
				</Button>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const NotFound404: Story = {
	render: () => (
		<Empty.Root style={{ maxWidth: 480 }}>
			<Empty.Header>
				<Empty.Title size="5" weight="bold">
					404 - Not Found
				</Empty.Title>
				<Empty.Description size="3">
					The page you're looking for doesn't exist. Try searching for what you need below.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<Input.Root size="3" style={{ width: "100%" }}>
					<Input.Slot>
						<Icons.Search />
					</Input.Slot>
					<Input.Control placeholder="Try searching for pages..." />
				</Input.Root>
				<Button size="2" variant="ghost" color="gray" style={{ textDecoration: "underline" }}>
					Contact support
				</Button>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const AIAssistant: Story = {
	render: () => (
		<Empty.Root style={{ maxWidth: 420 }}>
			<Empty.Header>
				<Empty.Media>
					<Icons.Star />
				</Empty.Media>
				<Empty.Title>Start a conversation</Empty.Title>
				<Empty.Description>
					Ask me anything — I can help you write, brainstorm, analyze data, or answer
					questions.
				</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
					<Button size="1" variant="surface" color="gray" style={{ cursor: "pointer" }}>
						✍️ Help me write
					</Button>
					<Button size="1" variant="surface" color="gray" style={{ cursor: "pointer" }}>
						💡 Brainstorm ideas
					</Button>
					<Button size="1" variant="surface" color="gray" style={{ cursor: "pointer" }}>
						📊 Analyze data
					</Button>
					<Button size="1" variant="surface" color="gray" style={{ cursor: "pointer" }}>
						🔍 Research topic
					</Button>
					<Button size="1" variant="surface" color="gray" style={{ cursor: "pointer" }}>
						💬 Answer questions
					</Button>
				</div>
				<Typography.Text size="1" color="gray">
					Press{" "}
					<Kbd size="1" style={{ marginInline: 2 }}>
						/
					</Kbd>{" "}
					to see all commands
				</Typography.Text>
			</Empty.Actions>
		</Empty.Root>
	),
};

export const UpgradeToPro: Story = {
	render: () => (
		<Empty.Root
			style={{
				maxWidth: 420,
				borderRadius: 24,
				border: "1px solid var(--color-stroke)",
				background: "var(--color-panel-solid)",
				paddingTop: 48,
			}}
		>
			<Empty.Header>
				<Empty.Media color="amber">
					<Icons.Zap />
				</Empty.Media>
				<Empty.Title>Unlock Pro features</Empty.Title>
				<Empty.Description>
					You've hit the free plan limit. Upgrade to continue and access premium features.
				</Empty.Description>
			</Empty.Header>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 8,
					width: "100%",
					padding: 12,
					background: "var(--gray-a2)",
					borderRadius: "var(--radius-3)",
				}}
			>
				{[
					"Unlimited projects",
					"Priority support",
					"Advanced analytics",
					"Custom integrations",
				].map((feature) => (
					<div key={feature} style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<Icons.Check style={{ color: "var(--green-a11)" }} />
						<Typography.Text size="2">{feature}</Typography.Text>
					</div>
				))}
			</div>
			<Empty.Actions
				style={{ display: "flex", gap: 8, flexDirection: "row", width: "100%" }}
			>
				<Button size="3" variant="surface" color="gray" style={{ flex: 1 }}>
					Maybe later
				</Button>
				<Button size="3" variant="solid" color="amber" style={{ flex: 1 }}>
					Upgrade — $9/mo
				</Button>
			</Empty.Actions>
		</Empty.Root>
	),
};
