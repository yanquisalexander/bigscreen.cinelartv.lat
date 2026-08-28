<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tick } from 'svelte';
  import { getFocusContext } from '@/lib/spatial/spatialContext';
  import { spatialNav, generateFocusKey, type SpatialNavParams } from '@/lib/spatial/spatialAction';

  interface Props {
    focusKey?: string;
    parentFocusKey?: string;
    onEnterPress?: (details?: any) => void;
    onArrowPress?: (direction: string, details: any) => boolean;
    onFocus?: () => void;
    onBlur?: () => void;
    autoFocus?: boolean;
    trackChildren?: boolean;
    saveLastFocusedChild?: boolean;
    preferredChildFocusKey?: string;
    focusable?: boolean;
    tabIndex?: number;
    playSound?: boolean;
    isFocusBoundary?: boolean;
    class?: string;
    focusedClass?: string;
    role?: string;
    id?: string;
    style?: string;
    children?: Snippet<[{ focused: boolean }]> | Snippet;
  }

  let {
    focusKey = generateFocusKey(),
    parentFocusKey,
    onEnterPress,
    onArrowPress,
    onFocus,
    onBlur,
    autoFocus = false,
    trackChildren = false,
    saveLastFocusedChild = false,
    preferredChildFocusKey,
    focusable = true,
    tabIndex = 0,
    playSound = true,
    isFocusBoundary = false,
    class: className = '',
    focusedClass = '',
    role = 'button',
    id,
    style,
    children,
  }: Props = $props();

  let isFocused = $state(false);
  const inheritedParent = getFocusContext();
  const effectiveParent = $derived(parentFocusKey ?? inheritedParent);

  const navParams = $derived<SpatialNavParams>({
    focusKey,
    parentFocusKey: effectiveParent,
    focusable,
    autoFocus,
    trackChildren,
    saveLastFocusedChild,
    preferredChildFocusKey,
    isFocusBoundary,
    playSound,
    onEnterPress: (details) => {
      onEnterPress?.(details);
    },
    onArrowPress,
    onFocus: async () => {
      isFocused = true;
      await tick();
      onFocus?.();
    },
    onBlur: () => {
      isFocused = false;
      onBlur?.();
    },
    onUpdateFocus: (focused) => {
      isFocused = focused;
    },
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && onEnterPress) {
      e.preventDefault();
      onEnterPress();
    }
  }
</script>

<div
  {id}
  use:spatialNav={navParams}
  {tabIndex}
  {role}
  {style}
  onkeydown={handleKeyDown}
  data-focus-key={focusKey}
  data-focused={isFocused ? 'true' : undefined}
  class="tv-no-select {className} {isFocused ? focusedClass : ''}"
>
  {#if children}
    {@render children({ focused: isFocused })}
  {/if}
</div>
