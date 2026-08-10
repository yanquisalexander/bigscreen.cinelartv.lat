import { createContext, useContext } from 'react';

export const SIDEBAR_FOCUS_KEY = 'geoblocked-sidebar';

// Non-null when the app is running in geoblocked mode (only Live TV available).
// Lets screens delegate their "back" navigation to the geoblocked shell instead
// of navigating to routes that don't exist in the restricted router.
export const GeoblockedModeContext = createContext<string | null>(null);

export function useGeoblockedMode(): string | null {
  return useContext(GeoblockedModeContext);
}
