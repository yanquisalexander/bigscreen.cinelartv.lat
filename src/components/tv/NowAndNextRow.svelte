<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import EpgProgressBar from '@/components/tv/EpgProgressBar.svelte';
  import type { LiveTvChannel } from '@/api/live';
  import { Tv, Star, Play, Clock } from '@lucide/svelte';

  interface Props {
    channels: LiveTvChannel[];
    favorites: Set<string>;
    onPlay: (channel: LiveTvChannel) => void;
    onToggleFavorite: (channelId: string) => void;
    focusKey?: string;
    preferredChildFocusKey?: string;
    onArrowUp?: () => void;
  }

  let {
    channels,
    favorites,
    onPlay,
    onToggleFavorite,
    focusKey = 'live-now-next',
    preferredChildFocusKey,
    onArrowUp,
  }: Props = $props();

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<FocusContainer
  {focusKey}
  {preferredChildFocusKey}
  trackChildren={true}
  saveLastFocusedChild={true}
  class="mb-[clamp(0.5rem,1.5vh,1rem)]"
>
  <h2 class="text-[clamp(1rem,1.4vw,1.125rem)] font-bold text-text-primary mb-[clamp(0.25rem,0.6vh,0.5rem)] px-[clamp(3rem,7.5vw,6rem)] flex items-center gap-2">
    <span class="w-2 h-2 rounded-full bg-live animate-pulse"></span>
    En Vivo Ahora
  </h2>
  <div class="flex gap-4 px-[clamp(3rem,7.5vw,6rem)] overflow-x-auto hide-scrollbar pt-1 pb-2 snap-x snap-start">
    {#each channels as ch, idx (ch.id)}
      <Focusable
        focusKey="now-{ch.id}"
        onEnterPress={() => onPlay(ch)}
        onArrowPress={(direction) => {
          if (direction === 'up' && onArrowUp) {
            onArrowUp();
            return false;
          }
          return true;
        }}
        focusedClass="!border-white/40 !scale-[1.02] !z-10"
        class="shrink-0 w-[clamp(240px,20vw,320px)] h-[clamp(120px,16vh,170px)] rounded-2xl overflow-hidden snap-start flex relative bg-surface border-2 border-transparent cursor-pointer transition-all duration-300"
        playSound={true}
      >
        {#snippet children({ focused })}
          <div class="absolute inset-0 bg-gradient-to-r from-surface via-surface/95 to-surface/80"></div>

          <div class="relative flex items-center gap-4 px-5 py-4 w-full z-10">
            <div class="shrink-0">
              {#if ch.logo_url}
                <img
                  src={ch.logo_url}
                  alt={ch.name}
                  class="w-[clamp(3rem,5vw,4rem)] h-[clamp(3rem,5vw,4rem)] object-contain"
                  loading="lazy"
                />
              {:else}
                <div class="w-[clamp(3rem,5vw,4rem)] h-[clamp(3rem,5vw,4rem)] rounded-xl bg-surface-elevated flex items-center justify-center">
                  <Tv class="w-6 h-6 text-text-secondary" />
                </div>
              {/if}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <p class="text-white text-[clamp(0.8rem,1.1vw,1rem)] font-bold truncate">
                  {ch.name}
                </p>
                <button
                  type="button"
                  tabindex={-1}
                  onclick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(ch.id);
                  }}
                  class="p-0.5 shrink-0"
                >
                  <Star class="w-3.5 h-3.5 {favorites.has(ch.id) ? 'fill-accent text-accent' : 'text-white/20'}" />
                </button>
              </div>

              {#if ch.current_program}
                <div class="flex items-center gap-1.5 mb-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-live shrink-0"></div>
                  <p class="text-white text-[clamp(0.65rem,0.85vw,0.8rem)] font-medium truncate">
                    {ch.current_program.title}
                  </p>
                </div>
                <div class="flex items-center gap-1.5 mb-1.5">
                  <Clock class="w-3 h-3 text-accent-light shrink-0" />
                  <p class="text-accent-light text-[clamp(0.55rem,0.7vw,0.65rem)]">
                    {formatTime(ch.current_program.start_time)} – {formatTime(ch.current_program.end_time)}
                  </p>
                </div>
                <EpgProgressBar program={ch.current_program} size="sm" />
              {:else}
                <p class="text-text-tertiary text-[clamp(0.6rem,0.75vw,0.7rem)]">Sin programación</p>
              {/if}

              {#if ch.upcoming_programs?.[0]}
                <div class="flex items-center gap-1.5 mt-1.5">
                  <span class="text-text-secondary text-[clamp(0.5rem,0.6vw,0.55rem)] uppercase tracking-wider">Siguiente:</span>
                  <span class="text-text-secondary text-[clamp(0.5rem,0.6vw,0.55rem)] truncate">
                    {ch.upcoming_programs[0].title}
                  </span>
                </div>
              {/if}
            </div>
          </div>

          {#if focused}
            <div class="absolute right-4 top-1/2 -translate-y-1/2 z-10">
              <div class="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Play class="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
          {/if}

          {#if focused}
            <div class="absolute inset-0 border-2 border-white/40 rounded-2xl pointer-events-none z-20"></div>
          {/if}
        {/snippet}
      </Focusable>
    {/each}
  </div>
</FocusContainer>
