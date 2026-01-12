'use client';

import { useState } from 'react';
import { useOpenAiGlobal } from '../hooks/use-openai-global';
import { Button } from '@/components/ui/button';
import type { EchoToolOutput } from 'chatgpt-app-server/types';
import { Moon, Sun } from 'lucide-react';

/**
 * Echo Widget - Vercel-inspired Design
 *
 * Demonstrates ChatGPT widget APIs with a refined, professional aesthetic
 */
export default function Echo() {
  const toolOutput = useOpenAiGlobal<EchoToolOutput>('toolOutput');
  const theme = useOpenAiGlobal('theme');
  const displayMode = useOpenAiGlobal('displayMode');
  const safeArea = useOpenAiGlobal('safeArea');
  const maxHeight = useOpenAiGlobal('maxHeight');

  const [callResult, setCallResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>('light');

  const message = toolOutput?.echoedMessage || 'No message yet';

  const toggleTheme = () => {
    setLocalTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Prioritize theme from OpenAI host, fall back to local toggle
  const activeTheme = theme || localTheme || 'light';

  /**
   * Call the echo tool from the widget
   */
  const handleCallEcho = async () => {
    setIsLoading(true);
    setCallResult(null);

    try {
      const result = await window.openai?.callTool?.('echo', {
        message: `Re-echoing: ${message}`,
      });

      const text = result?.content?.[0]?.text || 'Success!';
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
  const handleRequestFullscreen = async () => {
    try {
      await window.openai?.requestDisplayMode?.({ mode: 'fullscreen' });
    } catch (err) {
      console.error('Failed to request fullscreen:', err);
    }
  };

  const containerStyle = {
    paddingTop: safeArea?.insets?.top || '8px',
    paddingBottom: safeArea?.insets?.bottom || '8px',
    paddingLeft: safeArea?.insets?.left || '8px',
    paddingRight: safeArea?.insets?.right || '8px',
    maxHeight: maxHeight ? `${maxHeight}px` : '100vh',
  };

  return (
    <main
      style={containerStyle}
      className={`min-h-screen p-2 ${activeTheme === 'dark' ? 'dark bg-[#0A0A0A]' : 'transparent'}`}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] dark:from-purple-950/20 dark:via-transparent dark:to-transparent from-purple-100/30 via-transparent to-transparent" />

      <div className="absolute top-6 right-6 z-10">
        <Button
          onClick={toggleTheme}
          variant="outline"
          size="icon"
          className="rounded-full dark:bg-zinc-800/90 dark:border-zinc-700 dark:hover:bg-zinc-700 bg-white/90 backdrop-blur-sm border-zinc-200 hover:bg-zinc-100 transition-all duration-300 shadow-lg hover:shadow-xl hover:"
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
              className="font-medium dark:bg-purple-600 dark:hover:bg-purple-700 dark:text-white bg-zinc-900 hover:bg-zinc-800 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:"
            >
              Call Echo Tool
            </Button>
            <Button
              variant="outline"
              onClick={() => setCallResult(null)}
              className="font-medium dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 text-zinc-700 hover:bg-zinc-100 hover: transition-all duration-300"
            >
              Clear Result
            </Button>
            {displayMode !== 'fullscreen' && (
              <Button
                onClick={handleRequestFullscreen}
                variant="outline"
                className="font-medium dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 text-zinc-700 hover:bg-zinc-100 hover: transition-all duration-300"
              >
                Enter Fullscreen
              </Button>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold dark:text-zinc-300 text-zinc-900 uppercase tracking-wide">
            Result
          </h2>
          <output className="text-sm dark:text-zinc-200 text-zinc-800 leading-relaxed">
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
      </div>
    </main>
  );
}
