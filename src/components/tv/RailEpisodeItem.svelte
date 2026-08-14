<script lang="ts">
  import { Play } from '@lucide/svelte';
  import { spatialNav, type SpatialNavParams } from '@/lib/spatial/spatialAction';
  import type { WatchEpisode } from '@/types/content';

  const ACCENT = '#FFFFFF';

  export type FlatEpisode = WatchEpisode & { seasonNumber: number };

  interface Props {
    episode: FlatEpisode;
    index: number;
    isActive: boolean;
    expanded: boolean;
    showSeasonEyebrow: boolean;
    thumbUrl?: string | null;
    onSelect: (epId: string | number) => void;
    onCenter: (ep: FlatEpisode) => void;
    registerNode?: (id: string, node: HTMLDivElement | null) => void;
  }

  let {
    episode: ep,
    index,
    isActive,
    expanded,
    showSeasonEyebrow,
    thumbUrl,
    onSelect,
    onCenter,
    registerNode,
  }: Props = $props();

  let focused = $state(false);
  let innerCardEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    registerNode?.(String(ep.id), innerCardEl);
    return () => {
      registerNode?.(String(ep.id), null);
    };
  });

  const isExpanded = $derived(expanded && focused);
  const cardWidth = $derived(isExpanded ? 'clamp(180px, 13.5vw, 260px)' : 'clamp(112px, 8.2vw, 156px)');
  const cardHeight = $derived(isExpanded ? 'clamp(101px, 7.6vw, 146px)' : 'clamp(63px, 4.6vw, 88px)');

  const navParams = $derived<SpatialNavParams>({
    focusKey: `rail-ep-item-${ep.id}`,
    onEnterPress: () => onSelect(ep.id),
    onFocus: () => {
      focused = true;
      onCenter(ep);
    },
    onBlur: () => {
      focused = false;
    },
  });
</script>

<div
  use:spatialNav={navParams}
  onclick={() => onSelect(ep.id)}
  role="button"
  tabindex="0"
  class="snap-center shrink-0 transition-all duration-300 cursor-pointer {focused ? 'scale-[1.03]' : ''}"
  style="width: {cardWidth};"
>
  <div
    bind:this={innerCardEl}
    class="relative bg-neutral-900 transition-all duration-300 rounded-xl overflow-hidden {focused ? 'ring-2 ring-white/80 shadow-lg shadow-black/40' : ''}"
    style="width: {cardWidth}; height: {cardHeight};"
  >
    {#if thumbUrl}
      <img src={thumbUrl} alt="" class="w-full h-full object-cover" loading="lazy" />
    {:else}
      <div class="w-full h-full flex items-center justify-center bg-neutral-800">
        <Play size={22} class="text-neutral-600" />
      </div>
    {/if}

    <!-- Gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

    <!-- Active indicator -->
    {#if isActive}
      <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
        <div class="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
          <div class="flex items-end gap-0.5 h-3.5">
            <div class="w-[2.5px] h-2 rounded-full animate-pulse" style="background-color: #000;"></div>
            <div class="w-[2.5px] h-3.5 rounded-full animate-pulse [animation-delay:0.15s]" style="background-color: #000;"></div>
            <div class="w-[2.5px] h-2.5 rounded-full animate-pulse [animation-delay:0.3s]" style="background-color: #000;"></div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Episode number badge -->
    <div class="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-semibold text-white/80 tabular-nums">
      {showSeasonEyebrow ? `T${ep.seasonNumber} · ` : ''}E{index + 1}
    </div>
  </div>

  <div
    class="px-0.5 overflow-hidden transition-all duration-300 {isExpanded ? 'mt-2 max-h-10 opacity-100' : 'mt-0 max-h-0 opacity-0'}"
  >
    <p
      class="text-[13px] font-medium leading-snug truncate transition-colors duration-200 {isActive ? 'text-white' : focused ? 'text-white/90' : 'text-white/65'}"
    >
      {ep.title}
    </p>
    {#if isActive}
      <p class="text-[11px] font-medium mt-0.5" style="color: {ACCENT};">
        Reproduciendo
      </p>
    {/if}
  </div>
</div>
