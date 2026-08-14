<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setFocusContext, getFocusContext } from '@/lib/spatial/spatialContext';
  import { spatialNav, type SpatialNavParams } from '@/lib/spatial/spatialAction';

  interface Props {
    focusKey: string;
    parentFocusKey?: string;
    trackChildren?: boolean;
    saveLastFocusedChild?: boolean;
    preferredChildFocusKey?: string;
    isFocusBoundary?: boolean;
    autoRestoreFocus?: boolean;
    focusable?: boolean;
    class?: string;
    onFocus?: SpatialNavParams['onFocus'];
    onBlur?: SpatialNavParams['onBlur'];
    onArrowPress?: SpatialNavParams['onArrowPress'];
    onUpdateHasFocusedChild?: (hasFocusedChild: boolean) => void;
    children?: Snippet;
  }

  let {
    focusKey,
    parentFocusKey,
    trackChildren = true,
    saveLastFocusedChild = false,
    preferredChildFocusKey,
    isFocusBoundary = false,
    autoRestoreFocus = true,
    focusable = true,
    class: className = '',
    onFocus,
    onBlur,
    onArrowPress,
    onUpdateHasFocusedChild,
    children,
  }: Props = $props();

  const inheritedParent = getFocusContext();
  const effectiveParent = $derived(parentFocusKey ?? inheritedParent);

  // Set the current container's key as the parent focus key for children in this subtree
  setFocusContext(focusKey);

  const navParams = $derived<SpatialNavParams>({
    focusKey,
    parentFocusKey: effectiveParent,
    trackChildren,
    saveLastFocusedChild,
    preferredChildFocusKey,
    isFocusBoundary,
    autoRestoreFocus,
    focusable: focusable,
    playSound: false,
    onFocus,
    onBlur,
    onArrowPress,
    onUpdateHasFocusedChild,
  });
</script>

<div
  use:spatialNav={navParams}
  class={className}
  data-focus-container={focusKey}
>
  {@render children?.()}
</div>
