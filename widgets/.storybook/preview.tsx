import type { Preview } from '@storybook/react';
import '@fontsource/geist-sans';
import '@fontsource/geist-mono';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;

      return (
        <div className={theme === 'dark' ? 'dark' : ''}>
          <div className={theme === 'dark' ? 'bg-gray-900 min-h-screen p-8' : 'bg-white min-h-screen p-8'}>
            <Story />
          </div>
        </div>
      );
    },
  ],
};

export default preview;
