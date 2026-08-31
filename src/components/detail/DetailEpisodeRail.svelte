<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { svelteConfigStore } from '@/stores/configStore';
  import { resolveEpisodeThumbnail } from '@/utils/helpers';
  import type { Episode } from '@/types/content';
  import { Lock } from '@lucide/svelte';

  interface Props {
    episodes: Episode[];
    seasonIndex: number;
    focusKey?: string;
    preferredChildFocusKey?: string;
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
    onPlayEpisode,
    onFocusEpisode,
    onArrowUp,
    onArrowLeft,
  }: Props = $props();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let rafId = 0;

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

        el.scrollTo({ left: scrollLeft, behavior: 'smooth' });
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
  focusKey="{focusKey}-{seasonIndex}"
  {preferredChildFocusKey}
  trackChildren={true}
  saveLastFocusedChild={true}
>
  <div class="relative">
    <div
      bind:this={scrollEl}
      class="flex gap-[clamp(0.75rem,1.2vw,1.125rem)] overflow-x-auto hide-scrollbar py-[clamp(0.5rem,1vh,0.875rem)] px-[clamp(1rem,2vw,2rem)]"
    >
      {#each episodes as episode, idx (episode.id)}
        {@const clientEndpoint = $svelteConfigStore.config.CLIENT_ENDPOINT}
        {@const thumbUrl = resolveEpisodeThumbnail(episode.images, episode.thumbnail_resized ?? episode.thumbnail, clientEndpoint)}
        {@const progress = episode.continue_watching ? Math.round((episode.continue_watching.progress / episode.continue_watching.duration) * 100) : undefined}
        {@const episodeNum = (episode.position ?? idx) + 1}

        <Focusable
          focusKey="detail-episode-{episode.id}"
          onEnterPress={() => onPlayEpisode(episode.id)}
          onFocus={() => onFocusEpisode?.(episode.id)}
          onArrowPress={(dir) => {
            if (dir === 'up' && onArrowUp) return onArrowUp(dir);
            if (dir === 'left' && idx === 0 && onArrowLeft) return onArrowLeft(dir);
            return true;
          }}
          focusedClass=""
          class="tv-no-select relative shrink-0 cursor-pointer w-[clamp(13rem,14vw,18rem)] transition-all duration-200 ease-out will-change-transform"
          playSound={true}
        >
          {#snippet children({ focused })}
            <div class="relative w-full aspect-video rounded-xl overflow-hidden {focused ? 'border-2 border-white scale-[1.03]' : 'border-2 border-transparent'}" style="transition: border-color 200ms ease, transform 250ms cubic-bezier(0.4, 0, 0.2, 1);">
              {#if thumbUrl}
                <img
                  src={thumbUrl}
                  alt={episode.title}
                  class="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              {:else}
                <div class="absolute inset-0 bg-surface-elevated"></div>
              {/if}

              <!-- Light gradient for badge legibility -->
              <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>

              <!-- Episode badge top-left -->
              <div class="absolute top-[clamp(0.35rem,0.6vh,0.5rem)] left-[clamp(0.35rem,0.6vw,0.5rem)] z-2 flex items-center gap-[0.375em] bg-black/60 rounded-[clamp(0.2rem,0.4vw,0.25rem)] px-[clamp(0.3rem,0.5vw,0.4rem)] py-[clamp(0.1rem,0.2vh,0.15rem)]">
                {#if episode.premium}
                  <Lock size={11} class="text-amber-400 shrink-0" />
                {/if}
                <span class="text-white text-[clamp(0.55rem,0.7vw,0.65rem)] font-semibold">
                  T{seasonIndex + 1} · E{episodeNum}
                </span>
              </div>

              <!-- Progress bar -->
              {#if progress != null && progress > 0}
                <div class="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15 z-2">
                  <div
                    class="h-full bg-white"
                    style="width: {Math.min(progress, 100)}%;"
                  ></div>
                </div>
              {/if}
            </div>

            <!-- Episode title -->
            <div class="px-[clamp(0.5rem,1vw,0.75rem)] pt-[clamp(0.4rem,0.8vh,0.6rem)] pb-[clamp(0.25rem,0.5vh,0.375rem)]">
              <span class="block text-white/90 text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold leading-[1.25] overflow-hidden text-ellipsis transition-[white-space] duration-200" style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;">
                {episode.title}
              </span>
            </div>

            <div class="px-[clamp(0.5rem,1vw,0.75rem)] pb-[clamp(0.35rem,0.6vh,0.5rem)]">
              <span class="block {focused ? 'text-white/60' : 'text-white/45'} text-[clamp(0.65rem,0.85vw,0.75rem)] leading-[1.35] overflow-hidden text-ellipsis transition-colors duration-200" style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;">
                {episode.description || 'Este episodio no tiene descripción disponible.'}
              </span>
            </div>
          {/snippet}
        </Focusable>
      {/each}
    </div>
  </div>
</FocusContainer>
