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
	Card,
	RadioButtonGroup,
	Tooltip,
	Typography,
	radioGroupPropDefs,
} from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Controls/RadioButtonGroup",
	component: RadioButtonGroup.Root,
	args: {
		disabled: false,
	},
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof RadioButtonGroup.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	args: {
		color: radioGroupPropDefs.color.default,
		highContrast: radioGroupPropDefs.highContrast.default,
	},
	render: (args) => (
		<RadioButtonGroup.Root defaultValue="1" {...args}>
			<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
				<RadioButtonGroup.Item value="1">
					<div
						style={{
							display: "flex",
							padding: "8px 40px 8px 24px",
							borderRadius: 8,
							border: "1px solid var(--gray-a7)",
							gap: "var(--space-2)",
							alignItems: "center",
						}}
					>
						<RadioButtonGroup.Icon style={{ marginLeft: -12 }} />
						<Typography.Text>One</Typography.Text>
					</div>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="2">
					<div
						style={{
							display: "flex",
							padding: "8px 40px 8px 24px",
							borderRadius: 8,
							border: "1px solid var(--gray-a7)",
							gap: "var(--space-2)",
							alignItems: "center",
						}}
					>
						<RadioButtonGroup.Icon style={{ marginLeft: -12 }} />
						<Typography.Text>Two</Typography.Text>
					</div>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="3">
					<div
						style={{
							display: "flex",
							padding: "8px 40px 8px 24px",
							borderRadius: 8,
							border: "1px solid var(--gray-a7)",
							gap: "var(--space-2)",
							alignItems: "center",
						}}
					>
						<RadioButtonGroup.Icon style={{ marginLeft: -12 }} />
						<Typography.Text>Three</Typography.Text>
					</div>
				</RadioButtonGroup.Item>
			</div>
		</RadioButtonGroup.Root>
	),
};

export const HighContrast: Story = {
	args: {
		color: radioGroupPropDefs.color.default,
		highContrast: true,
	},
	render: (args) => (
		<RadioButtonGroup.Root defaultValue="1" {...args}>
			<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
				<Tooltip content="Lime">
					<div>
						<RadioButtonGroup.Item value="1">
							<div
								style={{
									width: 48,
									height: 48,
									borderRadius: 16,
									background: "var(--lime-9)",
								}}
							/>
						</RadioButtonGroup.Item>
					</div>
				</Tooltip>
				<Tooltip content="Teal">
					<div>
						<RadioButtonGroup.Item value="2">
							<div
								style={{
									width: 48,
									height: 48,
									borderRadius: 16,
									background: "var(--teal-9)",
								}}
							/>
						</RadioButtonGroup.Item>
					</div>
				</Tooltip>
				<Tooltip content="Gold">
					<div>
						<RadioButtonGroup.Item value="3">
							<div
								style={{
									width: 48,
									height: 48,
									borderRadius: 16,
									background: "var(--gold-9)",
								}}
							/>
						</RadioButtonGroup.Item>
					</div>
				</Tooltip>
			</div>
		</RadioButtonGroup.Root>
	),
};

export const WithCard: Story = {
	args: {
		color: radioGroupPropDefs.color.default,
		highContrast: radioGroupPropDefs.highContrast.default,
	},
	render: (args) => (
		<RadioButtonGroup.Root defaultValue="1" {...args}>
			<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
				<RadioButtonGroup.Item value="1">
					<Card size="2" variant="surface">
						<div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
							<Avatar size="3" fallback="AB" color="lime" />
							<div>
								<Typography.Text render={<div />} size="2" weight="bold">
									Artur Bień
								</Typography.Text>
								<Typography.Text render={<div />} size="2" color="gray">
									UI engineer
								</Typography.Text>
							</div>
						</div>
					</Card>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="2">
					<Card size="2" variant="surface">
						<div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
							<Avatar size="3" fallback="IM" color="sky" />
							<div>
								<Typography.Text render={<div />} size="2" weight="bold">
									Ilya Miskov
								</Typography.Text>
								<Typography.Text render={<div />} size="2" color="gray">
									Designer
								</Typography.Text>
							</div>
						</div>
					</Card>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="3">
					<Card size="2" variant="surface">
						<div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
							<Avatar size="3" fallback="SS" color="orange" />
							<div>
								<Typography.Text render={<div />} size="2" weight="bold">
									Steven Schwartz
								</Typography.Text>
								<Typography.Text render={<div />} size="2" color="gray">
									CEO
								</Typography.Text>
							</div>
						</div>
					</Card>
				</RadioButtonGroup.Item>
			</div>
		</RadioButtonGroup.Root>
	),
};

