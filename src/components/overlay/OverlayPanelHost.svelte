<script lang="ts">
  import { overlayPanelStore, svelteOverlayPanelStore, type PanelConfig, type PanelItem } from '@/stores/overlayPanelStore';
  import { closePanel, backPanel } from '@/services/overlayPanel';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { isBackKey } from '@/utils/helpers';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import {
    Info,
    Settings,
    Play,
    Volume2,
    Shield,
    Palette,
    RotateCcw,
    LogIn,
    User,
    Tv,
    Star,
    Search,
    Check,
    X,
    ChevronRight,
    Download,
    RefreshCw,
    MapPin,
  } from '@lucide/svelte';

  const ICON_MAP: Record<string, any> = {
    info: Info,
    settings: Settings,
    play: Play,
    volume: Volume2,
    shield: Shield,
    palette: Palette,
    rotate: RotateCcw,
    login: LogIn,
    user: User,
    tv: Tv,
    star: Star,
    search: Search,
    check: Check,
    x: X,
    chevronRight: ChevronRight,
    download: Download,
    refresh: RefreshCw,
    mapPin: MapPin,
  };

  let animState = $state<'in' | 'out' | 'hidden'>('hidden');
  let lastPanel = $state<PanelConfig | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);

  // Back key listener for overlays
  $effect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      if (!overlayPanelStore.getState().panel) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      backPanel();
    };

    window.addEventListener('keydown', handleBack, true);
    return () => {
      window.removeEventListener('keydown', handleBack, true);
    };
  });

  $effect(() => {
    const p = $svelteOverlayPanelStore.panel;
    if (p) {
      lastPanel = p;
      animState = 'in';
      if (p.items.length > 0) {
        setTimeout(() => {
          setFocus(`panel-item-${p.items[0].id}`);
        }, 50);
      }
    } else if (animState === 'in') {
      animState = 'out';
      const timer = setTimeout(() => {
        animState = 'hidden';
      }, 220);
      return () => clearTimeout(timer);
    }
  });

  function scrollItemIntoView(itemId: string) {
    const el = listEl?.querySelector<HTMLElement>(`[data-focus-key="panel-item-${itemId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }
</script>

{#if animState !== 'hidden' && lastPanel}
  <div
    class="fixed top-0 right-0 z-[9980] {animState === 'in' ? 'animate-panel-in' : 'animate-panel-out'}"
    style="top: 1.5rem; right: 1.5rem; bottom: 1.5rem; width: clamp(19rem, 26vw, 25.5rem);"
  >
    <FocusContainer
      focusKey="overlay-panel"
      trackChildren={true}
      saveLastFocusedChild={true}
      preferredChildFocusKey={lastPanel.items.length > 0 ? `panel-item-${lastPanel.items[0].id}` : undefined}
      class="w-full h-full flex flex-col bg-[#181818] rounded-[1.5rem] p-6 overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]"
    >
      <!-- header -->
      <div class="shrink-0 mb-6">
        {#if lastPanel.headerImageUrl}
          <img
            src={lastPanel.headerImageUrl}
            alt=""
            class="w-[clamp(3rem,6vw,4.5rem)] h-[clamp(3rem,6vw,4.5rem)] rounded-2xl object-cover mb-4"
          />
        {/if}
        <h2 class="text-white text-[clamp(1.375rem,2.4vw,1.75rem)] font-semibold leading-tight">
          {lastPanel.title}
        </h2>
        {#if lastPanel.subtitle}
          <p class="text-text-secondary text-[clamp(0.875rem,1.1vw,1rem)] mt-2 leading-snug">
            {lastPanel.subtitle}
          </p>
        {/if}
      </div>

      <!-- item list -->
      <div bind:this={listEl} class="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-2">
        {#each lastPanel.items as item, index (item.id)}
          {#if item.readOnly}
            <div class="px-4 py-3">
              <p class="text-white/85 text-[clamp(0.875rem,1.05vw,0.9375rem)] leading-snug">
                {item.title}
              </p>
              {#if item.subtitle}
                <p class="text-text-secondary text-[clamp(0.8125rem,0.95vw,0.875rem)] mt-1 leading-snug">
                  {item.subtitle}
                </p>
              {/if}
            </div>
          {:else}
            {@const IconComponent = item.icon ? ICON_MAP[item.icon] : null}
            <Focusable
              focusKey={`panel-item-${item.id}`}
              onEnterPress={() => {
                item.onSelect?.();
                if (item.closeOnSelect !== false) {
                  closePanel();
                }
              }}
              onFocus={() => scrollItemIntoView(item.id)}
              onArrowPress={(direction) => {
                if (direction === 'up' && index === 0) return false;
                if (direction === 'down' && index === lastPanel!.items.length - 1) return false;
                if (direction === 'left' || direction === 'right') return false;
                return true;
              }}
              focusedClass="bg-white/12 border-white/40"
              class="flex items-center gap-3 w-full rounded-xl border border-transparent px-4 py-3 cursor-pointer"
              playSound={true}
            >
              {#if item.imageUrl || IconComponent}
                <span class="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-surface flex-shrink-0">
                  {#if item.imageUrl}
                    <img
                      src={item.imageUrl}
                      alt=""
                      class="w-full h-full object-cover"
                      onerror={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  {:else if IconComponent}
                    <IconComponent class="w-5 h-5 text-white/70" />
                  {/if}
                </span>
              {/if}
              <div class="flex-1 min-w-0">
                <p class="text-white text-[clamp(0.9375rem,1.15vw,1.0625rem)] font-medium truncate">
                  {item.title}
                </p>
                {#if item.subtitle}
                  <p class="text-text-secondary text-[clamp(0.8125rem,0.95vw,0.875rem)] mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                {/if}
              </div>
            </Focusable>
          {/if}
        {/each}
      </div>
    </FocusContainer>
  </div>
{/if}
