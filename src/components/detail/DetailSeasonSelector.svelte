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
    onArrowLeft?: (direction: string) => boolean;
    firstEpisodeFocusKey?: string;
  }

  let {
    seasons,
    selectedIndex,
    onSelect,
    focusKey = 'detail-seasons',
    onArrowUp,
    onArrowDown,
    onArrowLeft,
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
  <div class="flex items-center gap-[clamp(0.375rem,0.8vw,0.625rem)] flex-wrap">
    {#each seasons as season, i (season.id)}
      {@const isSelected = selectedIndex === i}
      <Focusable
        focusKey={`detail-season-${season.id}`}
        onEnterPress={() => onSelect(i)}
        onArrowPress={(dir) => {
          if (dir === 'left' && i === 0 && onArrowLeft) return onArrowLeft(dir);
          if (dir === 'up' && onArrowUp) return onArrowUp(dir);
          if (dir === 'down' && onArrowDown) return onArrowDown(dir);
          return true;
        }}
        focusedClass={isSelected ? 'scale-105 ring-2 ring-white/60' : '!bg-white !text-black scale-105'}
        class="tv-no-select cursor-pointer border px-[clamp(1rem,1.8vw,1.5rem)] py-[clamp(0.4rem,0.9vh,0.65rem)] rounded-lg font-medium transition-transform duration-150 ease-out text-[clamp(0.95rem,1.05vw,1.125rem)] {isSelected ? 'bg-white text-black font-semibold border-white shadow-sm' : 'bg-surface text-text-secondary border-white/10'}"
        playSound={true}
      >
        {#snippet children()}
          {season.title}
        {/snippet}
      </Focusable>
    {/each}
  </div>
</FocusContainer>