export const Color: Story = {
	render: (args) => (
		<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "column" }}>
			{(["indigo", "cyan", "orange", "lime"] as const).map((color) => (
				<RadioButtonGroup.Root {...args} color={color} key={color} defaultValue="1">
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						{["1", "2", "3"].map((value) => (
							<RadioButtonGroup.Item value={value} key={value}>
								<Card
									size="3"
									variant="surface"
									style={
										{
											width: 100,
											height: 100,
											"--card-border-radius": "20px",
										} as React.CSSProperties
									}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											height: "100%",
											width: "100%",
										}}
									>
										{value}
									</div>

									<RadioButtonGroup.Icon
										style={{
											position: "absolute",
											top: 12,
											right: 12,
										}}
									/>
								</Card>
							</RadioButtonGroup.Item>
						))}
					</div>
				</RadioButtonGroup.Root>
			))}
		</div>
	),
};

export const Disabled: Story = {
	name: "Disabled (Group)",
	render: (args) => (
		<RadioButtonGroup.Root {...args} defaultValue="1" disabled>
			<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
				<RadioButtonGroup.Item value="1">
					<Card size="2" variant="surface">
						<Typography.Text>Option 1</Typography.Text>
					</Card>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="2">
					<Card size="2" variant="surface">
						<Typography.Text>Option 2</Typography.Text>
					</Card>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="3">
					<Card size="2" variant="surface">
						<Typography.Text>Option 3</Typography.Text>
					</Card>
				</RadioButtonGroup.Item>
			</div>
		</RadioButtonGroup.Root>
	),
};

export const DisabledItem: Story = {
	name: "Disabled (Single Item)",
	render: (args) => (
		<RadioButtonGroup.Root {...args} defaultValue="1">
			<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
				<RadioButtonGroup.Item value="1">
					<Card size="2" variant="surface">
						<Typography.Text>Option 1</Typography.Text>
					</Card>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="2" disabled>
					<Card size="2" variant="surface">
						<Typography.Text color="gray">Option 2 (disabled)</Typography.Text>
					</Card>
				</RadioButtonGroup.Item>
				<RadioButtonGroup.Item value="3">
					<Card size="2" variant="surface">
						<Typography.Text>Option 3</Typography.Text>
					</Card>
				</RadioButtonGroup.Item>
			</div>
		</RadioButtonGroup.Root>
	),
};

type PlanType = "starter" | "pro" | "enterprise";

const planPrices: Record<PlanType, number> = {
	starter: 0,
	pro: 29,
	enterprise: 99,
};

