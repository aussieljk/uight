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
import { Code, codePropDefs } from 'frosted-ui';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Typography/Code',
  component: Code,
  args: {
    children: 'Code',
    size: codePropDefs.size.default,
  },
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
} satisfies Meta<typeof Code>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  args: {
    children: 'Code',
    size: codePropDefs.size.default,
  },
};

export const Variant: Story = {
  args: {
    size: codePropDefs.size.default,
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 'var(--space-2)' }}>
      <Code {...args} variant="solid">
        console.log()
      </Code>
      <Code {...args} variant="soft">
        console.log()
      </Code>
      <Code {...args} variant="outline">
        console.log()
      </Code>
      <Code {...args} variant="ghost">
        console.log()
      </Code>
    </div>
  ),
};

export const Size: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Code {...args} size="1">
        console.log()
      </Code>
      <Code {...args} size="2">
        console.log()
      </Code>
      <Code {...args} size="3">
        console.log()
      </Code>
      <Code {...args} size="4">
        console.log()
      </Code>
      <Code {...args} size="5">
        console.log()
      </Code>
      <Code {...args} size="6">
        console.log()
      </Code>
      <Code {...args} size="7">
        console.log()
      </Code>
      <Code {...args} size="8">
        console.log()
      </Code>
      <Code {...args} size="9">
        console.log()
      </Code>
    </div>
  ),
};

export const Color: Story = {
  args: {
    size: codePropDefs.size.default,
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 'var(--space-2)' }}>
      <Code {...args} color="indigo">
        console.log()
      </Code>
      <Code {...args} color="crimson">
        console.log()
      </Code>
      <Code {...args} color="cyan">
        console.log()
      </Code>
      <Code {...args} color="orange">
        console.log()
      </Code>
    </div>
  ),
};

export const HighContrast: Story = {
  name: 'High Contrast',
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 'var(--space-2)' }}>
        <Code {...args} variant="solid">
          console.log()
        </Code>
        <Code {...args} variant="soft">
          console.log()
        </Code>
        <Code {...args} variant="outline">
          console.log()
        </Code>
        <Code {...args} variant="ghost">
          console.log()
        </Code>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 'var(--space-2)' }}>
        <Code {...args} variant="solid" highContrast>
          console.log()
        </Code>
        <Code {...args} variant="soft" highContrast>
          console.log()
        </Code>
        <Code {...args} variant="outline" highContrast>
          console.log()
        </Code>
        <Code {...args} variant="ghost" highContrast>
          console.log()
        </Code>
      </div>
    </div>
  ),
};
