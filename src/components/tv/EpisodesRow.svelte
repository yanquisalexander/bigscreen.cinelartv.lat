<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import RailEpisodeItem, { type FlatEpisode } from './RailEpisodeItem.svelte';

  export type EpisodeWithThumb = { ep: FlatEpisode; thumbUrl: string | null | undefined };

  interface Props {
    episodes: EpisodeWithThumb[];
    currentIndex: number;
    expanded: boolean;
    onSelect: (epId: string | number) => void;
    onExpandChange: (expanded: boolean) => void;
    onFocusedEpisodeChange: (ep: FlatEpisode | null) => void;
  }

  let {
    episodes,
    currentIndex,
    expanded,
    onSelect,
    onExpandChange,
    onFocusedEpisodeChange,
  }: Props = $props();

  let railViewportEl = $state<HTMLDivElement | null>(null);
  const itemElements = new Map<string, HTMLDivElement>();

  function registerNode(id: string, node: HTMLDivElement | null) {
    if (node) {
      itemElements.set(id, node);
    } else {
      itemElements.delete(id);
    }
  }

  function centerItem(ep: FlatEpisode) {
    const viewport = railViewportEl;
    const el = itemElements.get(String(ep.id));
    if (viewport && el) {
      const viewportRect = viewport.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollTarget = viewport.scrollLeft + (elRect.left - viewportRect.left) - (viewportRect.width - elRect.width) / 2;
      viewport.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
    onFocusedEpisodeChange(ep);
  }

  function onUpdateHasFocusedChild(hasFocusedChild: boolean) {
    onExpandChange(hasFocusedChild);
    if (!hasFocusedChild) onFocusedEpisodeChange(null);
  }

  $effect(() => {
    if (currentIndex < 0) return;
    const ep = episodes[currentIndex]?.ep;
    if (!ep) return;
    const viewport = railViewportEl;
    const el = itemElements.get(String(ep.id));
    if (viewport && el) {
      const viewportRect = viewport.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollTarget = viewport.scrollLeft + (elRect.left - viewportRect.left) - (viewportRect.width - elRect.width) / 2;
      viewport.scrollTo({ left: scrollTarget, behavior: 'auto' });
    }
  });

  const seasonCount = $derived(new Set(episodes.map((e) => e.ep.seasonNumber)).size);
</script>

<FocusContainer
  focusKey="episodes-rail"
  trackChildren={true}
  saveLastFocusedChild={true}
  preferredChildFocusKey={currentIndex >= 0 ? `rail-ep-item-${episodes[currentIndex]?.ep.id}` : undefined}
  {onUpdateHasFocusedChild}
  class="w-full transition-transform duration-300 {expanded ? 'mt-[clamp(0.5rem,1.8vh,1rem)]' : 'mt-[clamp(1rem,3.5vh,2rem)]'}"
>
  <div
    bind:this={railViewportEl}
    class="w-full relative flex gap-[clamp(0.625rem,1.5vw,0.875rem)] overflow-x-auto p-[clamp(0.5rem,1.4vw,0.75rem)] snap-x snap-proximity hide-scrollbar scroll-smooth"
    style="scroll-padding-inline: clamp(2rem, 4vw, 3rem);"
  >
    {#each episodes as item, index (item.ep.id)}
      <RailEpisodeItem
        episode={item.ep}
        {index}
        isActive={index === currentIndex}
        {expanded}
        showSeasonEyebrow={seasonCount > 1}
        thumbUrl={item.thumbUrl}
        {onSelect}
        onCenter={centerItem}
        {registerNode}
      />
    {/each}
  </div>
</FocusContainer>