export const OnValueChange: Story = {
	name: "onValueChange (TypeScript)",
	render: function Render(args) {
		const [selected, setSelected] = React.useState<PlanType>("starter");

		const handleChange = (value: unknown) => {
			setSelected(value as PlanType);
		};

		return (
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
				<Typography.Text render={<div />} size="2">
					Accept <Typography.Code>unknown</Typography.Code> and cast inside the handler. Use{" "}
					<Typography.Code>RadioButtonGroup.ChangeEventDetails</Typography.Code> for the second
					parameter if needed.
				</Typography.Text>

				<RadioButtonGroup.Root {...args} value={selected} onValueChange={handleChange}>
					<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
						<RadioButtonGroup.Item value="starter">
							<Card size="2" variant="surface" style={{ width: 140 }}>
								<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
									<Typography.Text weight="bold">Starter</Typography.Text>
									<Typography.Text size="1" color="gray">
										Free forever
									</Typography.Text>
								</div>
							</Card>
						</RadioButtonGroup.Item>
						<RadioButtonGroup.Item value="pro">
							<Card size="2" variant="surface" style={{ width: 140 }}>
								<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
									<Typography.Text weight="bold">Pro</Typography.Text>
									<Typography.Text size="1" color="gray">
										$29/month
									</Typography.Text>
								</div>
							</Card>
						</RadioButtonGroup.Item>
						<RadioButtonGroup.Item value="enterprise">
							<Card size="2" variant="surface" style={{ width: 140 }}>
								<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
									<Typography.Text weight="bold">Enterprise</Typography.Text>
									<Typography.Text size="1" color="gray">
										$99/month
									</Typography.Text>
								</div>
							</Card>
						</RadioButtonGroup.Item>
					</div>
				</RadioButtonGroup.Root>

				<div
					style={{
						padding: "var(--space-3)",
						background: "var(--gray-3)",
						borderRadius: "var(--radius-2)",
					}}
				>
					<Typography.Text render={<div />} size="2">
						Selected: <Typography.Code>{selected}</Typography.Code>
					</Typography.Text>
					<Typography.Text render={<div />} size="2">
						Price: <strong>${planPrices[selected]}/mo</strong>
					</Typography.Text>
				</div>
			</div>
		);
	},
};

export const OnValueChangeEvent: Story = {
	name: "onValueChange (Event Details)",
	render: function Render(args) {
		const [selected, setSelected] = React.useState<string>("free");
		const [lastEvent, setLastEvent] = React.useState<{
			type: string;
			value: string;
			wasCanceled: boolean;
		} | null>(null);

		const handleChange = (
			value: unknown,
			eventDetails: RadioButtonGroup.ChangeEventDetails,
		) => {
			// Premium tier requires confirmation
			if (value === "premium") {
				const confirmed = window.confirm("Premium tier costs $99/month. Continue?");
				if (!confirmed) {
					eventDetails.cancel();
					setLastEvent({
						type: eventDetails.event.type,
						value: value as string,
						wasCanceled: true,
					});
					return;
				}
			}

			setSelected(value as string);
			setLastEvent({
				type: eventDetails.event.type,
				value: value as string,
				wasCanceled: false,
			});
		};

		return (
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
				<Typography.Text render={<div />} size="2">
					The <Typography.Code>eventDetails</Typography.Code> parameter provides{" "}
					<Typography.Code>cancel()</Typography.Code> to prevent changes. Try selecting
					Premium.
				</Typography.Text>

				<RadioButtonGroup.Root {...args} value={selected} onValueChange={handleChange}>
					<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
						<RadioButtonGroup.Item value="free">
							<Card size="2" variant="surface" style={{ width: 120 }}>
								<Typography.Text weight="bold">Free</Typography.Text>
							</Card>
						</RadioButtonGroup.Item>
						<RadioButtonGroup.Item value="pro">
							<Card size="2" variant="surface" style={{ width: 120 }}>
								<Typography.Text weight="bold">Pro</Typography.Text>
							</Card>
						</RadioButtonGroup.Item>
						<RadioButtonGroup.Item value="premium">
							<Card size="2" variant="surface" style={{ width: 120 }}>
								<Typography.Text weight="bold">Premium ⚠️</Typography.Text>
							</Card>
						</RadioButtonGroup.Item>
					</div>
				</RadioButtonGroup.Root>

				<div
					style={{
						padding: "var(--space-3)",
						background: "var(--gray-3)",
						borderRadius: "var(--radius-2)",
					}}
				>
					<Typography.Text
						render={<div />}
						size="2"
						style={{ marginBottom: "var(--space-2)" }}
					>
						Current: <Typography.Code>{selected}</Typography.Code>
					</Typography.Text>
					{lastEvent && (
						<>
							<Typography.Text render={<div />} size="1" color="gray">
								Last event: {lastEvent.type}
							</Typography.Text>
							<Typography.Text render={<div />} size="1" color="gray">
								Attempted value: {lastEvent.value}
							</Typography.Text>
							<Typography.Text
								render={<div />}
								size="1"
								color={lastEvent.wasCanceled ? "red" : "green"}
							>
								{lastEvent.wasCanceled ? "✗ Change was canceled" : "✓ Change was applied"}
							</Typography.Text>
						</>
					)}
				</div>
			</div>
		);
	},
};

