import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EchoMarquee } from '../echo-marquee/EchoMarquee';
import { useOpenAiGlobal } from '../hooks/use-openai-global';
import '../index.css';

/**
 * Main widget application component
 *
 * Demonstrates:
 * - Reading toolOutput from ChatGPT
 * - callTool API (widget→tool communication)
 * - Theme support (dark/light)
 * - Display mode detection and control
 * - Safe area handling for responsive layout
 * - Max height constraints
 */
function App() {
  // Read host state via useOpenAiGlobal hook
  const toolOutput = useOpenAiGlobal('toolOutput');
  const theme = useOpenAiGlobal('theme');
  const displayMode = useOpenAiGlobal('displayMode');
  const safeArea = useOpenAiGlobal('safeArea');
  const maxHeight = useOpenAiGlobal('maxHeight');

  // Local state for callTool result
  const [callResult, setCallResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Extract echoed message from toolOutput
  const message =
    (toolOutput as { echoedMessage?: string })?.echoedMessage || 'No message yet';

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

  // Apply safe area padding for mobile/PiP modes
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
      className={`min-h-screen p-6 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Echo Marquee Widget
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Demonstrating ChatGPT widget APIs
          </p>
        </div>

        {/* Main marquee */}
        <EchoMarquee message={message} />

        {/* Interactive controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Widget APIs Demo
          </h2>

          {/* callTool demonstration */}
          <div className="space-y-2">
            <button
              onClick={handleCallEcho}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Calling...' : 'Call echo tool from UI'}
            </button>

            {callResult && (
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {callResult}
                </p>
              </div>
            )}
          </div>

          {/* requestDisplayMode demonstration */}
          {displayMode !== 'fullscreen' && (
            <button
              onClick={handleRequestFullscreen}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              View Fullscreen
            </button>
          )}

          {/* Status display */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Display Mode:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {displayMode || 'inline'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Theme:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {theme || 'light'}
              </span>
            </div>
            {maxHeight && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Max Height:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {maxHeight}px
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built with ChatGPT Apps SDK</p>
        </div>
      </div>
    </div>
  );
}

// Mount the app
const rootElement = document.getElementById('echo-marquee-root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error('Root element not found');
}
