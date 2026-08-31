<script lang="ts">
  import { SpatialNavigation, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import { FocusableRegistrar } from '@/components/tv/spatialFocus';
  import { svelteConfigStore } from '@/stores/configStore';
  import { resolveEpisodeThumbnail } from '@/utils/helpers';
  import type { Episode } from '@/types/content';
  import { Lock } from '@lucide/svelte';

  interface Props {
    episodes: Episode[];
    seasonIndex: number;
    focusKey?: string;
    preferredChildFocusKey?: string;
    parentFocusKey?: string;
    onPlayEpisode: (episodeId: string | number) => void;
    onFocusEpisode?: (episodeId: string | number) => void;
    onArrowUp?: (direction: string) => boolean;
    onArrowLeft?: (direction: string) => boolean;
  }

  let {
    episodes,
    seasonIndex,
    focusKey = 'detail-episodes',
    preferredChildFocusKey,
    parentFocusKey = 'content-root',
    onPlayEpisode,
    onFocusEpisode,
    onArrowUp,
    onArrowLeft,
  }: Props = $props();

  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);

  let viewportEl = $state<HTMLDivElement | null>(null);
  let trackEl = $state<HTMLDivElement | null>(null);
  let renderedKeys: string[] = [];
  let lastFocusedKey = '';

  let _scrollLeft = 0;
  let _viewportWidth = 0;
  let _itemWidth = 0;
  let _gap = 0;
  let _overscan = 2;
  let _metricsComputed = false;
  let _resizeObserver: ResizeObserver | null = null;

  const registrar = new FocusableRegistrar();

  let _rerender = $state(0);

  const hasMultipleSeasons = $derived(new Set(episodes.map(e => (e as any).seasonNumber ?? 1)).size > 1);

  function _getVisibleRange(): { start: number; end: number } {
    const itemW = _itemWidth || 180;
    const gap = _gap || 12;
    const totalItemWidth = itemW + gap;
    const vpWidth = _viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const start = Math.max(0, Math.floor(_scrollLeft / totalItemWidth) - _overscan);
    const visibleCount = Math.ceil(vpWidth / totalItemWidth);
    const end = Math.min(episodes.length, start + visibleCount + _overscan * 2);
    return { start, end };
  }

  const _visibleRange = $derived.by(() => {
    void _rerender;
    return _getVisibleRange();
  });

  const _visibleEpisodes = $derived(episodes.slice(_visibleRange.start, _visibleRange.end));

  function _computeMetrics() {
    if (!viewportEl) return;
    const temp = document.createElement('div');
    temp.className = 'dcard';
    temp.style.cssText = 'position:absolute;visibility:hidden;width:clamp(156px,18vw,230px);';
    viewportEl.appendChild(temp);
    _itemWidth = temp.offsetWidth;
    _gap = parseFloat(getComputedStyle(viewportEl).gap) || 12;
    temp.remove();
    _viewportWidth = viewportEl.clientWidth;
    _metricsComputed = true;

    if (!_resizeObserver) {
      _resizeObserver = new ResizeObserver(() => {
        if (viewportEl) {
          _viewportWidth = viewportEl.clientWidth;
          _rerender++;
        }
      });
      _resizeObserver.observe(viewportEl);
    }

    _scrollToCurrentEpisode();
    _syncFocusables();
  }

  function _setScrollLeft(px: number) {
    _scrollLeft = px;
    _rerender++;
  }

  function scrollToVirtualItem(index: number) {
    const itemW = _itemWidth || 180;
    const gap = _gap || 12;
    const step = itemW + gap;
    const vpW = _viewportWidth || viewportEl?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const totalWidth = Math.max(0, episodes.length * step - gap);
    const endPadding = itemW * 0.35;
    const maxScroll = Math.max(0, totalWidth - vpW + endPadding);
    const x = index * step;
    const target = Math.max(0, Math.min(x - vpW / 2 + itemW / 2, maxScroll));
    _setScrollLeft(target);
  }

  function _scrollToCurrentEpisode() {
    const idx = episodes.findIndex(e => String(e.id) === String((episodes as any).currentEpisodeId));
    if (idx >= 0) scrollToVirtualItem(idx);
  }

  async function revealAndFocusEpisode(index: number) {
    const episode = episodes[index];
    if (!episode) return;
    const fKey = `detail-ep-${episode.id}`;
    scrollToVirtualItem(index);
    await tick();
    _syncFocusables();
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    try { SpatialNavigation.setFocus(fKey); } catch (_e) { /* noop */ }
  }

  function _syncFocusables() {
    if (!trackEl) return;
    const cards = trackEl.querySelectorAll('.dcard');
    for (const key of renderedKeys) registrar.unregister(key);
    renderedKeys = [];
    if (episodes.length === 0) return;

    cards.forEach((card) => {
      const index = parseInt(card.getAttribute('data-episode-index') || '-1', 10);
      if (index < 0 || index >= episodes.length) return;
      const episode = episodes[index];
      if (!episode) return;
      const fKey = `detail-ep-${episode.id}`;
      registrar.register([{
        focusKey: fKey,
        node: card as HTMLElement,
        parentFocusKey,
        onEnterPress: () => onPlayEpisode(episode.id),
        onArrowPress: (direction: string) => {
          if (direction === 'up' && onArrowUp) return onArrowUp(direction);
          if (direction === 'down') return false;
          if (direction === 'left') {
            if (index === 0 && onArrowLeft) return onArrowLeft(direction);
            if (index > 0) { void revealAndFocusEpisode(index - 1); return false; }
          }
          if (direction === 'right') {
            if (index < episodes.length - 1) { void revealAndFocusEpisode(index + 1); return false; }
          }
          return true;
        },
        onFocus: () => {
          lastFocusedKey = fKey;
          card.setAttribute('data-focused', 'true');
          scrollToVirtualItem(index);
          onFocusEpisode?.(episode.id);
        },
        onBlur: () => {
          card.setAttribute('data-focused', 'false');
          requestAnimationFrame(() => {
            const cur = getCurrentFocusKey() ?? '';
            if (!cur.startsWith('detail-ep-')) return;
          });
        },
      }]);
      renderedKeys.push(fKey);
    });
  }

  function _destroyFocusables() {
    for (const key of renderedKeys) registrar.unregister(key);
    renderedKeys = [];
  }

  import { tick } from 'svelte';

  $effect(() => {
    if (episodes.length > 0 && viewportEl && !_metricsComputed) {
      requestAnimationFrame(() => _computeMetrics());
    }
    return () => {
      _destroyFocusables();
      if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
    };
  });

  $effect(() => {
    void _rerender;
    if (_metricsComputed) _syncFocusables();
  });

  function resolveThumb(ep: Episode) {
    return resolveEpisodeThumbnail(ep.images, ep.thumbnail_resized ?? ep.thumbnail, clientEndpoint);
  }

  function cardX(index: number) {
    return index * (_itemWidth + _gap);
  }

  function epNum(ep: Episode, idx: number) {
    return (ep.position != null ? ep.position + 1 : idx + 1);
  }
