export type Theme = 'light' | 'dark';

export type DisplayMode = 'inline' | 'pip' | 'fullscreen';

export interface HostContext {
  theme?: Theme;
  displayMode?: DisplayMode;
  safeAreaInsets?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  containerDimensions?: {
    height?: number;
    maxHeight?: number;
    width?: number;
    maxWidth?: number;
  };
}

export interface ToolResultPayload<TStructured = unknown> {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  structuredContent?: TStructured;
}

export interface AppLike<TStructured = unknown> {
  connect: () => Promise<void>;
  getHostContext: () => HostContext | null;
  callServerTool: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<ToolResultPayload<TStructured>>;
  requestDisplayMode: (params: { mode: DisplayMode }) => Promise<{
    mode: DisplayMode;
    [key: string]: unknown;
  }>;
  ontoolresult?: (result: ToolResultPayload<TStructured>) => void;
  onhostcontextchanged?: (context: HostContext) => void;
}
