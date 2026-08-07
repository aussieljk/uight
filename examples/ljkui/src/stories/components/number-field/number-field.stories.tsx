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
	Button,
	Field,
	Form,
	Input,
	NumberField,
	Typography,
	numberFieldPropDefs,
} from "ljkui";

const meta = {
	title: "Controls/NumberField",
	component: NumberField.Root,
	args: {
		size: numberFieldPropDefs.size.default,
		variant: numberFieldPropDefs.variant.default,
		color: numberFieldPropDefs.color.default,
		buttonLayout: numberFieldPropDefs.buttonLayout.default,
	},
	argTypes: {
		size: {
			control: "select",
			options: numberFieldPropDefs.size.values,
		},
		variant: {
			control: "select",
			options: numberFieldPropDefs.variant.values,
		},
		color: {
			control: "select",
			options: numberFieldPropDefs.color.values,
		},
		buttonLayout: {
			control: "select",
			options: numberFieldPropDefs.buttonLayout.values,
		},
		disabled: {
			control: "boolean",
		},
		readOnly: {
			control: "boolean",
		},
	},
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof NumberField.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: (args) => (
		<div style={{ width: 160 }}>
			<NumberField.Root {...args} defaultValue={50}>
				<NumberField.Input />
			</NumberField.Root>
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
				alignItems: "flex-start",
			}}
		>
			<NumberField.Root {...args} size="1" defaultValue={10}>
				<NumberField.Input />
			</NumberField.Root>

			<NumberField.Root {...args} size="2" defaultValue={20}>
				<NumberField.Input />
			</NumberField.Root>

			<NumberField.Root {...args} size="3" defaultValue={30}>
				<NumberField.Input />
			</NumberField.Root>

			<NumberField.Root {...args} size="4" defaultValue={40}>
				<NumberField.Input />
			</NumberField.Root>
		</div>
	),
};

export const Variant: Story = {
	render: (args) => (
		<div style={{ display: "flex", gap: "var(--space-4)" }}>
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
				<Typography.Text size="2" weight="medium">
					Surface
				</Typography.Text>
				<NumberField.Root {...args} variant="surface" defaultValue={100}>
					<NumberField.Input />
				</NumberField.Root>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
				<Typography.Text size="2" weight="medium">
					Soft
				</Typography.Text>
				<NumberField.Root {...args} variant="soft" defaultValue={100}>
					<NumberField.Input />
				</NumberField.Root>
			</div>
		</div>
	),
};

export const ButtonLayout: Story = {
	name: "Button Layout",
	render: (args) => (
		<div style={{ display: "flex", gap: "var(--space-6)" }}>
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
				<Typography.Text size="2" weight="medium">
					Trailing (default)
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Buttons in row on right
				</Typography.Text>
				<NumberField.Root {...args} buttonLayout="trailing" defaultValue={50}>
					<NumberField.Input />
				</NumberField.Root>
				<Input.Control
					size={args.size}
					variant={args.variant}
					color={args.color}
					disabled={args.disabled}
					placeholder="Input"
				/>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
				<Typography.Text size="2" weight="medium">
					Split
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Buttons on either side
				</Typography.Text>
				<NumberField.Root {...args} buttonLayout="split" defaultValue={50}>
					<NumberField.Input />
				</NumberField.Root>
				<Input.Control
					size={args.size}
					variant={args.variant}
					color={args.color}
					disabled={args.disabled}
					placeholder="Input"
				/>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
				<Typography.Text size="2" weight="medium">
					None
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					No buttons
				</Typography.Text>
				<NumberField.Root {...args} buttonLayout="none" defaultValue={50}>
					<NumberField.Input />
				</NumberField.Root>
				<Input.Control
					size={args.size}
					variant={args.variant}
					color={args.color}
					disabled={args.disabled}
					placeholder="Input"
				/>
			</div>
		</div>
	),
};