export const FormName: Story = {
	name: "Form Name",
	render: function Render(args) {
		const INITIAL_PLAN = "monthly";
		const INITIAL_PAYMENT = "card";

		const [plan, setPlan] = React.useState(INITIAL_PLAN);
		const [payment, setPayment] = React.useState(INITIAL_PAYMENT);
		const [formData, setFormData] = React.useState<Record<string, string> | null>(null);

		const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			const data = new FormData(e.currentTarget);
			const entries: Record<string, string> = {};
			data.forEach((value, key) => {
				entries[key] = value as string;
			});
			setFormData(entries);
		};

		const handleReset = () => {
			setPlan(INITIAL_PLAN);
			setPayment(INITIAL_PAYMENT);
			setFormData(null);
		};

		return (
			<form
				onSubmit={handleSubmit}
				onReset={handleReset}
				style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
			>
				<Typography.Text render={<div />} size="2">
					Use the <Typography.Code>name</Typography.Code> prop to include the RadioButtonGroup
					value in form submissions. Listen to the form's{" "}
					<Typography.Code>onReset</Typography.Code> event to reset controlled state when using{" "}
					<Typography.Code>type="reset"</Typography.Code> buttons.
				</Typography.Text>

				<div>
					<Typography.Text
						render={<div />}
						size="2"
						weight="medium"
						style={{ marginBottom: "var(--space-2)" }}
					>
						Subscription Plan
					</Typography.Text>
					<RadioButtonGroup.Root
						{...args}
						name="plan"
						value={plan}
						onValueChange={(v) => setPlan(v as string)}
					>
						<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
							<RadioButtonGroup.Item value="monthly">
								<Card size="2" variant="surface">
									<Typography.Text>Monthly</Typography.Text>
								</Card>
							</RadioButtonGroup.Item>
							<RadioButtonGroup.Item value="yearly">
								<Card size="2" variant="surface">
									<Typography.Text>Yearly</Typography.Text>
								</Card>
							</RadioButtonGroup.Item>
						</div>
					</RadioButtonGroup.Root>
				</div>

				<div>
					<Typography.Text
						render={<div />}
						size="2"
						weight="medium"
						style={{ marginBottom: "var(--space-2)" }}
					>
						Payment Method
					</Typography.Text>
					<RadioButtonGroup.Root
						{...args}
						name="payment"
						value={payment}
						onValueChange={(v) => setPayment(v as string)}
					>
						<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
							<RadioButtonGroup.Item value="card">
								<Card size="2" variant="surface">
									<Typography.Text>Card</Typography.Text>
								</Card>
							</RadioButtonGroup.Item>
							<RadioButtonGroup.Item value="paypal">
								<Card size="2" variant="surface">
									<Typography.Text>PayPal</Typography.Text>
								</Card>
							</RadioButtonGroup.Item>
						</div>
					</RadioButtonGroup.Root>
				</div>

				<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
					<Button size="1" type="submit">
						Submit
					</Button>
					<Button size="1" type="reset" variant="soft">
						Reset
					</Button>
				</div>

				{formData && (
					<Typography.Code
						style={{
							padding: "var(--space-3)",
							background: "var(--gray-3)",
							borderRadius: "var(--radius-2)",
							display: "block",
							whiteSpace: "pre",
						}}
					>
						{JSON.stringify(formData, null, 2)}
					</Typography.Code>
				)}
			</form>
		);
	},
};

