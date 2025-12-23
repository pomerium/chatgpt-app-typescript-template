import { useSyncExternalStore } from 'react';
import type { OpenAiGlobals, ToolOutput } from '../types/openai.js';

const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

interface SetGlobalsEvent extends CustomEvent {
  detail: {
    globals: Partial<OpenAiGlobals>;
  };
}

/**
 * Hook to read a specific value from window.openai with reactive updates
 *
 * @example
 * const theme = useOpenAiGlobal('theme');
 * const toolOutput = useOpenAiGlobal<MyToolOutput>('toolOutput');
 * const displayMode = useOpenAiGlobal('displayMode');
 */
// Overload for toolOutput with custom type
export function useOpenAiGlobal<TToolOutput extends ToolOutput>(
  key: 'toolOutput'
): TToolOutput | null;

// Overload for all other keys
export function useOpenAiGlobal<K extends Exclude<keyof OpenAiGlobals, 'toolOutput'>>(
  key: K
): OpenAiGlobals[K] | null;

// Implementation
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] | null {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = (event: Event) => {
        const customEvent = event as SetGlobalsEvent;
        const value = customEvent.detail.globals[key];

        if (value === undefined) return;

        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    },
    () => {
      return window.openai?.[key] ?? null;
    },
    // getServerSnapshot - for SSR (not applicable but required)
    () => {
      return null;
    }
  );
}