export const WithSlot: Story = {
	name: "With Slot",
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-5)",
				maxWidth: 300,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
				<Typography.Text size="2" weight="bold">
					Slot
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Use <Typography.Code size="1">NumberField.Slot</Typography.Code> to add icons or
					other content inside the input area. Works with all button layouts.
				</Typography.Text>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
				<div>
					<Typography.Text
						size="1"
						color="gray"
						style={{ marginBottom: "var(--space-1)", display: "block" }}
					>
						Leading slot (currency)
					</Typography.Text>
					<NumberField.Root
						{...args}
						defaultValue={99.99}
						step={0.01}
						format={{ minimumFractionDigits: 2 }}
					>
						<NumberField.Slot>
							<Icons.CreditCard />
						</NumberField.Slot>
						<NumberField.Input />
					</NumberField.Root>
				</div>

				<div>
					<Typography.Text
						size="1"
						color="gray"
						style={{ marginBottom: "var(--space-1)", display: "block" }}
					>
						Trailing slot (unit)
					</Typography.Text>
					<NumberField.Root {...args} defaultValue={75}>
						<NumberField.Input />
						<NumberField.Slot>kg</NumberField.Slot>
					</NumberField.Root>
				</div>

				<div>
					<Typography.Text
						size="1"
						color="gray"
						style={{ marginBottom: "var(--space-1)", display: "block" }}
					>
						Both slots
					</Typography.Text>
					<NumberField.Root {...args} defaultValue={50} min={0} max={100}>
						<NumberField.Slot>
							<Icons.Hash />
						</NumberField.Slot>
						<NumberField.Input />
						<NumberField.Slot>off</NumberField.Slot>
					</NumberField.Root>
				</div>

				<div>
					<Typography.Text
						size="1"
						color="gray"
						style={{ marginBottom: "var(--space-1)", display: "block" }}
					>
						With split button layout
					</Typography.Text>
					<NumberField.Root {...args} defaultValue={5} buttonLayout="split">
						<NumberField.Slot>Qty</NumberField.Slot>
						<NumberField.Input />
					</NumberField.Root>
				</div>

				<div>
					<Typography.Text
						size="1"
						color="gray"
						style={{ marginBottom: "var(--space-1)", display: "block" }}
					>
						Without buttons
					</Typography.Text>
					<NumberField.Root {...args} defaultValue={42} buttonLayout="none">
						<NumberField.Slot>#</NumberField.Slot>
						<NumberField.Input />
					</NumberField.Root>
				</div>

				<div>
					<Typography.Text
						size="1"
						color="gray"
						style={{ marginBottom: "var(--space-1)", display: "block" }}
					>
						Colored slot
					</Typography.Text>
					<NumberField.Root {...args} defaultValue={100} color="green">
						<NumberField.Slot color="green">
							<Icons.CreditCard />
						</NumberField.Slot>
						<NumberField.Input />
					</NumberField.Root>
				</div>
			</div>
		</div>
	),
};

// Simple icons for slot demos
export const Color: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<NumberField.Root {...args} color="indigo" defaultValue={100}>
				<NumberField.Input />
			</NumberField.Root>

			<NumberField.Root {...args} color="green" defaultValue={100}>
				<NumberField.Input />
			</NumberField.Root>

			<NumberField.Root {...args} color="red" defaultValue={100}>
				<NumberField.Input />
			</NumberField.Root>
		</div>
	),
};

export const MinMax: Story = {
	name: "Min / Max",
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-3)",
				alignItems: "flex-start",
			}}
		>
			<Typography.Text size="2" color="gray">
				Value constrained between 0 and 100
			</Typography.Text>
			<NumberField.Root {...args} defaultValue={50} min={0} max={100}>
				<NumberField.Input />
			</NumberField.Root>
		</div>
	),
};

export const AllowOutOfRange: Story = {
	name: "Allow Out of Range",
	render: (args) => (
		<div style={{ display: "flex", gap: "var(--space-6)" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					maxWidth: 260,
				}}
			>
				<Typography.Text size="2" weight="bold">
					Default (clamped)
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Typing a value outside the range and blurring <strong>silently clamps</strong> it.
					Try typing "10" and pressing Tab.
				</Typography.Text>
				<Form>
					<Field.Root name="age-clamped" validationMode="onBlur">
						<Field.Label>Applicant age</Field.Label>
						<Field.Description>Must be 18–65</Field.Description>
						<NumberField.Root {...args} defaultValue={25} min={18} max={65}>
							<NumberField.Input />
						</NumberField.Root>
						<Field.Error match="rangeUnderflow">Must be at least 18</Field.Error>
						<Field.Error match="rangeOverflow">Must be 65 or under</Field.Error>
					</Field.Root>
				</Form>
				<Typography.Text size="1" color="gray">
					<em>10 → blur → 18 (clamped, errors never fire)</em>
				</Typography.Text>
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					maxWidth: 260,
				}}
			>
				<Typography.Text size="2" weight="bold">
					allowOutOfRange
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					The typed value is <strong>preserved on blur</strong>, letting native{" "}
					<Typography.Code size="1">rangeUnderflow</Typography.Code> /{" "}
					<Typography.Code size="1">rangeOverflow</Typography.Code> validation fire. Buttons
					and arrow keys still clamp.
				</Typography.Text>
				<Form>
					<Field.Root name="age-unclamped" validationMode="onBlur">
						<Field.Label>Applicant age</Field.Label>
						<Field.Description>Must be 18–65</Field.Description>
						<NumberField.Root {...args} defaultValue={25} min={18} max={65} allowOutOfRange>
							<NumberField.Input />
						</NumberField.Root>
						<Field.Error match="rangeUnderflow">Must be at least 18</Field.Error>
						<Field.Error match="rangeOverflow">Must be 65 or under</Field.Error>
					</Field.Root>
				</Form>
				<Typography.Text size="1" color="gray">
					<em>Type "10" and blur — Field.Error appears.</em>
				</Typography.Text>
			</div>
		</div>
	),
};

