<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import { Monitor, Volume2, Check, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, ShieldOff } from '@lucide/svelte';
  import { svelteSettingsStore } from '@/stores/settingsStore';
  import { untrack } from 'svelte';

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

  interface DrmInfo {
    widevine: 'L1' | 'L2' | 'L3' | 'unknown' | 'unsupported';
    playready: boolean;
    fairplay: boolean;
    primary: 'widevine' | 'playready' | 'fairplay' | 'none';
  }

  interface EngineLike {
    getVariantTracksInfo(): QualityInfo | null;
    getAudioTracksInfo(): AudioInfo[] | null;
    selectQuality(option: number | 'auto'): void;
    selectAudioTrack(language: string, role?: string, index?: number): void;
    onTracksChanged?: (fn: () => void) => void;
    getProfile(): { drm?: DrmInfo } | null;
  }

  type SettingsCategory = 'quality' | 'audio' | 'protection';

  interface Props {
    engine: EngineLike | null;
    open: boolean;
    category: SettingsCategory | null;
    onCategoryChange?: (category: SettingsCategory | null) => void;
  }

  let { engine, open, category, onCategoryChange }: Props = $props();

  let quality = $state<QualityInfo | null>(null);
  let audio = $state<AudioInfo[] | null>(null);
  let drm = $state<DrmInfo | null>(null);
  let panelBodyEl = $state<HTMLDivElement | null>(null);
  let lastCategory = $state<SettingsCategory | null>(null);
  const debugMode = $derived($svelteSettingsStore.debugMode);
  let _scrollObserver: MutationObserver | null = null;

  const formatGbPerHour = (bps: number): string => {
    const gb = (bps * 3600) / (8 * 1024 * 1024 * 1024);
    if (gb < 0.01) return '<0.01 GB/h';
    return `${gb.toFixed(2)} GB/h`;
  };

  const getQualityLabel = (height: number): string => {
    if (height >= 1080) return 'Excelente';
    if (height >= 720) return 'Buena';
    if (height >= 480) return 'Óptima';
    return 'Básica';
  };

  function refresh() {
    if (!engine) return;
    quality = engine.getVariantTracksInfo();
    audio = engine.getAudioTracksInfo();
    drm = engine.getProfile()?.drm ?? null;
  }

  const hasQuality = $derived(Boolean(quality && quality.tracks.length > 0));
  const hasAudio = $derived(Boolean(audio && audio.length > 0));

  const qualityValue = $derived.by(() => {
    if (!quality) return 'No disponible';
    if (quality.auto) return quality.activeHeight ? `Automática (${quality.activeHeight}p)` : 'Automática';
    return quality.activeHeight ? `${quality.activeHeight}p` : 'Manual';
  });

  const audioValue = $derived.by(() => {
    const active = audio?.find((a) => a.active);
    if (active) return active.label;
    return hasAudio ? 'Seleccionar' : 'No disponible';
  });

  const protectionValue = $derived.by(() => {
    if (!drm) return 'Detectando…';
    return drm.primary !== 'none' ? drm.primary : drm.widevine !== 'unsupported' ? drm.widevine : 'Sin DRM';
  });

  const categoryTitle = $derived(
    category === 'quality' ? 'Calidad' : category === 'audio' ? 'Audio' : 'Protección',
  );

  const firstEnabledCategoryKey = $derived(
    hasQuality
      ? 'player-settings-category-quality'
      : hasAudio
        ? 'player-settings-category-audio'
        : debugMode
          ? 'player-settings-category-protection'
          : null,
  );

  // Foco inicial al abrir y al cambiar de nivel (sin re-enfocar por cambios
  // de tracks, que solo actualizan los valores visibles).
  const focusTarget = $derived.by(() => {
    if (!category) return `player-settings-category-${lastCategory ?? 'quality'}`;
    if (category === 'quality') {
      return quality?.auto
        ? 'player-settings-quality-auto'
        : quality?.activeHeight
          ? `player-settings-quality-${quality.activeHeight}`
          : 'player-settings-quality-auto';
    }
    if (category === 'audio') {
      const activeIndex = audio?.findIndex((a) => a.active) ?? -1;
      return `player-settings-audio-${activeIndex >= 0 ? activeIndex : 0}`;
    }
    return 'player-settings-back';
  });

  function scrollToFocused() {
    const container = panelBodyEl;
    if (!container) return;
    if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
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
      if (tryScroll()) { observer.disconnect(); _scrollObserver = null; }
    });
    _scrollObserver = observer;
    observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });
    setTimeout(() => { observer.disconnect(); _scrollObserver = null; }, 1000);
  }

  function selectCategory(next: SettingsCategory | null) {
    onCategoryChange?.(next);
  }

  function goBack() {
    onCategoryChange?.(null);
  }

  $effect(() => {
    if (open) {
      refresh();
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
    if (category) lastCategory = category;
  });

  $effect(() => {
    void open;
    void category;
    if (!open) return;
    const target = untrack(() => focusTarget);
    const fallback = untrack(() => firstEnabledCategoryKey);
    setTimeout(() => {
      const key = target && doesFocusableExist(target) ? target : fallback;
      if (key && doesFocusableExist(key)) setFocus(key);
      scrollToFocused();
    }, 50);
  });

  const rowClass =
    'settings-row flex items-center gap-4 w-full p-4 my-1.5 rounded-2xl cursor-pointer transition-colors duration-150 text-white bg-white/[0.07]';
  const rowFocusedClass = '!bg-white !text-black';

  function categoryArrows(next: SettingsCategory) {
    return (direction: string) => {
      if (direction === 'right') {
        selectCategory(next);
        return false;
      }
      if (direction === 'left') return false;
      return true;
    };
  }

  function backArrows() {
    return (direction: string) => {
      if (direction === 'left') {
        goBack();
        return false;
      }
      return true;
    };
  }
</script>

{#if open}
  <aside class="settings-dock animate-panel-in" data-settings-panel>
    <div class="settings-header">
      <h2>Configuración</h2>
    </div>

    <FocusContainer
      focusKey="player-settings"
      focusable={false}
      isFocusBoundary={true}
      trackChildren={true}
      class="flex-1 overflow-y-auto px-4 pb-6"
    >
      <div bind:this={panelBodyEl} class="settings-list">
        {#if !category}
          <!-- ── Nivel 1: categorías ─────────────────────────────────── -->
          {#if hasQuality}
            <Focusable
              focusKey="player-settings-category-quality"
              focusedClass={rowFocusedClass}
              class={rowClass}
              onEnterPress={() => selectCategory('quality')}
              onArrowPress={categoryArrows('quality')}
              playSound={true}
            >
              {#snippet children()}
                <span class="opacity-60 shrink-0"><Monitor class="w-6 h-6" /></span>
                <span class="flex-1 min-w-0 text-left">
                  <span class="block text-[1.125rem] font-semibold leading-tight">Calidad</span>
                  <span class="block text-[0.875rem] opacity-65 tabular-nums">{qualityValue}</span>
                </span>
                <span class="opacity-50 shrink-0"><ChevronRight class="w-5 h-5" /></span>
              {/snippet}
            </Focusable>
          {:else}
            <div class="{rowClass} opacity-40 pointer-events-none">
              <span class="opacity-60 shrink-0"><Monitor class="w-6 h-6" /></span>
              <span class="flex-1 min-w-0 text-left">
                <span class="block text-[1.125rem] font-semibold leading-tight">Calidad</span>
                <span class="block text-[0.875rem] opacity-65">No disponible</span>
              </span>
            </div>
          {/if}

          {#if hasAudio}
            <Focusable
              focusKey="player-settings-category-audio"
              focusedClass={rowFocusedClass}
              class={rowClass}
              onEnterPress={() => selectCategory('audio')}
              onArrowPress={categoryArrows('audio')}
              playSound={true}
            >
              {#snippet children()}
                <span class="opacity-60 shrink-0"><Volume2 class="w-6 h-6" /></span>
                <span class="flex-1 min-w-0 text-left">
                  <span class="block text-[1.125rem] font-semibold leading-tight">Audio</span>
                  <span class="block text-[0.875rem] opacity-65">{audioValue}</span>
                </span>
                <span class="opacity-50 shrink-0"><ChevronRight class="w-5 h-5" /></span>
              {/snippet}
            </Focusable>
          {:else}
            <div class="{rowClass} opacity-40 pointer-events-none">
              <span class="opacity-60 shrink-0"><Volume2 class="w-6 h-6" /></span>
              <span class="flex-1 min-w-0 text-left">
                <span class="block text-[1.125rem] font-semibold leading-tight">Audio</span>
                <span class="block text-[0.875rem] opacity-65">No disponible</span>
              </span>
            </div>
          {/if}

          {#if debugMode}
            <Focusable
              focusKey="player-settings-category-protection"
              focusedClass={rowFocusedClass}
              class={rowClass}
              onEnterPress={() => selectCategory('protection')}
              onArrowPress={categoryArrows('protection')}
              playSound={true}
            >
              {#snippet children()}
                <span class="opacity-60 shrink-0"><ShieldCheck class="w-6 h-6" /></span>
                <span class="flex-1 min-w-0 text-left">
                  <span class="block text-[1.125rem] font-semibold leading-tight">Protección</span>
                  <span class="block text-[0.875rem] opacity-65 uppercase">{protectionValue}</span>
                </span>
                <span class="opacity-50 shrink-0"><ChevronRight class="w-5 h-5" /></span>
              {/snippet}
            </Focusable>
          {/if}
        {:else}
          <!-- ── Nivel 2: opciones de la categoría ───────────────────── -->
          <Focusable
            focusKey="player-settings-back"
            focusedClass={rowFocusedClass}
            class={rowClass}
            onEnterPress={goBack}
            onArrowPress={backArrows()}
            playSound={true}
          >
            {#snippet children()}
              <span class="opacity-60 shrink-0"><ChevronLeft class="w-6 h-6" /></span>
              <span class="flex-1 min-w-0 text-left text-[1.125rem] font-semibold">{categoryTitle}</span>
            {/snippet}
          </Focusable>

          {#if category === 'quality' && quality}
            <Focusable
              focusKey="player-settings-quality-auto"
              focusedClass={rowFocusedClass}
              class={rowClass}
              onEnterPress={() => {
                engine?.selectQuality('auto');
                refresh();
              }}
              onFocus={scrollToFocused}
              onArrowPress={backArrows()}
              playSound={true}
            >
              {#snippet children()}
                <span class="opacity-60 shrink-0"><Monitor class="w-6 h-6" /></span>
                <span class="flex-1 min-w-0 text-left">
                  <span class="block text-[1.125rem] font-semibold leading-tight">Automática</span>
                  {#if quality.auto && quality.activeHeight}
                    {@const activeTrack = quality.tracks.find((t) => t.height === quality.activeHeight)}
                    {#if activeTrack}
                      <span class="block text-[0.875rem] opacity-65 tabular-nums">{getQualityLabel(activeTrack.height)}</span>
                    {/if}
                  {/if}
                </span>
                {#if quality.auto}
                  <Check class="w-5 h-5 shrink-0" />
                {/if}
              {/snippet}
            </Focusable>

            {#each quality.tracks as t (t.height)}
              <Focusable
                focusKey={`player-settings-quality-${t.height}`}
                focusedClass={rowFocusedClass}
                class={rowClass}
                onEnterPress={() => {
                  engine?.selectQuality(t.height);
                  refresh();
                }}
                onFocus={scrollToFocused}
                onArrowPress={backArrows()}
                playSound={true}
              >
                {#snippet children()}
                  <span class="opacity-60 shrink-0"><Monitor class="w-6 h-6" /></span>
                  <span class="flex-1 min-w-0 text-left">
                    <span class="block text-[1.125rem] font-semibold leading-tight">{getQualityLabel(t.height)}</span>
                    <span class="block text-[0.875rem] opacity-65 tabular-nums">~{formatGbPerHour(t.bandwidth)}</span>
                  </span>
                  {#if quality.activeHeight === t.height && !quality.auto}
                    <Check class="w-5 h-5 shrink-0" />
                  {/if}
                {/snippet}
              </Focusable>
            {/each}
          {:else if category === 'audio' && audio}
            {#each audio as a, ai (`${a.language}-${a.role}-${ai}`)}
              <Focusable
                focusKey={`player-settings-audio-${ai}`}
                focusedClass={rowFocusedClass}
                class={rowClass}
                onEnterPress={() => {
                  engine?.selectAudioTrack(a.language, a.role || undefined, ai);
                  refresh();
                }}
                onFocus={scrollToFocused}
                onArrowPress={backArrows()}
                playSound={true}
              >
                {#snippet children()}
                  <span class="opacity-60 shrink-0"><Volume2 class="w-6 h-6" /></span>
                  <span class="flex-1 min-w-0 text-left text-[1.125rem] font-semibold">{a.label}</span>
                  {#if a.active}
                    <Check class="w-5 h-5 shrink-0" />
                  {/if}
                {/snippet}
              </Focusable>
            {/each}
          {:else if category === 'protection'}
            <div class="settings-info">
              <div class="settings-info-row">
                <span class="flex items-center gap-3">
                  {#if drm?.widevine === 'L1'}
                    <ShieldCheck class="w-5 h-5 text-[#4ade80]" />
                  {:else if drm?.widevine === 'L3'}
                    <ShieldAlert class="w-5 h-5 text-[#fbbf24]" />
                  {:else}
                    <ShieldOff class="w-5 h-5 text-[#6b7280]" />
                  {/if}
                  <span class="text-white/80 text-[1rem]">Widevine</span>
                </span>
                <span class="text-[0.875rem] font-mono {drm?.widevine === 'L1' ? 'text-[#4ade80]' : drm?.widevine === 'L3' ? 'text-[#fbbf24]' : 'text-[#6b7280]'}">
                  {drm?.widevine === 'unsupported' ? 'No soportado' : (drm?.widevine ?? '—')}
                </span>
              </div>
              <div class="settings-info-row">
                <span class="flex items-center gap-3">
                  {#if drm?.playready}
                    <ShieldCheck class="w-5 h-5 text-[#4ade80]" />
                  {:else}
                    <ShieldOff class="w-5 h-5 text-[#6b7280]" />
                  {/if}
                  <span class="text-white/80 text-[1rem]">PlayReady</span>
                </span>
                <span class="text-[0.875rem] font-mono {drm?.playready ? 'text-[#4ade80]' : 'text-[#6b7280]'}">
                  {drm?.playready ? 'Disponible' : 'No soportado'}
                </span>
              </div>
              <div class="settings-info-row">
                <span class="flex items-center gap-3">
                  {#if drm?.fairplay}
                    <ShieldCheck class="w-5 h-5 text-[#4ade80]" />
                  {:else}
                    <ShieldOff class="w-5 h-5 text-[#6b7280]" />
                  {/if}
                  <span class="text-white/80 text-[1rem]">FairPlay</span>
                </span>
                <span class="text-[0.875rem] font-mono {drm?.fairplay ? 'text-[#4ade80]' : 'text-[#6b7280]'}">
                  {drm?.fairplay ? 'Disponible' : 'No soportado'}
                </span>
              </div>
              {#if drm?.primary && drm.primary !== 'none'}
                <div class="settings-info-row settings-info-row--last">
                  <span class="text-white/50 text-[0.875rem]">Activo</span>
                  <span class="text-white/70 text-[0.875rem] font-mono uppercase">
                    {drm.primary}{drm.primary === 'widevine' && drm.widevine !== 'unsupported' ? ` · ${drm.widevine}` : ''}
                  </span>
                </div>
              {:else if !drm}
                <p class="text-white/40 text-[0.875rem] text-center py-2">Detectando…</p>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </FocusContainer>
  </aside>
{/if}

<style>
  .settings-dock {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: clamp(24rem, 32vw, 32rem);
    /* Mismo fondo que el home y que el área del video achicado: sin
       bordes ni sombras que separen el dock del resto. */
    background: var(--color-bg);
    z-index: 50;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .settings-header {
    padding: 1.5rem 1.5rem 1rem;
    flex-shrink: 0;
  }

  .settings-header h2 {
    margin: 0;
    color: #ffffff;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .settings-list {
    display: flex;
    flex-direction: column;
  }

  .settings-info {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.04);
  }

  .settings-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
  }

  .settings-info-row--last {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
</style>
