/**
 * Adapted from frosted-ui — Whop's design system — and used here under the MIT
 * licence. Copyright (c) 2023 WorkOS. Copyright (c) 2023 Whop.
 * Full licence text: src/stories/LICENSE-frosted-ui.md
 *
 * Changes from upstream: imports of frosted-ui internals rewritten to the
 * published `frosted-ui` package, and `@storybook/react` types replaced with
 * the local shim in src/stories/csf-types.ts. Any further change to a story
 * body is marked with a comment in place.
 * uaight is not affiliated with Whop or frosted-ui.
 */
import type { Meta, StoryObj } from '../../csf-types';

import React from 'react';
import { TextArea, textAreaPropDefs } from 'frosted-ui';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Controls/TextArea',
  component: TextArea,
  args: {
    size: textAreaPropDefs.size.default,
    variant: textAreaPropDefs.variant.default,
    color: textAreaPropDefs.color.default,
    disabled: false,
  },
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  render: (args) => (
    <div style={{ width: 300 }}>
      <TextArea placeholder="Reply to comment…" {...args} />
    </div>
  ),
};

export const Size: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 500 }}>
      <TextArea placeholder="Reply to comment…" {...args} size="1" />
      <TextArea placeholder="Reply to comment…" {...args} size="2" />
      <TextArea placeholder="Reply to comment…" {...args} size="3" />
      <TextArea placeholder="Reply to comment…" {...args} size="4" />
    </div>
  ),
};

export const Variant: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 500 }}>
      <TextArea placeholder="Reply to comment…" {...args} variant="surface" />
      <TextArea placeholder="Reply to comment…" {...args} variant="soft" />
    </div>
  ),
};

export const Color: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 500 }}>
      <TextArea variant="soft" placeholder="Reply to comment…" {...args} color="blue" />
      <TextArea variant="soft" placeholder="Reply to comment…" {...args} color="green" />
      <TextArea variant="soft" placeholder="Reply to comment…" {...args} color="red" />
    </div>
  ),
};