export const Step: Story = {
	name: "Step Configuration",
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-5)",
				maxWidth: 400,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
				<Typography.Text size="2" weight="bold">
					step
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Base increment amount. Use buttons or arrow keys (↑↓).
				</Typography.Text>
				<NumberField.Root {...args} defaultValue={0} step={5}>
					<NumberField.Input placeholder="step={5}" />
				</NumberField.Root>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
				<Typography.Text size="2" weight="bold">
					smallStep + largeStep
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Hold <Typography.Code size="1">Alt/Option</Typography.Code> for small steps,{" "}
					<Typography.Code size="1">Shift</Typography.Code> for large steps.
				</Typography.Text>
				<NumberField.Root {...args} defaultValue={50} step={1} smallStep={0.1} largeStep={10}>
					<NumberField.Input placeholder="step=1, smallStep=0.1, largeStep=10" />
				</NumberField.Root>
				<Typography.Text size="1" color="gray">
					<em>Normal: ±1 · Alt/Option: ±0.1 · Shift: ±10</em>
				</Typography.Text>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
				<Typography.Text size="2" weight="bold">
					snapOnStep
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Controls snapping behavior when using buttons or arrow keys. Type "7", then press ↑
					to see the difference.
				</Typography.Text>
				<div style={{ display: "flex", gap: "var(--space-3)" }}>
					<div style={{ flex: 1 }}>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							snapOnStep={"{false}"} (default)
						</Typography.Text>
						<NumberField.Root {...args} defaultValue={7} step={5} snapOnStep={false}>
							<NumberField.Input />
						</NumberField.Root>
						<Typography.Text size="1" color="gray">
							<em>7 → ↑ → 12 (adds step)</em>
						</Typography.Text>
					</div>
					<div style={{ flex: 1 }}>
						<Typography.Text
							size="1"
							color="gray"
							style={{ marginBottom: "var(--space-1)", display: "block" }}
						>
							snapOnStep={"{true}"}
						</Typography.Text>
						<NumberField.Root {...args} defaultValue={7} step={5} snapOnStep>
							<NumberField.Input />
						</NumberField.Root>
						<Typography.Text size="1" color="gray">
							<em>7 → ↑ → 10 (snaps to step)</em>
						</Typography.Text>
					</div>
				</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
				<Typography.Text size="2" weight="bold">
					Decimal precision (step=0.01)
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Use small step values for currency or precise decimal inputs.
				</Typography.Text>
				<NumberField.Root {...args} defaultValue={9.99} step={0.01}>
					<NumberField.Input />
				</NumberField.Root>
			</div>
		</div>
	),
};

