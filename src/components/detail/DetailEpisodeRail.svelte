<script lang="ts">
  import { TV_SCALE_EVENT } from '@/services/tvScale';
  import { tick } from 'svelte';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { svelteConfigStore } from '@/stores/configStore';
  import { resolveEpisodeThumbnail } from '@/utils/helpers';
  import type { Episode } from '@/types/content';
  import { Play } from '@lucide/svelte';

  let {
    episodes,
    seasonIndex,
    focusKey = 'detail-episodes',
    preferredChildFocusKey,
    onPlayEpisode,
    onFocusEpisode,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
  }: {
    episodes: Episode[];
    seasonIndex: number;
    focusKey?: string;
    preferredChildFocusKey?: string;
    onPlayEpisode: (id: string | number) => void;
    onFocusEpisode?: (id: string | number) => void;
    onArrowUp?: (direction: string) => boolean;
    onArrowDown?: (direction: string) => boolean;
    onArrowLeft?: (direction: string) => boolean;
  } = $props();

  let viewport = $state<HTMLDivElement | null>(null);
  let viewportWidth = $state(1280);
  let cardWidth = $state(280);
  let gap = $state(16);
  let offset = $state(0);
  let focusRequest = 0;
  let remSize = $state(16);

  const step = $derived(cardWidth + gap);
  const start = $derived(Math.max(0, Math.floor(offset / step) - 2));
  const end = $derived(Math.min(episodes.length, start + Math.ceil(viewportWidth / step) + 4));
  const visible = $derived(episodes.slice(start, end));

  function reveal(index: number) {
    const max = Math.max(0, episodes.length * step - gap - viewportWidth);
    offset = Math.max(0, Math.min(index * step, max));
  }

  async function move(index: number) {
    if (index < 0 || index >= episodes.length) return;
    const request = ++focusRequest;
    reveal(index);
    await tick();
    const key = `detail-episode-${episodes[index].id}`;
    if (request === focusRequest && doesFocusableExist(key)) {
      setFocus(key);
    }
  }

  $effect(() => {
    if (!viewport) return;

    const measure = () => {
      const dummy = document.createElement('div');
      dummy.style.cssText =
        'position:absolute;visibility:hidden;width:19.2rem;height:0;overflow:hidden;';
      viewport!.appendChild(dummy);
      cardWidth = dummy.offsetWidth || 280;
      dummy.remove();

      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      remSize = rem;
      viewportWidth = viewport!.clientWidth;
      gap = 1.25 * rem;
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    window.addEventListener(TV_SCALE_EVENT, measure);

    return () => {
      observer.disconnect();
      window.removeEventListener(TV_SCALE_EVENT, measure);
      focusRequest++;
    };
  });
</script>

<FocusContainer
  focusKey="{focusKey}-{seasonIndex}"
  focusable={false}
  {preferredChildFocusKey}
  saveLastFocusedChild={true}
>
  <div class="episode-viewport" bind:this={viewport}>
    <div
      class="episode-track"
      style="height: calc({cardWidth / remSize * 9 / 16}rem + 5.5rem); transform: translateX({-offset / remSize}rem) translateZ(0);"
    >
      {#each visible as episode, localIndex (episode.id)}
        {@const index = start + localIndex}
        {@const thumb = resolveEpisodeThumbnail(
          episode.images,
          episode.thumbnail_resized ?? episode.thumbnail,
          $svelteConfigStore.config.CLIENT_ENDPOINT
        )}
        {@const progress = episode.continue_watching?.duration
          ? Math.max(0, Math.min(100, (episode.continue_watching.progress / episode.continue_watching.duration) * 100))
          : 0}
        <Focusable
          focusKey="detail-episode-{episode.id}"
          class="episode-card"
          style="width: {cardWidth / remSize}rem; transform: translateX({index * step / remSize}rem);"
          onEnterPress={() => onPlayEpisode(episode.id)}
          onFocus={() => {
            reveal(index);
            onFocusEpisode?.(episode.id);
          }}
          onArrowPress={(dir) => {
            if (dir === 'up') return onArrowUp?.(dir) ?? true;
            if (dir === 'down') return onArrowDown?.(dir) ?? true;
            if (dir === 'left') {
              if (index === 0) return onArrowLeft?.(dir) ?? true;
              void move(index - 1);
              return false;
            }
            if (dir === 'right') {
              if (index < episodes.length - 1) void move(index + 1);
              return false;
            }
            return true;
          }}
        >
          {#snippet children({ focused })}
            <div class="episode-image" class:focused>
              {#if thumb}
                <img src={thumb} alt="" loading="lazy" decoding="async" />
              {/if}
              <div class="episode-label">
                <Play size="1rem" class="fill-current shrink-0" />
                <span>Episodio {(episode.position ?? index) + 1}</span>
              </div>
              {#if progress > 0}
                <div class="progress">
                  <span style="width: {progress}%;"></span>
                </div>
              {/if}
            </div>
            <p class="episode-title">{episode.title}</p>
            <p class="episode-description" style="opacity: {focused ? 1 : 0.7};">
              {episode.description ?? ''}
            </p>
          {/snippet}
        </Focusable>
      {/each}
    </div>
  </div>
</FocusContainer>

<style>
  .episode-viewport {
    overflow: hidden;
    padding: 0.5rem 0;
  }

  .episode-track {
    position: relative;
    transition: transform 150ms linear;
    will-change: transform;
  }

  :global(.episode-card) {
    position: absolute;
    top: 0;
    left: 0;
    cursor: pointer;
  }

  .episode-image {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #1C1C1E;
    border: 0.125rem solid transparent;
    border-radius: 0.5rem;
    transition: border-color 140ms ease-out, transform 140ms ease-out;
  }

  .episode-image.focused {
    border-color: #FFFFFF;
    transform: scale(1.02);
  }

  .episode-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .episode-label {
    position: absolute;
    inset: auto 0 0;
    padding: 1.5rem 0.75rem 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    background: linear-gradient(0deg, rgba(10, 10, 10, 0.9) 0%, transparent 100%);
    color: rgba(255, 255, 255, 0.9);
    font-size: clamp(0.85rem, 0.95vw, 1rem);
    font-weight: 600;
  }

  .episode-title {
    margin: 0.5rem 0.15rem 0.15rem;
    color: rgba(255, 255, 255, 0.9);
    font-size: clamp(0.95rem, 1.05vw, 1.125rem);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .episode-description {
    margin: 0 0.15rem;
    color: rgba(255, 255, 255, 0.6);
    font-size: clamp(0.825rem, 0.9vw, 0.95rem);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: opacity 140ms ease-out;
  }

  .progress {
    position: absolute;
    inset: auto 0 0;
    height: 0.1875rem;
    background: rgba(255, 255, 255, 0.22);
  }

  .progress span {
    display: block;
    height: 100%;
    background: #FFFFFF;
  }
</style>
