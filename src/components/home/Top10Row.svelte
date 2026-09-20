<script lang="ts">
  import { tick } from 'svelte';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { FocusableRegistrar } from '@/components/tv/spatialFocus';
  import { setFocusContext } from '@/lib/spatial/spatialContext';
  import { useAmbientStore } from '@/stores/ambientStore';
  import type { ContentItem } from '@/types/content';
  import { resolvePoster, resolveBackdrop } from '@/utils/helpers';

  interface Props {
    title?: string;
    items: ContentItem[];
    categoryIndex: number;
    focusKey: string;
    clientEndpoint: string;
    parentFocusKey?: string;
    onCardEnterPress: (item: ContentItem) => void;
    onCardArrowPress?: (direction: string, catIdx: number) => boolean;
    onUpdateHasFocusedChild?: (hasFocused: boolean) => void;
    onMeasureHeight?: (height: number) => void;
  }

  let {
    title,
    items,
    categoryIndex,
    focusKey,
    clientEndpoint,
    parentFocusKey = 'SN:ROOT',
    onCardEnterPress,
    onCardArrowPress,
    onUpdateHasFocusedChild,
    onMeasureHeight,
  }: Props = $props();

  setFocusContext(focusKey);

  const OVERSCAN = 2;
  const registrar = new FocusableRegistrar();
  let renderedKeys: string[] = [];

  let viewportEl = $state<HTMLDivElement | null>(null);
  let scrollLeft = $state(0);
  let viewportWidth = $state(0);
  let itemWidth = $state(0);
  let itemGap = $state(0);
  let metricsMeasured = false;

  const CARD_W = 180;
  const CARD_GAP = 40;
  const POSTER_H = 210;

  function getStep() {
    return CARD_W + CARD_GAP;
  }

  function getMaxScroll() {
    const step = getStep();
    const totalW = items.length * step - CARD_GAP;
    return Math.max(0, totalW - viewportWidth + viewportWidth * 0.3);
  }

  function getVisibleRange() {
    const step = getStep();
    if (step <= 0 || viewportWidth <= 0) {
      return { start: 0, end: Math.min(items.length, 10) };
    }
    const start = Math.max(0, Math.floor(scrollLeft / step) - OVERSCAN);
    const visibleCount = Math.ceil(viewportWidth / step);
    const end = Math.min(items.length, start + visibleCount + OVERSCAN * 2);
    return { start, end };
  }

  const visibleRange = $derived(getVisibleRange());

  const visibleItems = $derived(
    items.slice(visibleRange.start, visibleRange.end).map((item, i) => ({
      item,
      index: visibleRange.start + i,
    })),
  );

  function computeMetrics() {
    if (!viewportEl || metricsMeasured) return;
    viewportWidth = viewportEl.clientWidth;
    itemWidth = CARD_W;
    itemGap = CARD_GAP;
    metricsMeasured = true;
  }

  $effect(() => {
    if (!viewportEl) return;
    const observer = new ResizeObserver(() => {
      if (viewportEl) {
        viewportWidth = viewportEl.clientWidth;
        const shelfEl = viewportEl.closest('.top10-shelf');
        if (shelfEl && onMeasureHeight) {
          const rect = shelfEl.getBoundingClientRect();
          const style = getComputedStyle(shelfEl);
          const mb = parseFloat(style.marginBottom) || 0;
          onMeasureHeight(rect.height + mb);
        }
      }
    });
    observer.observe(viewportEl);
    return () => observer.disconnect();
  });

  function scrollToCard(index: number) {
    const step = getStep();
    if (step <= 0) return;
    const x = index * step;
    const maxS = getMaxScroll();
    scrollLeft = Math.max(0, Math.min(x - viewportWidth / 2 + CARD_W / 2, maxS));
  }

  async function revealAndFocusCard(index: number) {
    if (index < 0 || index >= items.length) return;
    const item = items[index];
    if (!item) return;

    scrollToCard(index);
    await tick();
    syncFocusables();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const key = `home-top10-${categoryIndex}-item-${item.id}`;
    try {
      setFocus(key);
    } catch { /* noop */ }
  }

  let rowHasFocus = false;

  function syncFocusables() {
    for (const key of renderedKeys) {
      registrar.unregister(key);
    }
    renderedKeys = [];

    if (!viewportEl) return;

    const cards = viewportEl.querySelectorAll<HTMLElement>('.top10-card');
    cards.forEach((card) => {
      const idx = parseInt(card.getAttribute('data-card-index') ?? '-1', 10);
      if (idx < 0 || idx >= items.length) return;
      const item = items[idx];
      const key = `home-top10-${categoryIndex}-item-${item.id}`;

      registrar.register([
        {
          focusKey: key,
          node: card,
          parentFocusKey,
          onEnterPress: () => onCardEnterPress(item),
          onArrowPress: (direction: string) => {
            if (direction === 'up' || direction === 'down') {
              return onCardArrowPress?.(direction, categoryIndex) ?? true;
            }
            if (direction === 'left') {
              if (idx === 0) return true;
              void revealAndFocusCard(idx - 1);
              return false;
            }
            if (direction === 'right') {
              if (idx === items.length - 1) return true;
              void revealAndFocusCard(idx + 1);
              return false;
            }
            return true;
          },
          onFocus: () => {
            card.setAttribute('data-focused', 'true');
            const poster = card.querySelector<HTMLElement>('.top10-poster');
            if (poster) {
              poster.style.borderColor = '#fff';
            }
            card.style.zIndex = '2';
            const ambientUrl = resolveBackdrop(item.images, item.banner_resized ?? item.banner, clientEndpoint, 'small');
            useAmbientStore.getState().setBackdropUrl(ambientUrl ?? null);
            scrollToCard(idx);
            if (!rowHasFocus) {
              rowHasFocus = true;
              onUpdateHasFocusedChild?.(true);
            }
          },
          onBlur: () => {
            card.setAttribute('data-focused', 'false');
            const poster = card.querySelector<HTMLElement>('.top10-poster');
            if (poster) {
              poster.style.borderColor = '';
              poster.style.transform = '';
            }
            card.style.zIndex = '';
            setTimeout(() => {
              if (viewportEl && !viewportEl.querySelector('.top10-card[data-focused="true"]') && rowHasFocus) {
                rowHasFocus = false;
                onUpdateHasFocusedChild?.(false);
              }
            }, 0);
          },
        },
      ]);
      renderedKeys.push(key);
    });
  }

  const RANKS: Record<number, { color: string; glow: string }> = {
    1: { color: '#FFD700', glow: 'rgba(255,215,0,0.4)' },
    2: { color: '#C0C0C0', glow: 'rgba(192,192,192,0.3)' },
    3: { color: '#CD7F32', glow: 'rgba(205,127,50,0.3)' },
  };

  $effect(() => {
    if (viewportEl && !metricsMeasured) {
      computeMetrics();
    }
  });

  $effect(() => {
    return () => {
      registrar.unregisterAll();
    };
  });

  $effect(() => {
    void visibleItems;
    syncFocusables();
  });
