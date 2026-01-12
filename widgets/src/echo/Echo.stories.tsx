import type { Meta, StoryObj } from '@storybook/react';
import Echo from './Echo.js';

const meta = {
  title: 'Widgets/Echo',
  component: Echo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Echo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default echo widget
 * Note: This widget relies on OpenAI global context which may not be available in Storybook
 */
export const Default: Story = {
  args: {},
};
