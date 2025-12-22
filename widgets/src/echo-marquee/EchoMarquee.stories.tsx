import type { Meta, StoryObj } from '@storybook/react';
import { EchoMarquee } from './EchoMarquee.js';

const meta = {
  title: 'Widgets/EchoMarquee',
  component: EchoMarquee,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    message: {
      control: 'text',
      description: 'The message to display in the scrolling marquee',
    },
    speed: {
      control: { type: 'number', min: 10, max: 200, step: 10 },
      description: 'Scroll speed in pixels per second',
    },
  },
} satisfies Meta<typeof EchoMarquee>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default echo marquee with a simple message
 */
export const Default: Story = {
  args: {
    message: 'Hello, World!',
  },
};

/**
 * Long message that demonstrates the scrolling behavior
 */
export const LongMessage: Story = {
  args: {
    message: 'This is a much longer message that will scroll across the marquee widget',
  },
};

/**
 * Fast scrolling speed (100 pixels per second)
 */
export const FastSpeed: Story = {
  args: {
    message: 'Fast scrolling!',
    speed: 100,
  },
};

/**
 * Slow scrolling speed (20 pixels per second)
 */
export const SlowSpeed: Story = {
  args: {
    message: 'Slow and steady...',
    speed: 20,
  },
};

/**
 * Short message
 */
export const ShortMessage: Story = {
  args: {
    message: 'Hi!',
  },
};

/**
 * Message with emojis
 */
export const WithEmojis: Story = {
  args: {
    message: '🎉 Celebrating with emojis! 🎊',
  },
};

/**
 * Very long message to test performance
 */
export const VeryLongMessage: Story = {
  args: {
    message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
};
