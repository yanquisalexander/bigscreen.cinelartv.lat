<script lang="ts">
  import { tick } from 'svelte';
  import { SpatialNavigation, setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { FocusableRegistrar } from '@/components/tv/spatialFocus';
  import { setFocusContext } from '@/lib/spatial/spatialContext';
  import { useAmbientStore } from '@/stores/ambientStore';
  import type { ContentItem } from '@/types/content';
  import { resolveBackdrop, resolveImageUrl } from '@/utils/helpers';

  interface EpisodeInfo {
    title?: string;
    position?: number | null;
    thumbnail?: string | null;
    thumbnail_resized?: string | null;
  }

  interface Props {
    title?: string;
    items: ContentItem[];
    sectionKind?: string;
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
    sectionKind,
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

  function getStep() {
    return itemWidth + itemGap;
  }

  function getMaxScroll() {
    const step = getStep();
    const totalW = items.length * step - itemGap;
    return Math.max(0, totalW - viewportWidth + viewportWidth * 0.4);
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

    const temp = document.createElement('div');
    temp.style.cssText =
      'position:absolute;visibility:hidden;width:clamp(13rem,14vw,18rem);height:0;overflow:hidden;';
    viewportEl.appendChild(temp);
    itemWidth = temp.offsetWidth;
    temp.remove();

    viewportWidth = viewportEl.clientWidth;

    const track = viewportEl.querySelector<HTMLElement>('[data-virtual-track]');
    itemGap = track ? parseFloat(getComputedStyle(track).gap) || 16 : 16;

    metricsMeasured = true;

    if (onMeasureHeight) {
      const shelfEl = viewportEl?.closest('.home-shelf');
      if (shelfEl) {
        onMeasureHeight(shelfEl.getBoundingClientRect().height);
      } else {
        const thumbH = Math.round(itemWidth * 9 / 16);
        const titleH = 36;
        const padY = 28;
        onMeasureHeight(thumbH + titleH + padY);
      }
    }
  }

  function scrollToCard(index: number) {
    const step = getStep();
    if (step <= 0) return;
    const x = index * step;
    const maxS = getMaxScroll();
    scrollLeft = Math.max(0, Math.min(x - viewportWidth / 2 + itemWidth / 2, maxS));
  }

  async function revealAndFocusCard(index: number) {
    if (index < 0 || index >= items.length) return;
    const item = items[index];
    if (!item) return;

    scrollToCard(index);
    await tick();
    syncFocusables();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const key = `home-row-${categoryIndex}-item-${item.id}`;
    try {
      setFocus(key);
    } catch {
      /* noop */
    }
  }

  let rowHasFocus = false;

  function syncFocusables() {
    for (const key of renderedKeys) {
      registrar.unregister(key);
    }
    renderedKeys = [];

    if (!viewportEl) return;

    const cards = viewportEl.querySelectorAll<HTMLElement>('.home-card');
    cards.forEach((card) => {
      const idx = parseInt(card.getAttribute('data-card-index') ?? '-1', 10);
      if (idx < 0 || idx >= items.length) return;
      const item = items[idx];
      const key = `home-row-${categoryIndex}-item-${item.id}`;

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
            const thumb = card.querySelector<HTMLElement>('.home-card-thumb');
            if (thumb) {
              thumb.style.borderColor = '#fff';
              thumb.style.transform = 'scale(1.03)';
            }
            const desc = card.querySelector<HTMLElement>('.home-card-desc');
            if (desc) {
              desc.style.transition = 'opacity 200ms ease, transform 200ms ease';
              desc.style.opacity = '1';
              desc.style.transform = 'translateY(0)';
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
            const thumb = card.querySelector<HTMLElement>('.home-card-thumb');
            if (thumb) {
              thumb.style.borderColor = '';
              thumb.style.transform = '';
            }
            const desc = card.querySelector<HTMLElement>('.home-card-desc');
            if (desc) {
              desc.style.transition = 'opacity 150ms ease, transform 150ms ease';
              desc.style.opacity = '0';
              desc.style.transform = 'translateY(4px)';
            }
            card.style.zIndex = '';
            setTimeout(() => {
              if (viewportEl && !viewportEl.querySelector('.home-card[data-focused="true"]') && rowHasFocus) {
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

  function progressPercent(item: ContentItem): number {
    if (!item.progress || !item.duration) return 0;
    return Math.min(100, Math.round((item.progress / item.duration) * 100));
  }

  const isContinueWatching = $derived(sectionKind === 'continue_watching');

  function getEpisode(item: ContentItem): EpisodeInfo | null {
    const ep = (item as Record<string, unknown>)?.episode;
    if (typeof ep !== 'object' || ep === null) return null;
    return ep as EpisodeInfo;
  }

  function episodeLabel(item: ContentItem): string | null {
    const ep = getEpisode(item);
    if (!ep) return null;
    if (ep.title) return ep.title;
    if (typeof ep.position === 'number') return `Episodio ${ep.position + 1}`;
    return null;
  }

  function remainingLabel(item: ContentItem): string | null {
    if (!item.duration) return null;
    const left = Math.max(0, item.duration - (item.progress ?? 0));
    if (left <= 0) return null;
    const h = Math.floor(left / 3600);
    const m = Math.round((left % 3600) / 60);
    if (h > 0) return m > 0 ? `${h} h ${m} min restantes` : `${h} h restantes`;
    if (m > 0) return `${m} min restantes`;
    return 'Menos de 1 min restante';
  }

  function episodeThumb(item: ContentItem): string | null {
    const ep = getEpisode(item);
    if (!ep) return null;
    return resolveImageUrl(ep.thumbnail_resized ?? ep.thumbnail, clientEndpoint);
  }

  $effect(() => {
    if (viewportEl && !metricsMeasured) {
      computeMetrics();
    }
  });

  $effect(() => {
    if (!viewportEl) return;
    const observer = new ResizeObserver(() => {
      if (viewportEl) {
        viewportWidth = viewportEl.clientWidth;
      }
    });
    observer.observe(viewportEl);
    return () => observer.disconnect();
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

<div class="home-shelf mb-[clamp(0.5rem,1.2vh,1rem)]">
  {#if title}
    <h2
      class="text-[clamp(1rem,1.4vw,1.25rem)] font-medium text-white/95 mb-[clamp(0.35rem,0.7vh,0.5rem)] px-[clamp(3rem,7.5vw,6rem)]"
    >
      {title}
    </h2>
  {/if}
  <div
    bind:this={viewportEl}
    class="relative overflow-hidden pl-[clamp(3rem,7.5vw,6rem)] pr-[clamp(3rem,7.5vw,6rem)]"
    data-focus-container={focusKey}
    role="row"
    aria-label={title || undefined}
  >
    <div
      class="relative"
      data-virtual-track
      style="height: clamp(12.5rem,13vw,14.5rem); transform: translateX({-scrollLeft}px) translateZ(0); will-change: transform; transition: transform 150ms linear;"
    >
      {#each visibleItems as { item, index } (item.id)}
        {@const x = index * getStep()}
        {@const bannerImage = resolveBackdrop(
          item.images,
          item.banner_resized ?? item.banner,
          clientEndpoint,
          'medium',
        )}
        {@const thumbImage = isContinueWatching ? (episodeThumb(item) ?? bannerImage) : bannerImage}
        {@const progress = progressPercent(item)}
        {@const epLabel = isContinueWatching ? episodeLabel(item) : null}
        {@const remainLabel = isContinueWatching ? remainingLabel(item) : null}

        <div
          class="home-card"
          data-card-index={index}
          data-focused="false"
          role="button"
          tabindex="-1"
          aria-label={item.title}
          style="width: clamp(13rem,14vw,18rem); --card-x: {x}px;"
        >
          <div class="home-card-thumb">
            {#if thumbImage}
              <img
                src={thumbImage}
                alt={item.title}
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div class="home-card-fallback">{(item.title ?? '?').charAt(0)}</div>
            {/if}
            {#if progress > 0}
              <div class="home-card-progress">
                <div class="home-card-progress-bar" style="width: {progress}%;"></div>
              </div>
            {/if}
          </div>
          <div class="home-card-meta">
            <p class="home-card-title">{item.title}</p>
            {#if isContinueWatching && (epLabel || remainLabel)}
              <p class="home-card-sub">
                {#if epLabel}<span class="home-card-sub-ep">{epLabel}</span>{/if}
                {#if epLabel && remainLabel}<span class="home-card-sub-sep"> · </span>{/if}
                {#if remainLabel}<span class="home-card-sub-rem">{remainLabel}</span>{/if}
              </p>
            {:else if item.description}
              <p class="home-card-desc" style="opacity: 0; transform: translateY(4px);">{item.description}</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .home-card {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    box-sizing: border-box;
    margin: 0;
    padding: 4px 0 0 0;
    outline: 0;
    color: #fff;
    text-align: left;
    cursor: pointer;
    transform: translateX(var(--card-x, 0px));
    border: none;
    transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .home-card:focus-visible {
    outline: none;
  }

  .home-card-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #262626;
    border-radius: clamp(0.5rem, 0.7vw, 0.625rem);
    border: 2px solid transparent;
    transition: border-color 200ms ease, transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  }

  .home-card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .home-card-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #333;
    font-size: 1.5rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.5);
  }

  .home-card-meta {
    padding: clamp(0.35rem, 0.5vw, 0.45rem) clamp(0.1rem, 0.2vw, 0.15rem);
  }

  .home-card-title {
    margin: 0;
    font-size: clamp(0.75rem, 1.1vw, 0.875rem);
    font-weight: 500;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.9);
  }

  .home-card-desc {
    margin: 0;
    font-size: clamp(0.65rem, 0.85vw, 0.75rem);
    font-weight: 400;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.6);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .home-card-sub {
    margin: 2px 0 0 0;
    font-size: clamp(0.65rem, 0.85vw, 0.75rem);
    font-weight: 400;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.55);
  }

  .home-card-sub-ep {
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }

  .home-card-sub-sep {
    color: rgba(255, 255, 255, 0.3);
  }

  .home-card-sub-rem {
    color: rgba(255, 255, 255, 0.55);
  }

  .home-card-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.15);
    z-index: 3;
  }

  .home-card-progress-bar {
    height: 100%;
    background: #fff;
  }
</style>
