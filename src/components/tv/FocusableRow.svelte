<script lang="ts">
  import type { Snippet } from 'svelte';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import { generateFocusKey } from '@/lib/spatial/spatialAction';

  interface Props<T = any> {
    title?: string;
    class?: string;
    focusKey?: string;
    preferredChildFocusKey?: string;
    onUpdateHasFocusedChild?: (hasFocusedChild: boolean) => void;
    items?: T[];
    children?: Snippet | Snippet<[T, number]>;
    itemKey?: (item: T, index: number) => string | number;
    itemWidth?: number;
    gap?: number;
    overscan?: number;
  }

  let {
    title,
    class: className = '',
    focusKey = generateFocusKey('row'),
    preferredChildFocusKey,
    onUpdateHasFocusedChild,
    items,
    children,
    itemKey,
    itemWidth = 192,
    gap = 16,
    overscan = 3,
  }: Props = $props();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let containerWidth = $state(0);
  let scrollLeft = $state(0);
  let rafId = 0;
  let resizeObserver: ResizeObserver | null = null;

  function handleUpdateHasFocusedChild(hasFocusedChild: boolean) {
    if (hasFocusedChild && scrollEl) {
      scrollEl.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
    onUpdateHasFocusedChild?.(hasFocusedChild);
  }

  // Calculate virtual window range when items prop is provided
  const virtualRange = $derived.by(() => {
    if (!items || items.length === 0) {
      return { start: 0, end: 0, totalWidth: 0 };
    }
    const step = itemWidth + gap;
    const totalWidth = items.length * step - gap;
    const currentScrollLeft = scrollLeft;
    const viewportW = containerWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);

    const start = Math.max(0, Math.floor(currentScrollLeft / step) - overscan);
    const visibleCount = Math.ceil(viewportW / step);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    return { start, end, totalWidth };
  });

  $effect(() => {
    const el = scrollEl;
    if (!el) return;

    containerWidth = el.clientWidth;
    scrollLeft = el.scrollLeft;

    const handleScrollEvent = () => {
      scrollLeft = el.scrollLeft;
    };

    el.addEventListener('scroll', handleScrollEvent, { passive: true });

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width;
      }
    });
    resizeObserver.observe(el);

    const handleMutation = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focused = el.querySelector<HTMLElement>('[data-focused="true"]');
        if (!focused) return;

        const containerRect = el.getBoundingClientRect();
        const focusedRect = focused.getBoundingClientRect();
        const targetScrollLeft = el.scrollLeft + (focusedRect.left - containerRect.left) - (containerRect.width / 2) + (focusedRect.width / 2);

        el.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth',
        });
        scrollLeft = el.scrollLeft;
      });
    };

    const observer = new MutationObserver(handleMutation);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => {
      el.removeEventListener('scroll', handleScrollEvent);
      resizeObserver?.disconnect();
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  });
</script>

<FocusContainer
  {focusKey}
  {preferredChildFocusKey}
  trackChildren={true}
  saveLastFocusedChild={true}
  onUpdateHasFocusedChild={handleUpdateHasFocusedChild}
  class="mb-[clamp(0.5rem,1.5vh,1rem)] {className}"
>
  {#if title}
    <h2 class="text-[clamp(1rem,1.4vw,1.125rem)] font-bold text-text-primary mb-[clamp(0.25rem,0.6vh,0.5rem)] px-[clamp(3rem,7.5vw,6rem)]">
      {title}
    </h2>
  {/if}
  <div
    bind:this={scrollEl}
    class="flex gap-4 px-[clamp(3rem,7.5vw,6rem)] overflow-x-auto hide-scrollbar pt-1 pb-2 snap-x snap-start relative min-h-[clamp(195px,15vw,288px)]"
  >
    {#if items && items.length > 0}
      <div
        class="relative w-full h-full shrink-0"
        style="width: {virtualRange.totalWidth}px; height: 100%;"
      >
        {#each items.slice(virtualRange.start, virtualRange.end) as item, idx (itemKey ? itemKey(item, virtualRange.start + idx) : (item as any)?.id ?? (virtualRange.start + idx))}
          {@const globalIdx = virtualRange.start + idx}
          {@const x = globalIdx * (itemWidth + gap)}
          <div
            class="absolute top-0 left-0"
            style="transform: translateX({x}px) translateZ(0); will-change: transform;"
          >
            {@render (children as Snippet<[T, number]>)?.(item, globalIdx)}
          </div>
        {/each}
      </div>
    {:else}
      {@render (children as Snippet)?.()}
    {/if}
  </div>
</FocusContainer>