export const Formatting: Story = {
	name: "format (Intl.NumberFormatOptions)",
	render: (args) => (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-5)",
				maxWidth: 500,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
				<Typography.Text size="2" weight="bold">
					format
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Uses{" "}
					<Typography.Code size="1">
						<a
							href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat"
							target="_blank"
							rel="noopener"
							style={{ color: "inherit" }}
						>
							Intl.NumberFormatOptions
						</a>
					</Typography.Code>{" "}
					to format the displayed value. The actual numeric value remains unchanged.
				</Typography.Text>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
					<Typography.Text size="1" weight="medium">
						Currency
					</Typography.Text>
					<div style={{ display: "flex", gap: "var(--space-3)" }}>
						<NumberField.Root
							{...args}
							defaultValue={1234.56}
							step={0.01}
							format={{ style: "currency", currency: "USD" }}
						>
							<NumberField.Input placeholder="USD" />
						</NumberField.Root>
						<NumberField.Root
							{...args}
							defaultValue={1234.56}
							step={0.01}
							format={{ style: "currency", currency: "EUR" }}
						>
							<NumberField.Input placeholder="EUR" />
						</NumberField.Root>
						<NumberField.Root
							{...args}
							defaultValue={1234.56}
							step={0.01}
							format={{ style: "currency", currency: "JPY" }}
						>
							<NumberField.Input placeholder="JPY" />
						</NumberField.Root>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
					<Typography.Text size="1" weight="medium">
						Percentage
					</Typography.Text>
					<Typography.Text size="1" color="gray">
						Value 0.75 displays as 75%. Use{" "}
						<Typography.Code size="1">step={"{0.01}"}</Typography.Code> for 1% increments.
					</Typography.Text>
					<NumberField.Root
						{...args}
						defaultValue={0.75}
						format={{ style: "percent" }}
						step={0.01}
						style={{ width: 120 }}
					>
						<NumberField.Input />
					</NumberField.Root>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
					<Typography.Text size="1" weight="medium">
						Units
					</Typography.Text>
					<div style={{ display: "flex", gap: "var(--space-3)" }}>
						<NumberField.Root
							{...args}
							defaultValue={75}
							format={{ style: "unit", unit: "kilogram" }}
						>
							<NumberField.Input />
						</NumberField.Root>
						<NumberField.Root
							{...args}
							defaultValue={100}
							format={{ style: "unit", unit: "kilometer-per-hour" }}
						>
							<NumberField.Input />
						</NumberField.Root>
						<NumberField.Root
							{...args}
							defaultValue={24}
							format={{ style: "unit", unit: "celsius" }}
						>
							<NumberField.Input />
						</NumberField.Root>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
					<Typography.Text size="1" weight="medium">
						Decimal precision
					</Typography.Text>
					<div style={{ display: "flex", gap: "var(--space-3)" }}>
						<div>
							<Typography.Text
								size="1"
								color="gray"
								style={{ display: "block", marginBottom: "var(--space-1)" }}
							>
								2 decimals
							</Typography.Text>
							<NumberField.Root
								{...args}
								defaultValue={3.14159}
								format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
							>
								<NumberField.Input style={{ width: 100 }} />
							</NumberField.Root>
						</div>
						<div>
							<Typography.Text
								size="1"
								color="gray"
								style={{ display: "block", marginBottom: "var(--space-1)" }}
							>
								No decimals
							</Typography.Text>
							<NumberField.Root
								{...args}
								defaultValue={1234}
								format={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
							>
								<NumberField.Input style={{ width: 100 }} />
							</NumberField.Root>
						</div>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
					<Typography.Text size="1" weight="medium">
						Compact notation
					</Typography.Text>
					<Typography.Text size="1" color="gray">
						Large numbers displayed as "1.2M" or "5K".
					</Typography.Text>
					<NumberField.Root
						{...args}
						defaultValue={1234567}
						format={{ notation: "compact" }}
						step={1000}
						style={{ width: 120 }}
					>
						<NumberField.Input />
					</NumberField.Root>
				</div>
			</div>
		</div>
	),
};

export const Disabled: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<NumberField.Root {...args} variant="surface" defaultValue={100} disabled>
				<NumberField.Input />
			</NumberField.Root>

			<NumberField.Root {...args} variant="soft" defaultValue={100} disabled>
				<NumberField.Input />
			</NumberField.Root>
		</div>
	),
};

export const ReadOnly: Story = {
	render: (args) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
			<NumberField.Root {...args} variant="surface" defaultValue={100} readOnly>
				<NumberField.Input />
			</NumberField.Root>

			<NumberField.Root {...args} variant="soft" defaultValue={100} readOnly>
				<NumberField.Input />
			</NumberField.Root>
		</div>
	),
};

