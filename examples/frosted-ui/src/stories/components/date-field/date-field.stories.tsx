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
import type { Meta, StoryObj } from '../../csf-types';

import { getLocalTimeZone, parseDate, parseZonedDateTime, today } from '@internationalized/date';
import React from 'react';
import { DateField, dateFieldPropDefs } from 'frosted-ui';
// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Controls/Dates/DateField',
  component: DateField,
  args: {
    size: dateFieldPropDefs.size.default,
    color: dateFieldPropDefs.color.default,
    'aria-label': 'Birth date',
  },
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
} satisfies Meta<typeof DateField>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  args: {},
  render: (args) => (
    <div style={{ width: 300 }}>
      <DateField {...args} defaultValue={parseDate('2020-02-03')} onChange={(date) => console.log(date?.toString())} />
    </div>
  ),
};

export const Size: Story = {
  args: {},
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: 300 }}>
      <DateField {...args} defaultValue={parseDate('2020-02-03')} size="1" />
      <DateField {...args} defaultValue={parseDate('2020-02-03')} size="2" />
      <DateField {...args} defaultValue={parseDate('2020-02-03')} size="3" />
      <DateField {...args} defaultValue={parseDate('2020-02-03')} size="4" />
    </div>
  ),
};

export const MinValue: Story = {
  args: {},
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: 300 }}>
      <DateField
        {...args}
        minValue={today(getLocalTimeZone())}
        defaultValue={parseDate('2020-02-03')}
        validationBehavior="aria"
      />
    </div>
  ),
};

export const WithTime: Story = {
  name: 'With time',
  args: {},
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: 300 }}>
      <DateField {...args} defaultValue={parseZonedDateTime('2022-11-07T00:45[America/Los_Angeles]')} />
      <DateField {...args} defaultValue={parseZonedDateTime('2022-11-07T00:45[America/Los_Angeles]')} hideTimeZone />
      <DateField
        {...args}
        defaultValue={parseZonedDateTime('2022-11-07T00:45[America/Los_Angeles]')}
        hideTimeZone
        granularity="second"
      />
    </div>
  ),
};
