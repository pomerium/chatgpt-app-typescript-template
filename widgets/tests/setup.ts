import '@testing-library/jest-dom/vitest';

global.window.openai = {
  theme: 'light',
  displayMode: 'inline',
  maxHeight: 1000,
  safeArea: {
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  viewport: { width: 1920, height: 1080 },
  userAgent: {
    device: 'desktop',
    capabilities: { hover: true, touch: false },
  },
  locale: 'en-US',
  toolInput: null,
  toolOutput: null,
  toolResponseMetadata: null,
  widgetState: null,
  setWidgetState: async () => {},
  callTool: async () => ({ content: [] }),
  sendFollowUpMessage: async () => {},
  uploadFile: async () => ({ fileId: '' }),
  getFileDownloadUrl: async () => ({ url: '' }),
  requestDisplayMode: async (args) => args,
  requestModal: async () => {},
  openExternal: () => {},
  notifyIntrinsicHeight: () => {},
  requestClose: async () => {},
};