</script>

<div class="top10-shelf mb-[clamp(2.5rem,5vh,4rem)]">
  {#if title}
    <div class="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)] px-[clamp(3rem,7.5vw,6rem)] mb-[clamp(0.35rem,0.7vh,0.5rem)]">
      <h2 class="text-[clamp(1rem,1.4vw,1.25rem)] font-medium text-white/95">
        {title}
      </h2>
      <span class="top10-badge">TOP 10</span>
    </div>
  {/if}
  <div
    bind:this={viewportEl}
    class="relative overflow-x-hidden pl-[clamp(3rem,7.5vw,6rem)] pr-[clamp(3rem,7.5vw,6rem)] pt-3 pb-3"
    data-focus-container={focusKey}
    role="row"
    aria-label={title || undefined}
  >
    <div
      class="relative"
      data-virtual-track
      style="height: 300px; transform: translateX({-scrollLeft}px) translateZ(0); will-change: transform; transition: transform 150ms linear;"
    >
      {#each visibleItems as { item, index } (item.id)}
        {@const rank = index + 1}
        {@const posterImage = resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint)}
        {@const rankConfig = RANKS[rank]}
        {@const isTop3 = rank <= 3}

        <div
          class="top10-card"
          data-card-index={index}
          data-focused="false"
          role="button"
          tabindex="-1"
          aria-label={item.title}
          style="--card-x: {index * getStep()}px; --card-w: {CARD_W}px;"
        >
          <!-- Big rank number -->
          <div class="top10-number" class:top10-number--top3={isTop3}>
            <span class="top10-number-stroke">{rank}</span>
            <span class="top10-number-fill" class:top10-number-glow={isTop3} style={isTop3 ? `text-shadow: 0 0 20px ${rankConfig?.glow}` : ''}>{rank}</span>
          </div>

          <!-- Poster -->
          <div
            class="top10-poster"
            class:top10-poster--top1={rank === 1}
            style={rank === 1 ? `border-color: ${rankConfig?.color}; box-shadow: 0 0 16px ${rankConfig?.glow}` : ''}
          >
            {#if posterImage}
              <img
                src={posterImage}
                alt={item.title}
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div class="top10-fallback">{(item.title ?? '?').charAt(0)}</div>
            {/if}
            <div class="top10-gradient"></div>
            {#if rank === 1}
              <div class="top10-crown" style="background-color: {rankConfig?.color}">
                <span class="top10-crown-text">1</span>
              </div>
            {/if}
          </div>

          <div class="top10-meta">
            <p class="top10-title">{item.title}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .top10-shelf {
    /* container */
  }

  .top10-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(138, 180, 248, 0.15);
    color: #8AB4F8;
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.5px;
  }

  .top10-card {
    position: absolute;
    top: 0;
    left: var(--card-x, 0px);
    width: var(--card-w);
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    outline: 0;
    color: #fff;
    text-align: left;
    cursor: pointer;
    border: none;
  }

  .top10-card:focus-visible {
    outline: none;
  }

  /* Big number behind the poster */
  .top10-number {
    position: absolute;
    left: -20px;
    bottom: 10px;
    z-index: 0;
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }

  .top10-number-stroke {
    position: absolute;
    font-size: clamp(6rem, 10vw, 9rem);
    font-weight: 900;
    line-height: 0.8;
    letter-spacing: -6px;
    color: #3a3d42;
    -webkit-text-stroke: 2px #3a3d42;
  }

  .top10-number-fill {
    position: relative;
    font-size: clamp(6rem, 10vw, 9rem);
    font-weight: 900;
    line-height: 0.8;
    letter-spacing: -6px;
    color: #1a1a1a;
    z-index: 1;
  }

  .top10-number-glow {
    color: #0a0a0a;
  }

  /* Poster */
  .top10-poster {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    overflow: hidden;
    background: #141414;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.08);
    z-index: 1;
    margin-left: 30px;
    transition: border-color var(--animation-duration) ease;
    box-shadow: -4px 8px 12px rgba(0, 0, 0, var(--shadow-opacity));
  }

  .top10-poster--top1 {
    border-width: 1.5px;
  }

  .top10-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .top10-gradient {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 50%;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    pointer-events: none;
  }

  .top10-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1F1F22;
    font-size: 1.5rem;
    font-weight: 700;
    color: #5F6368;
  }

  .top10-crown {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 22px;
    height: 22px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .top10-crown-text {
    color: #000;
    font-size: 0.7rem;
    font-weight: 900;
  }

  .top10-meta {
    padding: clamp(0.5rem, 0.8vw, 0.7rem) clamp(0.1rem, 0.2vw, 0.15rem) 0;
    margin-left: 30px;
  }

  .top10-title {
    margin: 0;
    font-size: clamp(0.75rem, 1.1vw, 0.875rem);
    font-weight: 500;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.9);
  }
</style>