export const DisabledVsReadOnly: Story = {
	name: "Disabled vs ReadOnly (Accessibility)",
	render: (args) => (
		<div style={{ display: "flex", gap: "var(--space-6)" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					maxWidth: 280,
				}}
			>
				<Typography.Text size="2" weight="bold">
					Disabled
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Use when the field is completely unavailable. The input{" "}
					<strong>cannot be focused</strong> via keyboard (Tab skips it). Screen readers
					announce it as disabled. Value is <strong>not submitted</strong> with the form.
				</Typography.Text>
				<NumberField.Root {...args} defaultValue={100} disabled>
					<NumberField.Input />
				</NumberField.Root>
				<Typography.Text size="1" color="gray">
					<em>Try pressing Tab — the input will be skipped.</em>
				</Typography.Text>
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					maxWidth: 280,
				}}
			>
				<Typography.Text size="2" weight="bold">
					ReadOnly
				</Typography.Text>
				<Typography.Text size="1" color="gray">
					Use when you want to display a value that cannot be changed, but should remain{" "}
					<strong>focusable and selectable</strong>. Users can Tab to it, copy the value, and
					screen readers can announce it. Value <strong>is submitted</strong> with the form.
				</Typography.Text>
				<NumberField.Root {...args} defaultValue={100} readOnly>
					<NumberField.Input />
				</NumberField.Root>
				<Typography.Text size="1" color="gray">
					<em>Try pressing Tab — the input can be focused.</em>
				</Typography.Text>
			</div>
		</div>
	),
};

export const Controlled: Story = {
	render: (args) => {
		const [value, setValue] = React.useState<number | null>(50);

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					alignItems: "flex-start",
				}}
			>
				<NumberField.Root {...args} value={value} onValueChange={(v) => setValue(v)}>
					<NumberField.Input />
				</NumberField.Root>

				<Typography.Code size="2">value: {value === null ? "null" : value}</Typography.Code>

				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					<Button size="1" variant="soft" onClick={() => setValue(0)}>
						Set to 0
					</Button>
					<Button size="1" variant="soft" onClick={() => setValue(100)}>
						Set to 100
					</Button>
					<Button size="1" variant="soft" onClick={() => setValue(null)}>
						Clear
					</Button>
				</div>
			</div>
		);
	},
};

export const OnValueChangeVsCommitted: Story = {
	name: "onValueChange vs onValueCommitted",
	render: (args) => {
		const [changeLog, setChangeLog] = React.useState<string[]>([]);
		const [commitLog, setCommitLog] = React.useState<string[]>([]);

		const addChangeLog = (value: number | null) => {
			const timestamp = new Date().toLocaleTimeString("en-US", {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				fractionalSecondDigits: 3,
			});
			setChangeLog((prev) => [`${timestamp}: ${value ?? "null"}`, ...prev].slice(0, 8));
		};

		const addCommitLog = (value: number | null) => {
			const timestamp = new Date().toLocaleTimeString("en-US", {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				fractionalSecondDigits: 3,
			});
			setCommitLog((prev) => [`${timestamp}: ${value ?? "null"}`, ...prev].slice(0, 8));
		};

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 560,
				}}
			>
				<NumberField.Root
					{...args}
					defaultValue={50}
					onValueChange={(value) => addChangeLog(value)}
					onValueCommitted={(value) => addCommitLog(value)}
				>
					<NumberField.Input />
				</NumberField.Root>

				<Typography.Text size="1" color="gray">
					Try typing, using arrow keys (↑↓), clicking buttons, or blurring the input to see
					when each callback fires.
				</Typography.Text>

				<div style={{ display: "flex", gap: "var(--space-4)" }}>
					<div
						style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", flex: 1 }}
					>
						<Typography.Text size="2" weight="bold" color="blue">
							onValueChange
						</Typography.Text>
						<Typography.Text size="1" color="gray">
							Fires on <strong>every</strong> value change. Use for real-time updates like live
							previews.
						</Typography.Text>
						<div
							style={{
								fontFamily: "monospace",
								fontSize: 11,
								padding: "var(--space-2)",
								background: "var(--color-panel)",
								borderRadius: "var(--radius-2)",
								minHeight: 140,
							}}
						>
							{changeLog.length === 0 ? (
								<span style={{ color: "var(--gray-9)" }}>No events yet...</span>
							) : (
								changeLog.map((log, i) => (
									<div key={i} style={{ opacity: 1 - i * 0.1 }}>
										{log}
									</div>
								))
							)}
						</div>
					</div>

					<div
						style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", flex: 1 }}
					>
						<Typography.Text size="2" weight="bold" color="green">
							onValueCommitted
						</Typography.Text>
						<Typography.Text size="1" color="gray">
							Fires on <strong>blur</strong>, arrow keys (↑↓), or button clicks. Use for API
							calls.
						</Typography.Text>
						<div
							style={{
								fontFamily: "monospace",
								fontSize: 11,
								padding: "var(--space-2)",
								background: "var(--color-panel)",
								borderRadius: "var(--radius-2)",
								minHeight: 140,
							}}
						>
							{commitLog.length === 0 ? (
								<span style={{ color: "var(--gray-9)" }}>No events yet...</span>
							) : (
								commitLog.map((log, i) => (
									<div key={i} style={{ opacity: 1 - i * 0.1 }}>
										{log}
									</div>
								))
							)}
						</div>
					</div>
				</div>

				<Button
					size="1"
					variant="soft"
					onClick={() => {
						setChangeLog([]);
						setCommitLog([]);
					}}
				>
					Clear logs
				</Button>
			</div>
		);
	},
};

