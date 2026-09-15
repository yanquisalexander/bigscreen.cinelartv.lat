<script lang="ts">
  import VirtualizedRow from '@/components/home/VirtualizedRow.svelte';
  import type { ContentItem, ContentCategory } from '@/types/content';

  interface Props {
    categories: ContentCategory[];
    scrollY: number;
    viewportHeight: number;
    clientEndpoint: string;
    onCardEnterPress: (item: ContentItem) => void;
    onCardArrowPress?: (direction: string, catIdx: number) => boolean;
    onShelfFocusUpdate?: (catIdx: number, hasFocused: boolean, shelfY: number) => void;
  }

  let {
    categories,
    scrollY,
    viewportHeight,
    clientEndpoint,
    onCardEnterPress,
    onCardArrowPress,
    onShelfFocusUpdate,
  }: Props = $props();

  const OVERSCAN_PX = 500;

  const CARD_W_ESTIMATE = 270;
  const TITLE_H = 36;
  const THUMB_H = Math.round(CARD_W_ESTIMATE * 9 / 16);
  const META_H = 36;
  const SHELF_PAD = 48;

  let shelfMeasuredHeights = $state<Record<number, number>>({});

  function getShelfHeight(catIdx: number, hasTitle: boolean): number {
    if (shelfMeasuredHeights[catIdx]) return shelfMeasuredHeights[catIdx];
    const titleH = hasTitle ? TITLE_H : 0;
    return titleH + THUMB_H + META_H + SHELF_PAD;
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
      if (bottom >= scrollY - OVERSCAN_PX && top <= scrollBottom + OVERSCAN_PX) {
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
</script>

<div
  class="relative w-full"
  style="height: {totalShelvesHeight}px;"
>
  {#each categories as category, catIdx (catIdx)}
    {@const isVisible =
      visibleShelfRange.start <= catIdx && catIdx < visibleShelfRange.end}

    {#if isVisible}
      <div
        class="absolute left-0 right-0"
        style="top: {shelfOffsets[catIdx]}px;"
      >
        <VirtualizedRow
          title={category.title}
          items={category.content ?? []}
          categoryIndex={catIdx}
          focusKey="home-row-{catIdx}"
          {clientEndpoint}
          parentFocusKey="home-root"
          {onCardEnterPress}
          {onCardArrowPress}
          onUpdateHasFocusedChild={(hasFocused) =>
            onShelfFocusUpdate?.(catIdx, hasFocused, shelfOffsets[catIdx])}
          onMeasureHeight={(h) => handleShelfHeight(catIdx, h)}
        />
      </div>
    {/if}
  {/each}
</div>
