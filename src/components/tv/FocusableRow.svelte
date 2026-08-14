<script lang="ts">
  import type { Snippet } from 'svelte';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import { generateFocusKey } from '@/lib/spatial/spatialAction';

  interface Props {
    title?: string;
    class?: string;
    focusKey?: string;
    preferredChildFocusKey?: string;
    children?: Snippet;
  }

  let {
    title,
    class: className = '',
    focusKey = generateFocusKey('row'),
    preferredChildFocusKey,
    children,
  }: Props = $props();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let rafId = 0;

  function onUpdateHasFocusedChild(hasFocusedChild: boolean) {
    if (hasFocusedChild && scrollEl) {
      scrollEl.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }

  $effect(() => {
    const el = scrollEl;
    if (!el) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focused = el.querySelector<HTMLElement>('[data-focused="true"]');
        if (!focused) return;

        const containerWidth = el.clientWidth;
        const cardWidth = focused.clientWidth;
        const cardLeft = focused.offsetLeft;
        const scrollLeft = cardLeft - containerWidth / 2 + cardWidth / 2;

        el.scrollTo({
          left: scrollLeft,
          behavior: 'smooth',
        });
      });
    };

    const observer = new MutationObserver(handleScroll);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => {
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
  {onUpdateHasFocusedChild}
  class="mb-[clamp(0.5rem,1.5vh,1rem)] {className}"
>
  {#if title}
    <h2 class="text-[clamp(1rem,1.4vw,1.125rem)] font-bold text-text-primary mb-[clamp(0.25rem,0.6vh,0.5rem)] px-[clamp(3rem,7.5vw,6rem)]">
      {title}
    </h2>
  {/if}
  <div
    bind:this={scrollEl}
    class="flex gap-4 px-[clamp(3rem,7.5vw,6rem)] overflow-x-auto hide-scrollbar pt-1 pb-2 snap-x snap-start"
  >
    {@render children?.()}
  </div>
</FocusContainer>
