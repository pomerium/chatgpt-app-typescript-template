import { useSyncExternalStore } from 'react';
import type { OpenAiGlobals } from '../types/openai.js';

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
 * const toolOutput = useOpenAiGlobal('toolOutput');
 * const displayMode = useOpenAiGlobal('displayMode');
 */
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
