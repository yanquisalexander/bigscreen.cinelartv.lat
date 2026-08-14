/**
 * Adapts a Zustand store to a Svelte-compatible readable store.
 *
 * Zustand stores have `.subscribe(listener)` but with a different signature
 * from Svelte stores. Svelte stores require:
 *   - `subscribe(run: (value: T) => void): () => void`
 *
 * This adapter bridges the gap, allowing `$zustandStore` syntax in Svelte templates.
 *
 * Usage:
 *   import { useAuthStore } from '@/stores/authStore';
 *   import { zustandToSvelte } from '@/lib/zustandToSvelte';
 *   const authStore = zustandToSvelte(useAuthStore);
 *   // Now use $authStore in the template
 */

import type { StoreApi } from 'zustand';
import type { Readable } from 'svelte/store';

export function zustandToSvelte<T>(store: StoreApi<T>): Readable<T> {
  return {
    subscribe(run: (value: T) => void) {
      // Call immediately with current state (Svelte requires this)
      run(store.getState());
      // Subscribe to future changes
      return store.subscribe((state) => run(state));
    },
  };
}
