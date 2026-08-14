<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { svelteConfigStore } from '@/stores/configStore';
  import { resolvePoster } from '@/utils/helpers';
  import type { ContentItem } from '@/types/content';
  import { isTVShow } from '@/types/content';

  interface Props {
    items: ContentItem[];
    onSelect: (item: ContentItem) => void;
    focusKey?: string;
    onArrowUp?: (direction: string) => boolean;
  }

  let {
    items,
    onSelect,
    focusKey = 'detail-related',
    onArrowUp,
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

{#if items.length > 0}
  <FocusContainer
    {focusKey}
    trackChildren={true}
    saveLastFocusedChild={true}
  >
    <div
      bind:this={scrollEl}
      class="flex gap-[clamp(0.75rem,1.5vw,1.25rem)] overflow-x-auto hide-scrollbar py-[clamp(0.5rem,1vh,0.75rem)]"
    >
      {#each items as item (item.id)}
        {@const clientEndpoint = $svelteConfigStore.config.CLIENT_ENDPOINT}
        {@const coverUrl = resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint)}
        {@const isPremium = Boolean((item as any).premium)}

        <Focusable
          focusKey="detail-related-{item.id}"
          onEnterPress={() => onSelect(item)}
          onArrowPress={(dir) => {
            if (dir === 'up' && onArrowUp) return onArrowUp(dir);
            return true;
          }}
          focusedClass="ring-2 ring-white/90 z-10 scale-[1.03]"
          class="tv-no-select shrink-0 cursor-pointer w-[clamp(10rem,14vw,13rem)] rounded-xl overflow-hidden transition-all duration-200 ease-out"
          playSound={true}
        >
          {#snippet children()}
            <div class="relative aspect-[2/3] bg-surface overflow-hidden">
              {#if coverUrl}
                <img
                  src={coverUrl}
                  alt={item.title}
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center bg-surface-elevated">
                  <span class="text-white/15 text-2xl font-bold">
                    {item.title.charAt(0)}
                  </span>
                </div>
              {/if}

              <!-- Gradient overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"></div>

              <!-- Premium badge -->
              {#if isPremium}
                <div class="absolute top-[clamp(0.375rem,0.8vh,0.5rem)] right-[clamp(0.375rem,0.8vw,0.5rem)]">
                  <span class="bg-amber-500/90 text-black text-[clamp(0.5rem,0.7vw,0.625rem)] font-bold px-[clamp(0.25rem,0.5vw,0.375rem)] py-[clamp(0.0625rem,0.15vh,0.125rem)] rounded">
                    PREMIUM
                  </span>
                </div>
              {/if}

              <!-- Info -->
              <div class="absolute bottom-0 left-0 right-0 p-[clamp(0.625rem,1.2vh,0.875rem)]">
                <p class="text-white text-[clamp(0.8125rem,1.1vw,0.9375rem)] font-semibold truncate leading-tight">
                  {item.title}
                </p>
                <div class="flex items-center gap-[clamp(0.25rem,0.5vw,0.375rem)] mt-[clamp(0.1875rem,0.4vh,0.3125rem)]">
                  {#if item.year}
                    <span class="text-white/50 text-[clamp(0.625rem,0.85vw,0.75rem)]">
                      {item.year}
                    </span>
                  {/if}
                  {#if item.content_type || item.contentType}
                    {#if item.year}
                      <span class="text-white/25 text-[clamp(0.5rem,0.7vw,0.625rem)]">·</span>
                    {/if}
                    <span class="text-white/50 text-[clamp(0.625rem,0.85vw,0.75rem)]">
                      {isTVShow(item) ? 'Serie' : 'Película'}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/snippet}
        </Focusable>
      {/each}
    </div>
  </FocusContainer>
{/if}
