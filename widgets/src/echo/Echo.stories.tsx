import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import Echo from './Echo.js';
import type { EchoToolOutput } from 'chatgpt-app-server/types';

/**
 * Mock OpenAI global for Storybook
 */
const mockOpenAiGlobal = (
  toolOutput: EchoToolOutput,
  options?: {
    theme?: 'light' | 'dark';
    displayMode?: 'inline' | 'pip' | 'fullscreen';
  }
) => {
  window.openai = {
    toolOutput,
    displayMode: options?.displayMode || 'inline',
    safeArea: {
      insets: { top: '16px', bottom: '16px', left: '16px', right: '16px' },
    },
    maxHeight: 600,
    callTool: async (name: string, args: Record<string, unknown>) => {
      console.log(`Mock callTool: ${name}`, args);
      return {
        content: [
          { type: 'text', text: `Mock response: ${JSON.stringify(args)}` },
        ],
      };
    },
    requestDisplayMode: async ({ mode }: { mode: string }) => {
      console.log(`Mock requestDisplayMode: ${mode}`);
    },
    on: () => {},
    off: () => {},
  };

  if (options?.theme) {
    window.openai.theme = options.theme;
  }
};

const meta = {
  title: 'Widgets/Echo',
  component: Echo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
  decorators: [
    (Story, _context) => {
      useEffect(() => {
        // Cleanup function to avoid polluting global state between stories
        return () => {
          window.openai = undefined;
        };
      }, []);

      return (
        <div className="relative w-xl max-w-xl border">
          <span className="absolute text-sm text-muted-foreground -top-4 right-2 border bg-white text px-1 py-0.5">
            ChatGPT frame
          </span>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof Echo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default echo widget with a standard message
 */
export const Default: Story = {
  decorators: [
    (Story) => {
      mockOpenAiGlobal({
        echoedMessage: 'Hello from ChatGPT!',
        timestamp: new Date().toISOString(),
      });
      return <Story />;
    },
  ],
};

/**
 * Echo widget showing a short message
 */
export const ShortMessage: Story = {
  decorators: [
    (Story) => {
      mockOpenAiGlobal({
        echoedMessage: 'Hi!',
        timestamp: new Date().toISOString(),
      });
      return <Story />;
    },
  ],
};

/**
 * Echo widget showing a long message with multiple sentences
 */
export const LongMessage: Story = {
  decorators: [
    (Story) => {
      mockOpenAiGlobal({
        echoedMessage:
          'This is a much longer message that demonstrates how the Echo widget handles extended text content. It includes multiple sentences and should wrap appropriately within the widget container. The widget should maintain its elegant design even with longer content, ensuring readability and proper spacing throughout. This helps us verify that the layout remains stable and visually appealing regardless of message length.',
        timestamp: new Date().toISOString(),
      });
      return <Story />;
    },
  ],
};

/**
 * Echo widget in dark theme
 */
export const DarkTheme: Story = {
  decorators: [
    (Story) => {
      debugger;
      mockOpenAiGlobal({
        echoedMessage: 'Hello in dark mode!',
        timestamp: new Date().toISOString(),
      }, { theme: 'dark' },);

      return <Story />;
    },
  ],
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

/**
 * Echo widget with no message (initial state)
 */
export const NoMessage: Story = {
  decorators: [
    (Story) => {
      mockOpenAiGlobal({
        echoedMessage: '',
        timestamp: new Date().toISOString(),
      });
      return <Story />;
    },
  ],
};

/**
 * Interactive story to test callTool functionality
 * Click "Call Echo Tool" to see the loading state and then the result
 */
export const InteractiveCallTool: Story = {
  decorators: [
    (Story) => {
      mockOpenAiGlobal({
        echoedMessage: 'Click the button to test the call tool!',
        timestamp: new Date().toISOString(),
      });
      // Override callTool to simulate a delay for loading state
      // @ts-expect-error - Override mock
      window.openai.callTool = async (
        name: string,
        args: Record<string, unknown>
      ) => {
        console.log(`Mock callTool with delay: ${name}`, args);
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return {
          content: [
            {
              type: 'text',
              text: `Successfully called ${name} with message: ${args.message}`,
            },
          ],
        };
      };
      return <Story />;
    },
  ],
};
