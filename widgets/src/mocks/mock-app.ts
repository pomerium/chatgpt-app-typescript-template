import type { AppLike, HostContext, ToolResultPayload } from '../types/mcp-app';

interface MockAppOptions<TStructured> {
  toolOutput?: TStructured | null;
  hostContext?: HostContext;
  callServerTool?: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<ToolResultPayload<TStructured>>;
}

export function createMockApp<TStructured>(
  options: MockAppOptions<TStructured> = {}
): AppLike<TStructured> & {
  emitToolResult: (next: TStructured) => void;
  setHostContext: (next: HostContext) => void;
} {
  let toolOutput: TStructured | null = options.toolOutput ?? null;
  let hostContext: HostContext =
    options.hostContext ?? {
      theme: 'light',
      displayMode: 'inline',
      safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      containerDimensions: { maxHeight: 600 },
    };

  const app: AppLike<TStructured> = {
    connect: async () => {
      if (toolOutput !== null) {
        app.ontoolresult?.({ structuredContent: toolOutput, content: [] });
      }
      app.onhostcontextchanged?.(hostContext);
    },
    getHostContext: () => hostContext,
    callServerTool:
      options.callServerTool ??
      (async (params) => ({
        content: [
          {
            type: 'text',
            text: `Mock response: ${JSON.stringify(params.arguments ?? {})}`,
          },
        ],
        structuredContent: toolOutput ?? undefined,
      })),
    requestDisplayMode: async (params) => ({ mode: params.mode }),
    ontoolresult: undefined,
    onhostcontextchanged: undefined,
  };

  return {
    ...app,
    emitToolResult: (next: TStructured) => {
      toolOutput = next;
      app.ontoolresult?.({ structuredContent: next, content: [] });
    },
    setHostContext: (next: HostContext) => {
      hostContext = next;
      app.onhostcontextchanged?.(next);
    },
  };
}
