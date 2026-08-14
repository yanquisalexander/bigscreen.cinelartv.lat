import { getContext, setContext } from 'svelte';

const FOCUS_CONTEXT_KEY = Symbol('FOCUS_CONTEXT');

export function setFocusContext(focusKey: string): void {
  setContext(FOCUS_CONTEXT_KEY, focusKey);
}

export function getFocusContext(): string {
  return getContext<string>(FOCUS_CONTEXT_KEY) || 'SN:ROOT';
}
