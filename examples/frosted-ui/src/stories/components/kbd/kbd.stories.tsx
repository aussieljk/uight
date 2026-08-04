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
import { Kbd, kbdPropDefs } from 'frosted-ui';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Typography/Kbd',
  component: Kbd,

  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  args: {
    children: 'Shift + Tab',
    size: kbdPropDefs.size.default,
  },
};

export const Size: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div>
        <Kbd {...args} size="1">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="2">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="3">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="4">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="5">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="6">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="7">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="8">
          Shift + Tab
        </Kbd>
      </div>
      <div>
        <Kbd {...args} size="9">
          Shift + Tab
        </Kbd>
      </div>
    </div>
  ),
};