export const InputRefGroup: Story = {
	name: "Input Ref (Group)",
	render: function Render(args) {
		const inputRef = React.useRef<HTMLInputElement>(null);
		const [error, setError] = React.useState<string | null>(null);
		const [submitted, setSubmitted] = React.useState<string | null>(null);

		const handleSubmit = (e: React.FormEvent) => {
			e.preventDefault();
			const input = inputRef.current;
			if (!input) return;

			if (!input.validity.valid) {
				setError("Please select a plan");
				setSubmitted(null);
				input.focus();
			} else {
				setError(null);
				setSubmitted(`Selected: ${input.value}`);
			}
		};

		return (
			<form
				onSubmit={handleSubmit}
				style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
			>
				<Typography.Text render={<div />} size="2">
					Use <Typography.Code>inputRef</Typography.Code> for form validation. Try submitting
					without selecting an option.
				</Typography.Text>

				<div>
					<Typography.Text
						render={<div />}
						size="2"
						weight="medium"
						style={{ marginBottom: "var(--space-2)" }}
					>
						Select a Plan
					</Typography.Text>
					<RadioButtonGroup.Root
						{...args}
						name="plan"
						required
						inputRef={inputRef}
						onValueChange={() => setError(null)}
					>
						<div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "row" }}>
							<RadioButtonGroup.Item value="basic">
								<Card size="2" variant="surface">
									<Typography.Text>Basic</Typography.Text>
								</Card>
							</RadioButtonGroup.Item>
							<RadioButtonGroup.Item value="pro">
								<Card size="2" variant="surface">
									<Typography.Text>Pro</Typography.Text>
								</Card>
							</RadioButtonGroup.Item>
							<RadioButtonGroup.Item value="enterprise">
								<Card size="2" variant="surface">
									<Typography.Text>Enterprise</Typography.Text>
								</Card>
							</RadioButtonGroup.Item>
						</div>
					</RadioButtonGroup.Root>
					{error && (
						<Typography.Text
							render={<div />}
							size="1"
							color="red"
							style={{ marginTop: "var(--space-2)" }}
						>
							{error}
						</Typography.Text>
					)}
				</div>

				<div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
					<Button size="1" type="submit">
						Submit
					</Button>
					{submitted && (
						<Typography.Text render={<span />} size="2" color="green">
							✓ {submitted}
						</Typography.Text>
					)}
				</div>
			</form>
		);
	},
};

export const TypeSafeValues: Story = {
	name: "Type-Safe Values",
	render: () => {
		type Plan = "basic" | "pro" | "enterprise";
		const [plan, setPlan] = React.useState<Plan>("basic");

		return (
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
				<Typography.Text render={<div />} size="2">
					The component is generic — pass a string union type to get autocomplete on{" "}
					<Typography.Code>value</Typography.Code> props and type-check{" "}
					<Typography.Code>onValueChange</Typography.Code>.
				</Typography.Text>

				<RadioButtonGroup.Root<Plan> value={plan} onValueChange={setPlan}>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<RadioButtonGroup.Item value="basic">
							<Card size="2" variant="surface">
								<Typography.Text>Basic</Typography.Text>
							</Card>
						</RadioButtonGroup.Item>
						<RadioButtonGroup.Item value="pro">
							<Card size="2" variant="surface">
								<Typography.Text>Pro</Typography.Text>
							</Card>
						</RadioButtonGroup.Item>
						<RadioButtonGroup.Item value="enterprise">
							<Card size="2" variant="surface">
								<Typography.Text>Enterprise</Typography.Text>
							</Card>
						</RadioButtonGroup.Item>
					</div>
				</RadioButtonGroup.Root>

				<Typography.Text size="2">
					Selected: <Typography.Code>{plan}</Typography.Code>
				</Typography.Text>

				<Typography.Text size="1" color="gray">
					Try changing a value to <Typography.Code>&quot;premum&quot;</Typography.Code> —
					TypeScript will catch the typo!
				</Typography.Text>
			</div>
		);
	},
};