export const InputRef: Story = {
	name: "Input Ref",
	render: (args) => {
		const visibleInputRef = React.useRef<HTMLInputElement>(null);
		const hiddenInputRef = React.useRef<HTMLInputElement>(null);

		const focusInput = () => {
			visibleInputRef.current?.focus();
		};

		const selectAll = () => {
			if (visibleInputRef.current) {
				visibleInputRef.current.focus();
				visibleInputRef.current.select();
			}
		};

		const logHiddenValue = () => {
			alert(`Hidden input value: ${hiddenInputRef.current?.value}`);
		};

		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					maxWidth: 450,
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
					<Typography.Text size="2" weight="bold">
						Two ways to access the input
					</Typography.Text>
					<Typography.Text size="1" color="gray">
						<strong>NumberField.Input ref</strong> — Access the visible input for focus,
						selection, etc.
					</Typography.Text>
					<Typography.Text size="1" color="gray">
						<strong>NumberField.Root inputRef</strong> — Access the hidden form input (for form
						libraries).
					</Typography.Text>
				</div>

				<NumberField.Root {...args} defaultValue={1234.56} inputRef={hiddenInputRef}>
					<NumberField.Input ref={visibleInputRef} />
				</NumberField.Root>

				<div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
					<Button size="1" variant="soft" onClick={focusInput}>
						Focus visible input
					</Button>
					<Button size="1" variant="soft" onClick={selectAll}>
						Select all text
					</Button>
					<Button size="1" variant="soft" onClick={logHiddenValue}>
						Read hidden input
					</Button>
				</div>

				<div
					style={{
						padding: "var(--space-3)",
						background: "var(--color-panel)",
						borderRadius: "var(--radius-2)",
					}}
				>
					<Typography.Text
						size="2"
						weight="medium"
						style={{ marginBottom: "var(--space-2)", display: "block" }}
					>
						When to use each:
					</Typography.Text>
					<Typography.Text
						size="1"
						color="gray"
						render={<ul style={{ margin: 0, paddingLeft: "var(--space-4)" }} />}
					>
						<li>
							<strong>Visible input ref:</strong> Focus on modal open, select all for editing,
							custom keyboard shortcuts
						</li>
						<li>
							<strong>Hidden input ref:</strong> Form library integration, accessing the raw
							numeric value
						</li>
					</Typography.Text>
				</div>
			</div>
		);
	},
};

export const FormSubmission: Story = {
	name: "Form Submission",
	render: (args) => {
		const [formData, setFormData] = React.useState<FormData | null>(null);

		const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const data = new FormData(event.currentTarget);
			setFormData(data);
		};

		return (
			<form
				onSubmit={handleSubmit}
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-3)",
					alignItems: "flex-start",
				}}
			>
				<div>
					<Typography.Text render={<label htmlFor="quantity" />} size="2" weight="medium">
						Quantity
					</Typography.Text>
					<NumberField.Root
						{...args}
						id="quantity"
						name="quantity"
						defaultValue={1}
						min={1}
						max={99}
					>
						<NumberField.Input />
					</NumberField.Root>
				</div>

				<div>
					<Typography.Text render={<label htmlFor="price" />} size="2" weight="medium">
						Price
					</Typography.Text>
					<NumberField.Root
						{...args}
						id="price"
						name="price"
						defaultValue={19.99}
						step={0.01}
						format={{ style: "currency", currency: "USD" }}
					>
						<NumberField.Input />
					</NumberField.Root>
				</div>

				<Button type="submit" size="2">
					Submit
				</Button>

				{formData && (
					<Typography.Code size="2" style={{ whiteSpace: "pre" }}>
						{JSON.stringify(Object.fromEntries(formData.entries()), null, 2)}
					</Typography.Code>
				)}
			</form>
		);
	},
};
