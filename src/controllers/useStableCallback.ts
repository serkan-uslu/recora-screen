import { useCallback, useRef } from "react";

/** Stable event identity with current props, without resubscribing playback/gesture listeners. */
export function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const current = useRef(callback);
  current.current = callback;
  return useCallback(((...args: Parameters<T>) => current.current(...args)) as T, []);
}
