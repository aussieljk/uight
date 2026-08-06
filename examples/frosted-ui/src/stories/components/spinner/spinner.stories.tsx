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

import React from 'react';
import { Code, Spinner, spinnerPropDefs, Switch, Text } from 'frosted-ui';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  args: {
    size: spinnerPropDefs.size.default,
    loading: spinnerPropDefs.loading.default,
  },
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'centered',
  },

  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args

export const Default: Story = {
  name: 'Default',
  render: (args) => <Spinner {...args} />,
};

export const Sizes: Story = {
  name: 'Size',
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
      <Spinner {...args} size="1" />
      <Spinner {...args} size="2" />
      <Spinner {...args} size="3" />
      <Spinner {...args} size="4" />
      <Spinner {...args} size="5" />
      <Spinner {...args} size="6" />
    </div>
  ),
};

export const WithChildren: Story = {
  name: 'With children',
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 640 }}>
      <Text>
        Use the <Code>loading</Code> prop to control whether the spinner or its children are displayed. Spinner
        preserves the dimensions of children when they are hidden and disables interactive elements.
      </Text>
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <Spinner {...args} loading={true}>
          <Switch defaultChecked />
        </Spinner>

        <Spinner {...args} loading={false}>
          <Switch defaultChecked />
        </Spinner>
      </div>
    </div>
  ),
};
