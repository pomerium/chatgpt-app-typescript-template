import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    builder: '@storybook/builder-vite',
  },
  viteFinal: async (config) => {
    const plugins = Array.isArray(config.plugins)
      ? config.plugins
      : config.plugins
        ? [config.plugins]
        : [];

    return {
      ...config,
      plugins: [
        ...plugins,
        tailwindcss() as unknown as (typeof plugins)[number],
      ],
    };
  },
};

export default config;
