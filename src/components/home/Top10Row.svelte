<script lang="ts">
  import { TV_SCALE_EVENT } from '@/services/tvScale';
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
    onCardFocus?: (item: ContentItem, catIdx: number, key: string) => void;
    initialItemId?: string;
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
    onCardFocus,
    initialItemId,
  }: Props = $props();

  setFocusContext(focusKey);

  const OVERSCAN = 2;
  const registrar = new FocusableRegistrar();
  let renderedKeys: string[] = [];

  let viewportEl = $state<HTMLDivElement | null>(null);
  let scrollLeft = $state(0);
  let viewportWidth = $state(0);
  let metricsMeasured = false;

  let remSize = $state(16);
  const CARD_W = $derived(11.25 * remSize);
  const CARD_GAP = $derived(2.5 * remSize);

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
    remSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    viewportWidth = viewportEl.clientWidth;
    metricsMeasured = true;
    const remembered = items.findIndex(item => item.id === initialItemId);
    if (remembered >= 0) scrollToCard(remembered);
  }

  $effect(() => {
    if (!viewportEl) return;
    const observer = new ResizeObserver(() => {
      if (viewportEl) {
        remSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
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
    const rescale = () => {
      const index = Math.round(scrollLeft / getStep());
      metricsMeasured = false;
      computeMetrics();
      scrollToCard(index);
    };
    window.addEventListener(TV_SCALE_EVENT, rescale);
    return () => {
      observer.disconnect();
      window.removeEventListener(TV_SCALE_EVENT, rescale);
    };
  });

  function scrollToCard(index: number) {
    const step = getStep();
    if (step <= 0) return;
    const x = index * step;
    const maxS = getMaxScroll();
    scrollLeft = Math.max(0, Math.min(x, maxS));
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
              if (idx === 0) return onCardArrowPress?.('left', categoryIndex) ?? true;
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
            onCardFocus?.(item, categoryIndex, key);
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
    <div class="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)] px-[var(--tv-content-inset)] mb-[clamp(0.35rem,0.7vh,0.5rem)]">
      <h2 class="text-[1.25rem] font-medium text-white/95">
        {title}
      </h2>
      <span class="top10-badge">TOP 10</span>
    </div>
  {/if}
  <div
    bind:this={viewportEl}
    class="relative overflow-x-hidden pl-[var(--tv-content-inset)] pr-[var(--tv-content-inset)] pt-3 pb-3"
    data-focus-container={focusKey}
    role="row"
    aria-label={title || undefined}
  >
    <div
      class="relative"
      data-virtual-track
      style="height: 18rem; transform: translateX({-scrollLeft / remSize}rem) translateZ(0); will-change: transform; transition: transform 150ms linear;"
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
          style="--card-x: {index * getStep() / remSize}rem; --card-w: {CARD_W / remSize}rem;"
        >
          <div class="top10-art">
            <!-- Big rank number (anchored to the poster, not the title) -->
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
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: rgba(138, 180, 248, 0.15);
    color: #8AB4F8;
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.03125rem;
  }

  .top10-card {
    position: absolute;
    top: 0;
    left: var(--card-x, 0rem);
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

  /* Art area: rank number + poster (title lives outside so it can't shift these) */
  .top10-art {
    position: relative;
  }

  /* Big number behind the poster */
  .top10-number {
    position: absolute;
    left: -1.25rem;
    bottom: 0.625rem;
    z-index: 0;
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }

  .top10-number-stroke {
    position: absolute;
    font-size: 9rem;
    font-weight: 900;
    line-height: 0.8;
    letter-spacing: -0.375rem;
    color: #3a3d42;
    -webkit-text-stroke: 0.125rem #3a3d42;
  }

  .top10-number-fill {
    position: relative;
    font-size: 9rem;
    font-weight: 900;
    line-height: 0.8;
    letter-spacing: -0.375rem;
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
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background: #141414;
    border-radius: 0.5rem;
    border: 0.125rem solid rgba(255, 255, 255, 0.08);
    z-index: 1;
    margin-left: 1.875rem;
    transition: border-color var(--animation-duration) ease;
    box-shadow: -0.25rem 0.5rem 0.75rem rgba(0, 0, 0, var(--shadow-opacity));
  }

  .top10-poster--top1 {
    border-width: 0.09375rem;
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
    top: 0.375rem;
    left: 0.375rem;
    width: 1.375rem;
    height: 1.375rem;
    border-radius: 0.6875rem;
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
    margin-left: 1.875rem;
  }

  .top10-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25;
    /* Reserve two full lines so short titles don't collapse the row height */
    min-height: 2.1875rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(255, 255, 255, 0.9);
  }
</style>
