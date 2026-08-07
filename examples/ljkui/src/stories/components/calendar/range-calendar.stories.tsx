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

import {
	DateValue,
	getLocalTimeZone,
	isWeekend,
	parseDate,
	today,
} from "@internationalized/date";
import { useLocale } from "@react-aria/i18n";
import React from "react";
import { Calendar } from "ljkui";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Calendar.Range> = {
	title: "Controls/Dates/Calendar.Range",
	component: Calendar.Range,
	args: {
		defaultValue: {
			start: parseDate("2020-02-03"),
			end: parseDate("2020-02-08"),
		},
		onChange: (dateRange) =>
			console.log(
				dateRange ? dateRange.start.toString() + " - " + dateRange.end.toString() : dateRange,
			),
	},
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
	args: {},
	render: (args) => (
		<div>
			<Calendar.Range {...args} minValue={parseDate("1900-02-03")} />
		</div>
	),
};

export const Disabled: Story = {
	args: {},
	render: (args) => (
		<div>
			<Calendar.Range {...args} isDisabled />
		</div>
	),
};

export const UnavailableDates: Story = {
	name: "Unavailable Dates",
	args: {},
	render: (args) => {
		const now = today(getLocalTimeZone());
		const disabledRanges = [
			[now, now.add({ days: 5 })],
			[now.add({ days: 14 }), now.add({ days: 16 })],
			[now.add({ days: 23 }), now.add({ days: 24 })],
		];

		const { locale } = useLocale();
		const isDateUnavailable = (date: DateValue) =>
			isWeekend(date, locale) ||
			disabledRanges.some(
				(interval) => date.compare(interval[0]) >= 0 && date.compare(interval[1]) <= 0,
			);

		return (
			<div style={{ width: 300 }}>
				<Calendar.Range
					{...args}
					minValue={today(getLocalTimeZone())}
					isDateUnavailable={isDateUnavailable}
				/>
			</div>
		);
	},
};
