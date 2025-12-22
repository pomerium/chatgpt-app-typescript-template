import { useState, useCallback, useEffect } from 'react';
import { useOpenAiGlobal } from './use-openai-global.js';
import type { WidgetState } from '../types/openai.js';

/**
 * Hook to manage persistent widget state with ChatGPT
 *
 * Widget state is persisted per message instance and synchronized with the host.
 * Keep state under 4,000 tokens for optimal performance.
 *
 * @param initialState - Initial state or factory function
 * @returns [widgetState, setWidgetState] tuple
 *
 * @example
 * const [widgetState, setWidgetState] = useWidgetState({ count: 0 });
 *
 * const increment = () => {
 *   setWidgetState(prev => ({ ...prev, count: prev.count + 1 }));
 * };
 */
export function useWidgetState<T extends WidgetState>(
  initialState: T | (() => T)
): [T | null, (value: T | ((prev: T | null) => T)) => void] {
  // Read initial state from host
  const hostWidgetState = useOpenAiGlobal('widgetState');

  // Local state management
  const [localState, setLocalState] = useState<T | null>(() => {
    // If host has state, use it; otherwise use initialState
    if (hostWidgetState) {
      return hostWidgetState as T;
    }

    return typeof initialState === 'function'
      ? (initialState as () => T)()
      : initialState;
  });

  // Sync host state changes to local state
  useEffect(() => {
    if (hostWidgetState) {
      setLocalState(hostWidgetState as T);
    }
  }, [hostWidgetState]);

  // Set widget state with host synchronization
  const setWidgetState = useCallback(
    (value: T | ((prev: T | null) => T)) => {
      setLocalState((prev) => {
        const newState = typeof value === 'function'
          ? (value as (prev: T | null) => T)(prev)
          : value;

        // Sync with host
        window.openai?.setWidgetState?.(newState).catch((err) => {
          console.error('Failed to sync widget state with host:', err);
        });

        return newState;
      });
    },
    []
  );

  return [localState, setWidgetState];
}
