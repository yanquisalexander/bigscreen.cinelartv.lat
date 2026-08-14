<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import type { Season } from '@/types/content';

  interface Props {
    seasons: Season[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    focusKey?: string;
    onArrowUp?: (direction: string) => boolean;
    onArrowDown?: (direction: string) => boolean;
    firstEpisodeFocusKey?: string;
  }

  let {
    seasons,
    selectedIndex,
    onSelect,
    focusKey = 'detail-seasons',
    onArrowUp,
    onArrowDown,
  }: Props = $props();

  const preferredChildKey = $derived(
    seasons[selectedIndex]?.id ? `detail-season-${seasons[selectedIndex].id}` : undefined
  );
</script>

<FocusContainer
  {focusKey}
  focusable={false}
  preferredChildFocusKey={preferredChildKey}
  trackChildren={true}
  saveLastFocusedChild={true}
>
  <div class="flex items-center gap-[clamp(0.375rem,0.8vw,0.625rem)]">
    {#each seasons as season, i (season.id)}
      {@const isSelected = selectedIndex === i}
      <Focusable
        focusKey={`detail-season-${season.id}`}
        onEnterPress={() => onSelect(i)}
        onArrowPress={(dir) => {
          if (dir === 'up' && onArrowUp) return onArrowUp(dir);
          if (dir === 'down' && onArrowDown) return onArrowDown(dir);
          return true;
        }}
        focusedClass={isSelected ? 'scale-105 shadow-[0_0_16px_rgba(255,255,255,0.15)]' : '!bg-white/15 !text-white !border-white/30 scale-105'}
        class="tv-no-select cursor-pointer border px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.375rem,0.9vh,0.625rem)] rounded-lg font-medium transition-all duration-200 ease-out text-[clamp(0.8125rem,1.2vw,1rem)] {isSelected ? 'bg-white text-black font-semibold border-white' : 'bg-white/5 text-white/60 border-white/10'}"
        playSound={true}
      >
        {#snippet children()}
          {season.title}
        {/snippet}
      </Focusable>
    {/each}
  </div>
</FocusContainer>
