/**
 * TypeScript declarations for window.openai API
 * Based on OpenAI Apps SDK documentation
 */

export type DisplayMode = 'inline' | 'pip' | 'fullscreen';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SafeArea {
  insets: SafeAreaInsets;
}

export interface UserAgent {
  device: DeviceType;
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  [key: string]: unknown;
}

export interface ToolResponseMetadata {
  [key: string]: unknown;
}

export interface WidgetState {
  [key: string]: unknown;
}

export interface CallToolResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface OpenAiGlobals {
  // Context signals
  theme: 'light' | 'dark';
  displayMode: DisplayMode;
  maxHeight: number;
  safeArea: SafeArea;
  viewport: Viewport;
  userAgent: UserAgent;
  locale: string;

  // State & data
  toolInput: ToolInput | null;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
  setWidgetState: (state: WidgetState) => Promise<void>;

  // Runtime APIs
  callTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<CallToolResponse>;
  sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;
  uploadFile: (file: File) => Promise<{ fileId: string }>;
  getFileDownloadUrl: (args: { fileId: string }) => Promise<{ url: string }>;
  requestDisplayMode: (args: {
    mode: DisplayMode;
  }) => Promise<{ mode: DisplayMode }>;
  requestModal: (args: {
    title?: string;
    params?: Record<string, unknown>;
  }) => Promise<unknown>;
  openExternal: (args: { href: string }) => void;
  notifyIntrinsicHeight: (args: { height: number }) => void;
  requestClose: () => Promise<void>;
}

declare global {
  interface Window {
    openai?: OpenAiGlobals;
  }
}

export {};
