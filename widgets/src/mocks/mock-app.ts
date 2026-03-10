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

  const mock = {
    connect: async () => {
      if (toolOutput !== null) {
        mock.ontoolresult?.({ structuredContent: toolOutput, content: [] });
      }
      mock.onhostcontextchanged?.(hostContext);
    },
    getHostContext: () => hostContext,
    callServerTool:
      options.callServerTool ??
      (async (params: {
        name: string;
        arguments?: Record<string, unknown>;
      }) => ({
        content: [
          {
            type: 'text',
            text: `Mock response: ${JSON.stringify(params.arguments ?? {})}`,
          },
        ],
        structuredContent: toolOutput ?? undefined,
      })),
    requestDisplayMode: async (params: { mode: HostContext['displayMode'] }) => ({
      mode: params.mode!,
    }),
    openLink: async () => ({}),
    sendMessage: async () => ({}),
    updateModelContext: async () => ({}),
    ontoolresult: undefined as
      | ((result: ToolResultPayload<TStructured>) => void)
      | undefined,
    onhostcontextchanged: undefined as
      | ((context: HostContext) => void)
      | undefined,
    emitToolResult: (next: TStructured) => {
      toolOutput = next;
      mock.ontoolresult?.({ structuredContent: next, content: [] });
    },
    setHostContext: (next: HostContext) => {
      hostContext = next;
      mock.onhostcontextchanged?.(next);
    },
  };

  return mock;
}
