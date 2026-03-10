import type { Meta, StoryObj } from '@storybook/react';
import Echo from './Echo.js';
import type { EchoToolOutput } from 'chatgpt-app-server/types';
import { createMockApp } from '../mocks/mock-app';

const meta = {
  title: 'Widgets/Echo',
  component: Echo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
  decorators: [
    (Story) => (
      <div className="relative w-xl max-w-xl border">
        <span className="absolute text-sm text-muted-foreground -top-4 right-2 border bg-white text px-1 py-0.5">
          MCP host frame
        </span>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Echo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default echo widget with a standard message
 */
export const Default: Story = {
  render: () => (
    <Echo
      app={createMockApp<EchoToolOutput>({
        toolOutput: {
          echoedMessage: 'Hello from MCP!',
          timestamp: new Date().toISOString(),
        },
      })}
    />
  ),
};

/**
 * Echo widget showing a short message
 */
export const ShortMessage: Story = {
  render: () => (
    <Echo
      app={createMockApp<EchoToolOutput>({
        toolOutput: { echoedMessage: 'Hi!', timestamp: new Date().toISOString() },
      })}
    />
  ),
};

/**
 * Echo widget showing a long message with multiple sentences
 */
export const LongMessage: Story = {
  render: () => (
    <Echo
      app={createMockApp<EchoToolOutput>({
        toolOutput: {
          echoedMessage:
            'This is a much longer message that demonstrates how the Echo widget handles extended text content. It includes multiple sentences and should wrap appropriately within the widget container. The widget should maintain its elegant design even with longer content, ensuring readability and proper spacing throughout. This helps us verify that the layout remains stable and visually appealing regardless of message length.',
          timestamp: new Date().toISOString(),
        },
      })}
    />
  ),
};

/**
 * Echo widget in dark theme
 */
export const DarkTheme: Story = {
  render: () => (
    <Echo
      app={createMockApp<EchoToolOutput>({
        toolOutput: {
          echoedMessage: 'Hello in dark mode!',
          timestamp: new Date().toISOString(),
        },
        hostContext: {
          theme: 'dark',
          displayMode: 'inline',
          safeAreaInsets: { top: 16, bottom: 16, left: 16, right: 16 },
          containerDimensions: { maxHeight: 600 },
        },
      })}
    />
  ),
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

/**
 * Echo widget with no message (initial state)
 */
export const NoMessage: Story = {
  render: () => (
    <Echo
      app={createMockApp<EchoToolOutput>({
        toolOutput: { echoedMessage: '', timestamp: new Date().toISOString() },
      })}
    />
  ),
};

/**
 * Interactive story to test callTool functionality
 * Click "Call Echo Tool" to see the loading state and then the result
 */
export const InteractiveCallTool: Story = {
  render: () => (
    <Echo
      app={createMockApp<EchoToolOutput>({
        toolOutput: {
          echoedMessage: 'Click the button to test the call tool!',
          timestamp: new Date().toISOString(),
        },
        callServerTool: async (params) => {
          console.log(`Mock callServerTool: ${params.name}`, params.arguments);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return {
            content: [
              {
                type: 'text',
                text: `Successfully called ${params.name} with message: ${params.arguments?.message}`,
              },
            ],
          };
        },
      })}
    />
  ),
};