</script>

<div class="detail-episode-rail" class:hidden={episodes.length === 0}>
  <div class="dviewport" bind:this={viewportEl}>
    <div
      class="dtrack"
      bind:this={trackEl}
      style="transform: translateX({-_scrollLeft}px) translateZ(0);"
    >
      {#each _visibleEpisodes as episode, i (episode.id)}
        {@const realIndex = _visibleRange.start + i}
        {@const thumbUrl = resolveThumb(episode)}
        {@const progress = episode.continue_watching ? Math.round((episode.continue_watching.progress / episode.continue_watching.duration) * 100) : undefined}
        {@const isPartial = cardX(realIndex) < _scrollLeft || cardX(realIndex) + (_itemWidth || 180) > _scrollLeft + (_viewportWidth || 1280)}

        <div
          class="dcard"
          data-focused="false"
          data-partial={isPartial || undefined}
          data-episode-index={realIndex}
          style="width: {_itemWidth || 180}px; --ep-x: {cardX(realIndex)}px;"
          role="button"
          tabindex="-1"
        >
          <span class="dthumb">
            {#if thumbUrl}
              <img src={thumbUrl} alt="" loading="lazy" />
            {/if}
            <span class="dbadge">{hasMultipleSeasons ? `T${(episode as any).seasonNumber ?? 1} · ` : ''}E{epNum(episode, realIndex)}</span>
            {#if episode.premium}
              <span class="dlock"><Lock size={11} /></span>
            {/if}
          </span>
          <span class="dtitle">{episode.title}</span>
          <span class="ddesc">{episode.description || 'Este episodio no tiene descripción disponible.'}</span>
          {#if progress != null && progress > 0}
            <div class="dprogress">
              <div class="dprogress-bar" style="width: {Math.min(progress, 100)}%;"></div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .detail-episode-rail {
    display: block;
    width: 100%;
    contain: layout style;
  }
  .detail-episode-rail.hidden { display: none; }

  .dviewport {
    position: relative;
    width: 100%;
    height: clamp(10rem, 22vh, 16rem);
    overflow: hidden;
    padding: clamp(0.35rem, 0.8vh, 0.55rem) 0;
  }

  .dtrack {
    position: absolute;
    height: 100%;
    width: 100%;
    top: 0;
    left: 0;
    will-change: transform;
  }

  .dcard {
    position: absolute;
    left: 0;
    top: 0;
    display: block;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    outline: 0;
    color: #fff;
    text-align: left;
    cursor: pointer;
    transform: translateX(var(--ep-x, 0px));
    transition: opacity 200ms ease, border-color 200ms ease;
    opacity: 1;
  }

  .dcard[data-focused="true"] { z-index: 2; }
  .dcard[data-partial="true"] { opacity: 0.3; }

  .dthumb {
    display: block;
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 0.75rem;
    background: #262626;
    transition: border-color 200ms ease, transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .dcard[data-focused="true"] .dthumb {
    border-color: #fff;
    transform: scale(1.03);
  }

  .dthumb :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .dthumb::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%);
    pointer-events: none;
  }

  .dbadge {
    position: absolute;
    top: clamp(0.35rem, 0.6vh, 0.5rem);
    left: clamp(0.35rem, 0.6vw, 0.5rem);
    z-index: 2;
    background: rgba(0,0,0,0.6);
    color: #fff;
    font-size: clamp(0.55rem, 0.7vw, 0.65rem);
    font-weight: 600;
    padding: clamp(0.1rem, 0.2vh, 0.15rem) clamp(0.3rem, 0.5vw, 0.4rem);
    border-radius: clamp(0.2rem, 0.4vw, 0.25rem);
    pointer-events: none;
  }

  .dlock {
    position: absolute;
    top: clamp(0.35rem, 0.6vh, 0.5rem);
    right: clamp(0.35rem, 0.6vw, 0.5rem);
    z-index: 2;
    color: #fbbf24;
    pointer-events: none;
  }

  .dtitle {
    display: block;
    box-sizing: border-box;
    width: 100%;
    margin: 0.4rem 0 0;
    color: rgba(255,255,255,0.9);
    font-size: clamp(0.75rem, 1.1vw, 0.875rem);
    font-weight: 600;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: white-space 200ms ease;
  }

  .dcard[data-focused="true"] .dtitle {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .ddesc {
    display: none;
    width: 100%;
    margin: 0.25rem 0 0;
    color: rgba(255,255,255,0.45);
    font-size: clamp(0.65rem, 0.85vw, 0.75rem);
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dcard[data-focused="true"] .ddesc {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    color: rgba(255,255,255,0.6);
  }

  .dprogress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255,255,255,0.15);
  }

  .dprogress-bar {
    height: 100%;
    background: var(--color-accent, #e11d48);
  }
</style>
