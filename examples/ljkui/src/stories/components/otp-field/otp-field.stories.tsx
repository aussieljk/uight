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

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import React from "react";
import { InputOTP, Typography } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
	title: "Controls/InputOTP",
	component: InputOTP.Root,
	args: {} as React.ComponentProps<typeof InputOTP.Root>,
	parameters: {
		// Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
		layout: "centered",
	},
	// This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
	tags: ["autodocs"],
} satisfies Meta<typeof InputOTP.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
	render: (args) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { children, ...otherArgs } = args;
		return (
			<div>
				<InputOTP.Root
					{...otherArgs}
					maxLength={6}
					render={({ slots }) => (
						<>
							<InputOTP.Group>
								{slots.slice(0, 3).map((slot, index) => (
									<InputOTP.Slot key={index} {...slot} />
								))}{" "}
							</InputOTP.Group>
							<InputOTP.Separator />
							<InputOTP.Group>
								{slots.slice(3).map((slot, index) => (
									<InputOTP.Slot key={index} {...slot} />
								))}
							</InputOTP.Group>
						</>
					)}
				/>
			</div>
		);
	},
};

export const Pattern: Story = {
	render: (args) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { children, ...otherArgs } = args;
		return (
			<div>
				<InputOTP.Root
					{...otherArgs}
					maxLength={6}
					pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
					render={({ slots }) => (
						<InputOTP.Group>
							{slots.map((slot, index) => (
								<InputOTP.Slot key={index} {...slot} />
							))}{" "}
						</InputOTP.Group>
					)}
				/>
			</div>
		);
	},
};

export const Separator: Story = {
	render: (args) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { children, ...otherArgs } = args;
		return (
			<div>
				<InputOTP.Root
					{...otherArgs}
					maxLength={6}
					render={({ slots }) => (
						<InputOTP.Group style={{ gap: 4 }}>
							{slots.map((slot, index) => (
								<React.Fragment key={index}>
									<InputOTP.Slot style={{ borderRadius: 10 }} {...slot} />
									{index !== slots.length - 1 && <InputOTP.Separator />}
								</React.Fragment>
							))}{" "}
						</InputOTP.Group>
					)}
				/>
			</div>
		);
	},
};

export const Controlled: Story = {
	render: (args) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { children, ...otherArgs } = args;
		const [value, setValue] = React.useState("");

		return (
			<div>
				<div style={{ marginBottom: 16 }}>
					<InputOTP.Root
						{...otherArgs}
						maxLength={6}
						value={value}
						onChange={(value) => setValue(value)}
						render={({ slots }) => (
							<InputOTP.Group>
								{slots.map((slot, index) => (
									<InputOTP.Slot key={index} {...slot} />
								))}{" "}
							</InputOTP.Group>
						)}
					/>
				</div>
				<Typography.Text align="center" color="gray" size="2" render={<div />}>
					{value === "" ? <>Enter your one-time password.</> : <>You entered: {value}</>}
				</Typography.Text>
			</div>
		);
	},
};
