<script lang="ts">
  import { TV_SCALE_EVENT } from '@/services/tvScale';
  import VirtualizedRow from '@/components/home/VirtualizedRow.svelte';
  import Top10Row from '@/components/home/Top10Row.svelte';
  import type { ContentItem, ContentCategory } from '@/types/content';

  interface Props {
    categories: ContentCategory[];
    scrollY: number;
    viewportHeight: number;
    clientEndpoint: string;
    onCardEnterPress: (item: ContentItem) => void;
    onCardArrowPress?: (direction: string, catIdx: number) => boolean;
    onShelfFocusUpdate?: (catIdx: number, hasFocused: boolean, shelfY: number) => void;
    onCardFocus?: (item: ContentItem, catIdx: number, key: string) => void;
    activeCategoryIndex?: number;
    initialItemId?: string;
  }

  let {
    categories,
    scrollY,
    viewportHeight,
    clientEndpoint,
    onCardEnterPress,
    onCardArrowPress,
    onShelfFocusUpdate,
    onCardFocus,
    activeCategoryIndex = 0,
    initialItemId,
  }: Props = $props();

  const OVERSCAN_REM = 24;

  const CARD_W_ESTIMATE = 14.57;
  const TITLE_H = 2.25;
  const THUMB_H = Math.round(CARD_W_ESTIMATE * 9 / 16);
  const META_H = 4;
  const SHELF_PAD = 1.5;

  let hostEl = $state<HTMLDivElement | null>(null);
  let remSize = $state(16);

  let shelfMeasuredHeights = $state<Record<number, number>>({});

  function getShelfHeight(catIdx: number, hasTitle: boolean): number {
    if (shelfMeasuredHeights[catIdx]) return shelfMeasuredHeights[catIdx];
    const titleH = hasTitle ? TITLE_H : 0;
    const contentHeight = categories[catIdx]?.section_kind === 'top_10_by_country' ? 21.75 : THUMB_H + META_H;
    return (titleH + contentHeight + SHELF_PAD) * remSize;
  }

  const shelfOffsets = $derived.by(() => {
    const offsets: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < categories.length; i++) {
      offsets.push(cumulative);
      cumulative += getShelfHeight(i, Boolean(categories[i]?.title));
    }
    return offsets;
  });

  const totalShelvesHeight = $derived(
    categories.length > 0
      ? shelfOffsets[categories.length - 1] +
          getShelfHeight(categories.length - 1, Boolean(categories[categories.length - 1]?.title))
      : 0,
  );

  const visibleShelfRange = $derived.by(() => {
    const scrollBottom = scrollY + viewportHeight;
    let first = -1;
    let last = -1;

    for (let i = 0; i < categories.length; i++) {
      const top = shelfOffsets[i];
      const h = getShelfHeight(i, Boolean(categories[i]?.title));
      const bottom = top + h;
      if (bottom >= scrollY - OVERSCAN_REM * remSize && top <= scrollBottom + OVERSCAN_REM * remSize) {
        if (first === -1) first = i;
        last = i;
      }
    }

    if (first === -1) return { start: 0, end: -1 };
    return { start: first, end: last + 1 };
  });

  function handleShelfHeight(catIdx: number, height: number) {
    if (height > 0 && shelfMeasuredHeights[catIdx] !== height) {
      shelfMeasuredHeights[catIdx] = height;
    }
  }

  $effect(() => {
    if (!hostEl) return;
    const measure = () => {
      const next = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      if (next !== remSize) {
        remSize = next;
        shelfMeasuredHeights = {};
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hostEl);
    window.addEventListener(TV_SCALE_EVENT, measure);
    return () => { observer.disconnect(); window.removeEventListener(TV_SCALE_EVENT, measure); };
  });
</script>

<div
  bind:this={hostEl}
  class="relative w-full"
  style="height: {totalShelvesHeight / remSize}rem;"
>
  {#each categories as category, catIdx (catIdx)}
    {@const isVisible =
      (visibleShelfRange.start <= catIdx && catIdx < visibleShelfRange.end) || Math.abs(catIdx - activeCategoryIndex) <= 1}

    {#if isVisible}
      <div
        class="absolute left-0 right-0"
        style="top: {shelfOffsets[catIdx] / remSize}rem;"
      >
        {#if category.section_kind === 'top_10_by_country'}
          <Top10Row
            title={category.title}
            items={category.content ?? []}
            categoryIndex={catIdx}
            focusKey="home-row-{catIdx}"
            {clientEndpoint}
            parentFocusKey="home-root"
            {onCardEnterPress}
            {onCardArrowPress}
            {onCardFocus}
            {initialItemId}
            onUpdateHasFocusedChild={(hasFocused) =>
              onShelfFocusUpdate?.(catIdx, hasFocused, shelfOffsets[catIdx])}
            onMeasureHeight={(h) => handleShelfHeight(catIdx, h)}
          />
        {:else}
          <VirtualizedRow
            title={category.title}
            items={category.content ?? []}
            sectionKind={category.section_kind}
            categoryIndex={catIdx}
            focusKey="home-row-{catIdx}"
            {clientEndpoint}
            parentFocusKey="home-root"
            {onCardEnterPress}
            {onCardArrowPress}
            {onCardFocus}
            {initialItemId}
            onUpdateHasFocusedChild={(hasFocused) =>
              onShelfFocusUpdate?.(catIdx, hasFocused, shelfOffsets[catIdx])}
            onMeasureHeight={(h) => handleShelfHeight(catIdx, h)}
          />
        {/if}
      </div>
    {/if}
  {/each}
</div>
