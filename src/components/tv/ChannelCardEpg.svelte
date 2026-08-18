<script lang="ts">
  import Focusable from '@/components/tv/Focusable.svelte';
  import EpgProgressBar from '@/components/tv/EpgProgressBar.svelte';
  import type { LiveTvChannel } from '@/api/live';
  import { Tv, Star } from '@lucide/svelte';

  interface Props {
    channel: LiveTvChannel;
    isFavorite: boolean;
    onPlay: (channel: LiveTvChannel) => void;
    onToggleFavorite: (channelId: string) => void;
    onArrowPress?: (direction: string, details: any) => boolean;
    focusKey: string;
    class?: string;
  }

  let {
    channel,
    isFavorite,
    onPlay,
    onToggleFavorite,
    onArrowPress,
    focusKey,
    class: className = '',
  }: Props = $props();

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<Focusable
  {focusKey}
  onEnterPress={() => onPlay(channel)}
  {onArrowPress}
  focusedClass="!border-white/40 !scale-[1.03] !z-10"
  class="shrink-0 w-[clamp(160px,14vw,200px)] h-[clamp(200px,22vh,260px)] rounded-2xl overflow-hidden snap-start flex flex-col relative bg-surface border-2 border-transparent cursor-pointer transition-all duration-300 {className}"
  playSound={true}
>
  {#snippet children({ focused })}
    <div class="absolute top-3 left-3 flex items-center gap-1.5 bg-live/90 rounded-full px-2 py-0.5 z-10">
      <span class="text-white text-[9px] font-bold uppercase tracking-wider">Live</span>
    </div>

    <button
      type="button"
      tabindex={-1}
      onclick={(e) => {
        e.stopPropagation();
        onToggleFavorite(channel.id);
      }}
      class="absolute top-3 right-3 p-1 z-10"
    >
      <Star class="w-4 h-4 {isFavorite ? 'fill-accent text-accent' : 'text-white/30'}" />
    </button>

    <div class="flex-1 flex flex-col items-center justify-center gap-2 p-4 pt-10">
      {#if channel.logo_url}
        <img
          src={channel.logo_url}
          alt={channel.name}
          class="w-[clamp(3rem,5vw,4.5rem)] h-[clamp(3rem,5vw,4.5rem)] object-contain shrink-0"
          loading="lazy"
        />
      {:else}
        <div class="w-[clamp(3rem,5vw,4.5rem)] h-[clamp(3rem,5vw,4.5rem)] rounded-xl bg-surface-elevated flex items-center justify-center shrink-0">
          <Tv class="w-6 h-6 text-text-secondary" />
        </div>
      {/if}

      <p class="text-white text-[clamp(0.75rem,1vw,0.9rem)] font-semibold text-center leading-tight line-clamp-1">
        {channel.name}
      </p>

      {#if channel.current_program?.category}
        <span class="text-[9px] font-medium uppercase tracking-wider text-accent-light bg-accent/15 rounded-full px-2 py-0.5">
          {channel.current_program.category}
        </span>
      {/if}
    </div>

    <div class="px-3 pb-3 mt-auto">
      {#if channel.current_program}
        <p class="text-white text-[clamp(0.6rem,0.8vw,0.75rem)] font-medium truncate">
          {channel.current_program.title}
        </p>
        <p class="text-text-secondary text-[clamp(0.55rem,0.65vw,0.65rem)] mt-0.5">
          {formatTime(channel.current_program.start_time)} – {formatTime(channel.current_program.end_time)}
        </p>
        <EpgProgressBar program={channel.current_program} class="mt-1.5" size="sm" />
      {:else}
        <p class="text-text-tertiary text-[clamp(0.55rem,0.65vw,0.65rem)]">Sin programación</p>
      {/if}
    </div>

    {#if focused}
      <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>
    {/if}
  {/snippet}
</Focusable>
