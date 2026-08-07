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
import { Button, Switch, Typography, switchPropDefs } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Controls/Switch",
	component: Switch,
	args: {
		disabled: false,
	},
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	args: {
		size: switchPropDefs.size.default,
		color: switchPropDefs.color.default,
		highContrast: switchPropDefs.highContrast.default,
	},
};

export const Size: Story = {
	render: (args) => (
		<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
			<Switch {...args} size="1" defaultChecked />
			<Switch {...args} size="2" defaultChecked />
			<Switch {...args} size="3" defaultChecked />
		</div>
	),
};

export const Color: Story = {
	render: (args) => (
		<div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
			<Switch {...args} color="indigo" defaultChecked />
			<Switch {...args} color="cyan" defaultChecked />
			<Switch {...args} color="orange" defaultChecked />
			<Switch {...args} color="rose" defaultChecked />
		</div>
	),
};

export const HighContrast: Story = {
	name: "High Contrast",
	render: (args) => (
		<div
			style={{
				display: "inline-grid",
				gridTemplateRows: "repeat(2, 1fr)",
				gap: "var(--space-2)",
				gridAutoFlow: "column",
			}}
		>
			<Switch {...args} color="indigo" defaultChecked />
			<Switch {...args} color="indigo" defaultChecked highContrast />
			<Switch {...args} color="cyan" defaultChecked />
			<Switch {...args} color="cyan" defaultChecked highContrast />
			<Switch {...args} color="orange" defaultChecked />
			<Switch {...args} color="orange" defaultChecked highContrast />
			<Switch {...args} color="rose" defaultChecked />
			<Switch {...args} color="rose" defaultChecked highContrast />
		</div>
	),
};

export const Alignment: Story = {
	name: "Alignment with text",
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<Typography.Text render={<label />} size="2">
				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					<Switch {...args} size="1" defaultChecked /> Sync settings
				</div>
			</Typography.Text>

			<Typography.Text render={<label />} size="3">
				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					<Switch {...args} size="2" defaultChecked /> Sync settings
				</div>
			</Typography.Text>

			<Typography.Text render={<label />} size="4">
				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					<Switch {...args} size="3" defaultChecked /> Sync settings
				</div>
			</Typography.Text>
		</div>
	),
};

export const UncheckedValue: Story = {
	name: "Form with uncheckedValue",
	render: (args) => {
		const [formData, setFormData] = React.useState<string | null>(null);

		const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			const data = new FormData(e.currentTarget);
			const result = Object.fromEntries(data.entries());
			setFormData(JSON.stringify(result, null, 2));
		};

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 400,
				}}
			>
				<Typography.Text size="2" color="gray">
					The <strong>uncheckedValue</strong> prop lets you specify a value to submit when the
					switch is OFF. This is useful when your backend needs to explicitly know the user
					chose "off" vs the field being absent.
				</Typography.Text>

				<form
					onSubmit={handleSubmit}
					style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
				>
					<Typography.Text render={<label />} size="2" weight="bold">
						Notification Preferences
					</Typography.Text>

					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch
								{...args}
								name="email_notifications"
								uncheckedValue="disabled"
								defaultChecked
							/>
							Email notifications
						</div>
					</Typography.Text>

					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch {...args} name="sms_notifications" uncheckedValue="disabled" />
							SMS notifications
						</div>
					</Typography.Text>

					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch {...args} name="marketing" uncheckedValue="opt-out" />
							Marketing emails
						</div>
					</Typography.Text>

					<Button variant="solid" type="submit" style={{ marginTop: "var(--space-2)" }}>
						Submit Form
					</Button>
				</form>

				{formData && (
					<div>
						<Typography.Text size="2" weight="bold">
							Form Data:
						</Typography.Text>
						<pre
							style={{
								background: "var(--gray-3)",
								padding: "var(--space-3)",
								borderRadius: "var(--radius-2)",
								fontSize: "var(--font-size-1)",
								overflow: "auto",
							}}
						>
							{formData}
						</pre>
						<Typography.Text size="1" color="gray">
							Notice: OFF switches submit their uncheckedValue instead of being absent from the
							form data.
						</Typography.Text>
					</div>
				)}
			</div>
		);
	},
};

export const ReadOnly: Story = {
	name: "Read Only",
	render: (args) => {
		const [isPremium] = React.useState(true);
		const [settings] = React.useState({
			darkMode: true,
			autoBackup: false,
			analytics: true,
		});

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
					The <Typography.Code>readOnly</Typography.Code> prop prevents users from toggling a
					switch while still showing its current state. Unlike{" "}
					<Typography.Code>disabled</Typography.Code>, read-only switches remain focusable and
					their values are submitted with forms. This is useful for displaying settings users
					cannot modify, or showing computed/derived states.
				</Typography.Text>
				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
					<Typography.Text size="2" weight="medium">
						Plan Features (Premium Plan)
					</Typography.Text>
					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch {...args} checked={isPremium} readOnly /> Advanced features enabled
						</div>
					</Typography.Text>
					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch {...args} checked={isPremium} readOnly /> Priority support
						</div>
					</Typography.Text>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
					<Typography.Text size="2" weight="medium">
						Organization Settings (managed by admin)
					</Typography.Text>
					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch {...args} checked={settings.darkMode} readOnly /> Dark mode
						</div>
					</Typography.Text>
					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch {...args} checked={settings.autoBackup} readOnly /> Auto backup
						</div>
					</Typography.Text>
					<Typography.Text render={<label />} size="2">
						<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
							<Switch {...args} checked={settings.analytics} readOnly /> Usage analytics
						</div>
					</Typography.Text>
				</div>
			</div>
		);
	},
};

export const InputRef: Story = {
	name: "Input Ref",
	render: (args) => {
		const inputRef = React.useRef<HTMLInputElement>(null);
		const [info, setInfo] = React.useState<string>("Click a button to inspect the input");

		const focusInput = () => {
			inputRef.current?.focus();
			setInfo("Input focused programmatically");
		};

		const checkState = () => {
			const input = inputRef.current;
			if (input) {
				const isChecked = input.checked;
				const name = input.name;
				setInfo(`Name: "${name}", Checked: ${isChecked}`);
			}
		};

		const toggleChecked = () => {
			const input = inputRef.current;
			if (input) {
				input.click();
				setInfo(`Toggled via native click. New state: ${!input.checked}`);
			}
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
					The <Typography.Code>inputRef</Typography.Code> prop provides direct access to the
					hidden native <Typography.Code>&lt;input&gt;</Typography.Code> element. This is
					useful for programmatic focus management, form validation, or integrating with
					third-party libraries that need direct DOM access.
				</Typography.Text>
				<Typography.Text render={<label />} size="2">
					<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
						<Switch {...args} inputRef={inputRef} name="notifications" defaultChecked /> Enable
						notifications
					</div>
				</Typography.Text>
				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					<Button variant="soft" size="1" onClick={focusInput}>
						Focus Input
					</Button>
					<Button variant="soft" size="1" onClick={checkState}>
						Check State
					</Button>
					<Button variant="soft" size="1" onClick={toggleChecked}>
						Toggle via Ref
					</Button>
				</div>
				<Typography.Code style={{ padding: "var(--space-2)" }}>{info}</Typography.Code>
			</div>
		);
	},
};
