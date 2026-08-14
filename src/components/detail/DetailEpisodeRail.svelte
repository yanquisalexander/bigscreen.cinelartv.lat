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
    <div class="pointer-events-none absolute inset-y-0 left-0 w-[clamp(1.5rem,4vw,3rem)] bg-gradient-to-r from-bg to-transparent z-10"></div>
    <div class="pointer-events-none absolute inset-y-0 right-0 w-[clamp(1.5rem,4vw,3rem)] bg-gradient-to-l from-bg to-transparent z-10"></div>

    <div
      bind:this={scrollEl}
      class="flex gap-[clamp(0.75rem,1.2vw,1.125rem)] overflow-x-auto hide-scrollbar py-[clamp(0.5rem,1vh,0.875rem)]"
    >
      {#each episodes as episode, idx (episode.id)}
        {@const clientEndpoint = $svelteConfigStore.config.CLIENT_ENDPOINT}
        {@const thumbUrl = resolveEpisodeThumbnail(episode.images, episode.thumbnail_resized ?? episode.thumbnail, clientEndpoint)}
        {@const progress = episode.continue_watching ? Math.round((episode.continue_watching.progress / episode.continue_watching.duration) * 100) : undefined}
        {@const episodeNum = episode.position ?? idx + 1}

        <Focusable
          focusKey="detail-episode-{episode.id}"
          onEnterPress={() => onPlayEpisode(episode.id)}
          onFocus={() => onFocusEpisode?.(episode.id)}
          onArrowPress={(dir) => {
            if (dir === 'up' && onArrowUp) return onArrowUp(dir);
            if (dir === 'left' && idx === 0 && onArrowLeft) return onArrowLeft(dir);
            return true;
          }}
          focusedClass="ring-white scale-[1.03]"
          class="tv-no-select relative shrink-0 cursor-pointer rounded-xl overflow-hidden w-[clamp(13rem,14vw,18rem)] aspect-video bg-surface transition-all duration-200 ease-out will-change-transform ring-2 ring-transparent"
          playSound={true}
        >
          {#snippet children()}
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

            <!-- Bottom gradient for label legibility -->
            <div class="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>

            <!-- Episode label + lock -->
            <div class="absolute bottom-[clamp(0.5rem,1vh,0.75rem)] left-[clamp(0.625rem,1.2vw,0.875rem)] flex items-center gap-[0.375em]">
              {#if episode.premium}
                <Lock size={13} class="text-amber-400 shrink-0" />
              {/if}
              <span class="text-white text-[clamp(0.8125rem,1.05vw,0.9375rem)] font-bold tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                T{seasonIndex + 1} E{episodeNum}
              </span>
            </div>

            <!-- Progress bar -->
            {#if progress != null && progress > 0}
              <div class="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15">
                <div
                  class="h-full bg-accent"
                  style="width: {Math.min(progress, 100)}%;"
                ></div>
              </div>
            {/if}
          {/snippet}
        </Focusable>
      {/each}
    </div>
  </div>
</FocusContainer>
