<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { Monitor, Volume2, Check } from '@lucide/svelte';

  interface QualityInfo {
    auto: boolean;
    activeHeight: number | null;
    tracks: { height: number; bandwidth: number; active: boolean }[];
  }

  interface AudioInfo {
    language: string;
    role: string;
    label: string;
    active: boolean;
  }

  interface EngineLike {
    getVariantTracksInfo(): QualityInfo | null;
    getAudioTracksInfo(): AudioInfo[] | null;
    selectQuality(option: number | 'auto'): void;
    selectAudioTrack(language: string, role?: string, index?: number): void;
    onTracksChanged?: (fn: () => void) => () => void;
  }

  interface Props {
    engine: EngineLike | null;
    open: boolean;
  }

  let { engine, open }: Props = $props();

  let quality = $state<QualityInfo | null>(null);
  let audio = $state<AudioInfo[] | null>(null);
  let panelBodyEl = $state<HTMLDivElement | null>(null);
  let didFocus = false;

  function refresh() {
    if (!engine) return;
    quality = engine.getVariantTracksInfo();
    audio = engine.getAudioTracksInfo();
  }

  function sanitize(s: string): string {
    return (s || 'und').replace(/[^a-z0-9]/gi, '');
  }

  function scrollToFocused() {
    const container = panelBodyEl;
    if (!container) return;
    const tryScroll = () => {
      const focused = container.querySelector('[data-focused="true"]') as HTMLElement | null;
      if (focused) {
        focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };
    if (tryScroll()) return;
    const observer = new MutationObserver(() => {
      if (tryScroll()) observer.disconnect();
    });
    observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });
    setTimeout(() => observer.disconnect(), 1000);
  }

  $effect(() => {
    if (open) {
      refresh();
      didFocus = false;
    }
  });

  $effect(() => {
    if (!open || !engine?.onTracksChanged) return;
    const unsubscribe = engine.onTracksChanged(refresh);
    return () => {
      unsubscribe?.();
    };
  });

  $effect(() => {
    if (!open || didFocus) return;
    const activeKey = quality
      ? quality.auto
        ? 'player-settings-quality-auto'
        : quality.activeHeight
          ? `player-settings-quality-${quality.activeHeight}`
          : 'player-settings-quality-auto'
      : audio && audio.length
        ? `player-settings-audio-0`
        : null;
    if (!activeKey) return;
    didFocus = true;
    setTimeout(() => {
      setFocus(activeKey);
      scrollToFocused();
    }, 50);
  });
</script>

{#if open}
  <div
    class="absolute top-[clamp(4.5rem,9vh,6rem)] right-[clamp(2rem,4vw,3rem)] w-[clamp(280px,25vw,400px)] max-h-[70vh] bg-[#1c1c1e] rounded-[clamp(1rem,2vw,1.5rem)] shadow-2xl z-50 flex flex-col overflow-hidden"
  >
    <h2 class="shrink-0 px-4 pt-4 pb-2 text-white text-[clamp(1rem,1.5vw,1.25rem)] font-semibold border-b border-white/10">
      Configuración
    </h2>

    <FocusContainer
      focusKey="player-settings"
      focusable={false}
      isFocusBoundary={true}
      trackChildren={true}
      class="flex-1 overflow-y-auto p-4"
    >
      <div bind:this={panelBodyEl}>
        <div class="text-[#8e8e93] text-[clamp(0.7rem,1vw,0.85rem)] font-bold uppercase tracking-wider mb-2 px-2">
          Calidad
        </div>

        {#if quality}
          <Focusable
            focusKey="player-settings-quality-auto"
            onEnterPress={() => {
              engine?.selectQuality('auto');
              refresh();
            }}
            onFocus={scrollToFocused}
            focusedClass="bg-white/10 scale-105"
            class="flex items-center justify-between p-3 my-1 rounded-xl cursor-pointer transition-all duration-200"
            playSound={true}
          >
            {#snippet children()}
              <div class="flex items-center gap-4 text-white">
                <div class="text-[#8e8e93]">
                  <Monitor class="w-5 h-5" />
                </div>
                <span class="text-[clamp(0.85rem,1.1vw,1rem)] font-medium">Auto</span>
              </div>
              {#if quality && quality.auto}
                <Check class="w-4 h-4 text-white" />
              {/if}
            {/snippet}
          </Focusable>

          {#each quality.tracks as t (t.height)}
            <Focusable
              focusKey={`player-settings-quality-${t.height}`}
              onEnterPress={() => {
                engine?.selectQuality(t.height);
                refresh();
              }}
              onFocus={scrollToFocused}
              focusedClass="bg-white/10 scale-105"
              class="flex items-center justify-between p-3 my-1 rounded-xl cursor-pointer transition-all duration-200"
              playSound={true}
            >
              {#snippet children()}
                <div class="flex items-center gap-4 text-white">
                  <div class="text-[#8e8e93]">
                    <Monitor class="w-5 h-5" />
                  </div>
                  <span class="text-[clamp(0.85rem,1.1vw,1rem)] font-medium">{t.height}p</span>
                </div>
                {#if quality && quality.activeHeight === t.height && !quality.auto}
                  <Check class="w-4 h-4 text-white" />
                {/if}
              {/snippet}
            </Focusable>
          {/each}
        {:else}
          <div class="px-4 py-2 text-[#8e8e93] text-sm">Sin opciones de calidad</div>
        {/if}

        <div class="text-[#8e8e93] text-[clamp(0.7rem,1vw,0.85rem)] font-bold uppercase tracking-wider mb-2 px-2 mt-4">
          Audio
        </div>

        {#if audio && audio.length > 0}
          {#each audio as a, ai (`${a.language}-${a.role}-${ai}`)}
            <Focusable
              focusKey={`player-settings-audio-${ai}`}
              onEnterPress={() => {
                engine?.selectAudioTrack(a.language, a.role || undefined, ai);
                refresh();
              }}
              onFocus={scrollToFocused}
              focusedClass="bg-white/10 scale-105"
              class="flex items-center justify-between p-3 my-1 rounded-xl cursor-pointer transition-all duration-200"
              playSound={true}
            >
              {#snippet children()}
                <div class="flex items-center gap-4 text-white">
                  <div class="text-[#8e8e93]">
                    <Volume2 class="w-5 h-5" />
                  </div>
                  <span class="text-[clamp(0.85rem,1.1vw,1rem)] font-medium">{a.label}</span>
                </div>
                {#if a.active}
                  <Check class="w-4 h-4 text-white" />
                {/if}
              {/snippet}
            </Focusable>
          {/each}
        {:else}
          <div class="px-4 py-2 text-[#8e8e93] text-sm">Sin pistas de audio</div>
        {/if}
      </div>
    </FocusContainer>
  </div>
{/if}
