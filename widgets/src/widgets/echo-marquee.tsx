import { useState, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EchoMarquee } from '../echo-marquee/EchoMarquee';
import { useOpenAiGlobal } from '../hooks/use-openai-global';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { EchoToolOutput } from 'chatgpt-app-server/types';
import '../index.css';

/**
 * Echo Marquee Widget
 *
 * Demonstrates:
 * - Reading toolOutput from ChatGPT
 * - callTool API (widget→tool communication)
 * - Theme support (dark/light)
 * - Display mode detection and control
 * - Safe area handling for responsive layout
 * - Max height constraints
 */
export default function App() {
  const toolOutput = useOpenAiGlobal<EchoToolOutput>('toolOutput');
  const theme = useOpenAiGlobal('theme');
  const displayMode = useOpenAiGlobal('displayMode');
  const safeArea = useOpenAiGlobal('safeArea');
  const maxHeight = useOpenAiGlobal('maxHeight');

  const [callResult, setCallResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const message = toolOutput?.echoedMessage || 'No message yet';

  /**
   * Demonstrate callTool API - call the echo tool from the widget
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
   * Demonstrate requestDisplayMode API - toggle fullscreen
   */
  const handleRequestFullscreen = async () => {
    try {
      await window.openai?.requestDisplayMode?.({ mode: 'fullscreen' });
    } catch (err) {
      console.error('Failed to request fullscreen:', err);
    }
  };

  const containerStyle = {
    paddingTop: safeArea?.insets?.top || 0,
    paddingBottom: safeArea?.insets?.bottom || 0,
    paddingLeft: safeArea?.insets?.left || 0,
    paddingRight: safeArea?.insets?.right || 0,
    maxHeight: maxHeight ? `${maxHeight}px` : '100vh',
  };

  return (
    <div
      style={containerStyle}
      className={`min-h-screen p-6 bg-background ${theme === 'dark' ? 'dark' : ''} max-w-4xl mx-auto space-y-6`}
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Echo Marquee Widget
        </h1>
        <p className="text-muted-foreground">
          Demonstrating ChatGPT widget APIs
        </p>
      </div>

      {/* Main marquee */}
      <EchoMarquee message={message} />

      {/* Interactive controls */}
      <Card>
        <CardHeader>
          <CardTitle>Widget APIs Demo</CardTitle>
          <CardDescription>
            Test the ChatGPT widget integration features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {/* callTool demonstration */}
            <Button
              variant="outline"
              onClick={handleCallEcho}
              disabled={isLoading}
              className="w-fit"
            >
              Call echo tool from UI
            </Button>
            <Button
              variant="outline"
              onClick={() => setCallResult(null)}
              disabled={isLoading}
              className="w-fit"
            >
              Clear Results
            </Button>

            {/* requestDisplayMode demonstration */}
            {displayMode !== 'fullscreen' && (
              <Button
                onClick={handleRequestFullscreen}
                variant="outline"
                className="w-fit"
              >
                View Fullscreen
              </Button>
            )}
          </div>
          <div className="flex gap-1 items-center">
            <span>Call Result:</span>
            <output>{isLoading ? 'Calling tool...' : callResult}</output>
          </div>

          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Display Mode:</span>
              <span className="font-medium text-foreground">
                {displayMode || 'inline'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Theme:</span>
              <span className="font-medium text-foreground">
                {theme || 'light'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const rootElement = document.getElementById('echo-marquee-root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
