'use client';

import { useEffect, useMemo, useState } from 'react';
import { App } from '@modelcontextprotocol/ext-apps';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { Button } from '@/components/ui/button';
import type { EchoToolOutput } from 'chatgpt-app-server/types';
import { BrainCircuit, ExternalLink, Maximize2, Minimize2, MessageSquare, Moon, Play, Sun, X } from 'lucide-react';
import type { AppLike, HostContext, ToolResultPayload } from '../types/mcp-app';

function isEchoToolOutput(value: unknown): value is EchoToolOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'echoedMessage' in value &&
    'timestamp' in value
  );
}

/**
 * Echo Widget - Vercel-inspired Design
 *
 * Demonstrates MCP Apps widget APIs with a refined, professional aesthetic
 */
export default function Echo({ app }: { app?: AppLike<EchoToolOutput> }) {
  const defaultApp = useMemo(
    () => new App({ name: 'Echo', version: '1.0.0' }),
    []
  );
  const activeApp = app ?? defaultApp;

  const [toolOutput, setToolOutput] = useState<EchoToolOutput | null>(null);
  const [hostContext, setHostContext] = useState<
    HostContext | null | undefined
  >(null);

  const [callResult, setCallResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localTheme, setLocalTheme] = useState<'light' | 'dark' | null>(null);
  const [contextUpdate, setContextUpdate] = useState<string | null>(null);

  const message = toolOutput?.echoedMessage || 'No message yet';

  useEffect(() => {
    let isMounted = true;

    activeApp.ontoolresult = (result: ToolResultPayload<EchoToolOutput>) => {
      if (!isMounted) return;
      setToolOutput(result.structuredContent ?? null);
    };

    activeApp.onhostcontextchanged = (context: HostContext) => {
      if (!isMounted) return;
      setHostContext((prev) => ({ ...prev, ...context }));
    };

    const connect = async () => {
      try {
        await activeApp.connect();
        if (!isMounted) return;
        setHostContext(activeApp.getHostContext());
      } catch (err) {
        console.error('Failed to connect MCP App:', err);
      }
    };

    connect();

    return () => {
      isMounted = false;
    };
  }, [activeApp]);

  const toggleTheme = () => {
    const currentTheme = localTheme ?? hostContext?.theme ?? 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setLocalTheme(newTheme);
  };

  // Prioritize local toggle (if set), otherwise use host theme
  const activeTheme = localTheme ?? hostContext?.theme ?? 'light';
  const displayMode = hostContext?.displayMode;

  /**
   * Call the echo tool from the widget
   */
  const handleCallEcho = async () => {
    setIsLoading(true);
    setCallResult(null);

    try {
      const result = await activeApp.callServerTool({
        name: 'echo',
        arguments: { message: 'Hello from the echo widget!' },
      });

      if (isEchoToolOutput(result.structuredContent)) {
        setToolOutput(result.structuredContent);
      }

      const text =
        result?.content?.find(
          (item): item is TextContent => item.type === 'text'
        )?.text || 'Success!';
      setCallResult(text);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setCallResult(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle fullscreen display mode
   */
  const handleToggleFullscreen = async () => {
    try {
      const target = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      const result = await activeApp.requestDisplayMode({ mode: target });
      setHostContext((prev) => prev ? { ...prev, displayMode: result.mode } : prev);
    } catch (err) {
      console.error('Failed to toggle fullscreen:', err);
    }
  };

  /**
   * Open an external link via the host
   */
  const handleOpenLink = async () => {
    try {
      const result = await activeApp.openLink({
        url: 'https://www.pomerium.com/docs/capabilities/mcp/develop-mcp-app',
      });
      if (result.isError) {
        setCallResult('Host denied the link request');
      }
    } catch (err) {
      console.error('Failed to open link:', err);
    }
  };

  /**
   * Send the echoed message to the host chat
   */
  const handleSendMessage = async () => {
    try {
      const result = await activeApp.sendMessage({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Sent this chat message from the echo widget',
          },
        ],
      });
      if (result.isError) {
        setCallResult('Host rejected the message');
      } else {
        setCallResult('Message sent to chat');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      setCallResult(`Send failed: ${errorMessage}`);
    }
  };

  /**
   * Update the model context with current widget state
   */
  const handleUpdateContext = async () => {
    const structured = {
      echoedMessage: message,
      theme: activeTheme,
      displayMode: displayMode ?? 'unknown',
      updatedAt: new Date().toISOString(),
    };
    try {
      await activeApp.updateModelContext({
        content: [
          {
            type: 'text',
            text: `Echo widget state: ${JSON.stringify(structured)}`,
          },
        ],
        structuredContent: structured,
      });
      setContextUpdate(JSON.stringify(structured, null, 2));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      setContextUpdate(`Context update failed: ${errorMessage}`);
    }
  };

  const safeAreaInsets = hostContext?.safeAreaInsets;
  const maxHeight = hostContext?.containerDimensions?.maxHeight;

  const containerStyle = {
    paddingTop: `${Math.max(safeAreaInsets?.top ?? 16, 16)}px`,
    paddingBottom: `${Math.max(safeAreaInsets?.bottom ?? 16, 16)}px`,
    paddingLeft: `${Math.max(safeAreaInsets?.left ?? 16, 16)}px`,
    paddingRight: `${Math.max(safeAreaInsets?.right ?? 16, 16)}px`,
    maxHeight: maxHeight ? `${maxHeight}px` : '100vh',
  };

  return (
    <main
      style={containerStyle}
      className={`min-h-screen p-6 rounded-2xl ${activeTheme === 'dark' ? 'dark bg-[#0A0A0A]' : 'transparent'}`}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] dark:from-purple-950/20 dark:via-transparent dark:to-transparent from-purple-100/30 via-transparent to-transparent" />

      <div className="absolute top-6 right-6 z-10 flex gap-2">
        <Button
          onClick={toggleTheme}
          variant="outline"
          size="icon"
          title={activeTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="rounded-full dark:bg-zinc-800/90 dark:border-zinc-700 dark:hover:bg-zinc-700 bg-white/90 backdrop-blur-sm border-zinc-200 hover:bg-zinc-100 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          {activeTheme === 'dark' ? (
            <Sun className="h-4 w-4 text-yellow-500" />
          ) : (
            <Moon className="h-4 w-4 text-zinc-700" />
          )}
          <span className="sr-only">
            {activeTheme === 'dark'
              ? 'Switch to light theme'
              : 'Switch to dark theme'}
          </span>
        </Button>
        <Button
          onClick={handleToggleFullscreen}
          variant="outline"
          size="icon"
          title={displayMode === 'fullscreen' ? 'Calls requestDisplayMode() to exit full screen' : 'Calls requestDisplayMode() to enter full screen'}
          className="rounded-full dark:bg-zinc-800/90 dark:border-zinc-700 dark:hover:bg-zinc-700 bg-white/90 backdrop-blur-sm border-zinc-200 hover:bg-zinc-100 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          {displayMode === 'fullscreen' ? (
            <Minimize2 className="h-4 w-4 dark:text-zinc-300 text-zinc-700" />
          ) : (
            <Maximize2 className="h-4 w-4 dark:text-zinc-300 text-zinc-700" />
          )}
          <span className="sr-only">
            {displayMode === 'fullscreen' ? 'Exit full screen' : 'Full screen'}
          </span>
        </Button>
      </div>

      <div className="grid gap-6 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold tracking-tight mb-3 dark:text-white text-zinc-900">
          Echo
        </h1>
        <p className="text-base dark:text-zinc-400 text-zinc-600">
          A demonstration of ChatGPT widget capabilities
        </p>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold dark:text-zinc-300 text-zinc-900 uppercase tracking-wide">
            Echoed Message
          </h2>
          <p className="text-base dark:text-zinc-400 text-zinc-600">
            {message}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold dark:text-zinc-300 text-zinc-900 uppercase tracking-wide">
            Actions
          </h2>
          <div className="flex gap-3 flex-wrap items-center">
            <Button
              variant="default"
              onClick={handleCallEcho}
              disabled={isLoading}
              title="Calls callServerTool() to invoke the echo tool on the MCP server."
              className="font-medium dark:bg-purple-600 dark:hover:bg-purple-700 dark:text-white bg-zinc-900 hover:bg-zinc-800 text-white shadow-md hover:shadow-lg transition-all duration-300"
            >
              <Play className="h-4 w-4" />
              Call Echo Tool
            </Button>
            <Button
              onClick={handleUpdateContext}
              variant="outline"
              title="Calls updateModelContext() to push widget state to the model's context for future turns."
              className="font-medium dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 text-zinc-700 hover:bg-zinc-100 transition-all duration-300"
            >
              <BrainCircuit className="h-4 w-4" />
              Update Context
            </Button>
            <Button
              variant="outline"
              onClick={() => { setCallResult(null); setContextUpdate(null); }}
              title="Clears the result and model context update sections."
              className="font-medium dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 text-zinc-700 hover:bg-zinc-100 transition-all duration-300"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
            <Button
              onClick={handleSendMessage}
              variant="outline"
              title="Calls sendMessage() to send a message to the host chat."
              className="font-medium dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 text-zinc-700 hover:bg-zinc-100 transition-all duration-300"
            >
              <MessageSquare className="h-4 w-4" />
              Send to Chat
            </Button>
            <Button
              onClick={handleOpenLink}
              variant="outline"
              title="Calls openLink() to open an external URL via the host."
              className="font-medium dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 text-zinc-700 hover:bg-zinc-100 transition-all duration-300"
            >
              <ExternalLink className="h-4 w-4" />
              Open Docs
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold dark:text-zinc-300 text-zinc-900 uppercase tracking-wide">
            Result
          </h2>
          <output className="block min-h-6 text-sm dark:text-zinc-200 text-zinc-800 leading-relaxed">
            {isLoading ? (
              <div className="flex items-center h-6">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full dark:bg-zinc-300 bg-zinc-700 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full dark:bg-zinc-300 bg-zinc-700 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full dark:bg-zinc-300 bg-zinc-700 animate-bounce" />
                </div>
              </div>
            ) : (
              callResult
            )}
          </output>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold dark:text-zinc-300 text-zinc-900 uppercase tracking-wide">
            Model Context Update
          </h2>
          <output className={`block text-sm leading-relaxed rounded-md p-3 font-mono whitespace-pre-wrap ${contextUpdate ? 'dark:text-zinc-200 text-zinc-800 dark:bg-zinc-800/50 bg-zinc-100' : 'invisible'}`}>
            {contextUpdate || '{\n  "echoedMessage": "placeholder",\n  "theme": "dark",\n  "displayMode": "inline",\n  "updatedAt": "0000-00-00T00:00:00.000Z"\n}'}
          </output>
        </section>
      </div>
    </main>
  );
}
