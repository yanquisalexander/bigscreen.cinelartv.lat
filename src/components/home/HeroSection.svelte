<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { Play, Info } from '@lucide/svelte';
  import { resolveBackdrop, resolveLogo } from '@/utils/helpers';
  import { getRuntimeConfig } from '@/runtime';
  import type { ContentItem } from '@/types/content';
  import {$body as bodyEl} from "@/lib/dom-selector";

  interface Props {
    items: ContentItem[];
    onPlay?: (item: ContentItem) => void;
    onInfo: (item: ContentItem) => void;
    clientEndpoint: string;
    firstRowFocusKey?: string;
    focusable?: boolean;
    onImmersiveChange?: (immersive: boolean) => void;
    onUpdateHasFocusedChild?: (focused: boolean) => void;
  }

  let {
    items,
    onPlay,
    onInfo,
    clientEndpoint,
    firstRowFocusKey,
    focusable = true,
    onImmersiveChange,
    onUpdateHasFocusedChild: externalUpdateFocus,
  }: Props = $props();

  let currentIndex = $state(0);
  let showTrailer = $state(false);
  let prevBannerUrl = $state<string | null>(null);
  let hasFocusedChild = $state(false);
  let heroEl = $state<HTMLDivElement | null>(null);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let trailerTimerId: ReturnType<typeof setTimeout> | null = null;
  let canPlayVideo = $state(false);

  const currentItem = $derived(items[currentIndex]);
  const hasTrailer = $derived(Boolean(currentItem?.trailer_sources?.length));
  const trailerUrl = $derived(hasTrailer && currentItem.trailer_sources ? currentItem.trailer_sources[0].url : null);

  const currentBannerUrl = $derived.by(() => {
    if (!currentItem) return null;
    return resolveBackdrop(
      currentItem.images,
      currentItem.banner_resized ?? currentItem.banner ?? currentItem.cover_resized ?? currentItem.cover,
      clientEndpoint,
      backdropSize
    );
  });

  const currentLogoUrl = $derived.by(() => {
    if (!currentItem) return null;
    return resolveLogo(currentItem.images, clientEndpoint);
  });

  // ── Google TV / Prime Video metadata ─────────────────────────────────────
  const genreTags = $derived.by(() => {
    const raw = (currentItem as Record<string, unknown> | undefined)?.categories;
    if (Array.isArray(raw)) {
      return raw
        .slice(0, 3)
        .map((c) => (typeof c === 'object' && c !== null && 'name' in c ? String((c as { name: unknown }).name) : ''))
        .filter(Boolean);
    }
    return [] as string[];
  });

  const contentRating = $derived.by(() => {
    const r = (currentItem as Record<string, unknown> | undefined)?.content_rating;
    if (typeof r === 'object' && r !== null && 'code' in r) return String((r as { code: unknown }).code);
    const a = (currentItem as Record<string, unknown> | undefined)?.rating;
    if (typeof a === 'string' && a) return a;
    return null as string | null;
  });

  const durationLabel = $derived.by(() => {
    const d = currentItem?.duration;
    if (typeof d === 'number' && d > 0) {
      if (d >= 60) {
        const h = Math.floor(d / 60);
        const m = Math.round(d % 60);
        return m > 0 ? `${h} h ${m} min` : `${h} h`;
      }
      return `${d} min`;
    }
    const raw = currentItem as Record<string, unknown> | undefined;
    const seasons = typeof raw?.seasons_count === 'number' ? raw.seasons_count : null;
    if (seasons && seasons > 0) return seasons === 1 ? '1 temporada' : `${seasons} temporadas`;
    return null as string | null;
  });

  const typeLabel = $derived.by(() => {
    const t = currentItem?.content_type ?? currentItem?.contentType;
    if (t === 'TVSHOW') return 'Serie';
    if (t === 'MOVIE') return 'Película';
    if (typeof t === 'string' && t) return t;
    return null as string | null;
  });

  const isPremium = $derived(Boolean((currentItem as Record<string, unknown> | undefined)?.premium));

  // Badge del API: { badge_type, label, icon, color } — ej. "Actualizado recientemente" #37f1a3
  const heroBadge = $derived.by(() => {
    const b = (currentItem as Record<string, unknown> | undefined)?.content_badge;
    if (typeof b === 'object' && b !== null && 'label' in b) {
      const label = String((b as { label: unknown }).label ?? '');
      if (!label) return null;
      const rawColor = (b as { color?: unknown }).color;
      const color = typeof rawColor === 'string' && rawColor ? rawColor : null;
      return { label, color };
    }
    return null as { label: string; color: string | null } | null;
  });

  // Hay metadata previa al pill HD (para no dejar una "•" colgando como en Zootrópolis)
  const hasLeadingMeta = $derived(Boolean(currentItem?.year || durationLabel || contentRating));

  function handlePrimary() {
    if (!currentItem) return;
    (onPlay ?? onInfo)(currentItem);
  }

  function handleSecondary() {
    if (!currentItem) return;
    onInfo(currentItem);
  }

  function focusDown(): boolean {
    if (firstRowFocusKey) {
      setFocus(firstRowFocusKey);
      return false;
    }
    return true;
  }

  const { appQuality } = getRuntimeConfig();
  const canAnimate = appQuality !== 'LITE';
  const backdropSize = window.screen.width > 1280 ? 'xlarge' : 'large';

  let viewportH = $state(typeof window !== 'undefined' ? window.innerHeight : 0);
  const baseHeight = $derived(Math.max(420, Math.min(68 * (viewportH / 100), 660)));
  const expandOffset = $derived(Math.max(0, viewportH - baseHeight));

  $effect(() => {
    const update = () => { viewportH = window.innerHeight; };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });

  $effect(() => {
    if (currentBannerUrl) {
      const timer = setTimeout(() => {
        prevBannerUrl = currentBannerUrl;
      }, 700);
      return () => clearTimeout(timer);
    }
  });

  function goTo(index: number) {
    showTrailer = false;
    currentIndex = (index + items.length) % items.length;
  }

  function handleTrailerEnded() {
    showTrailer = false;
  }

  function onUpdateHasFocusedChild(focused: boolean) {
    hasFocusedChild = focused;
    externalUpdateFocus?.(focused);
  }

  // Auto-advance
  $effect(() => {
    if (items.length <= 1 || hasFocusedChild || showTrailer) {
      if (timerId) clearTimeout(timerId);
      return;
    }

    timerId = setTimeout(() => {
      currentIndex = (currentIndex + 1) % items.length;
    }, 8000);

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  });

  // Preload trailer during focus delay (before immersive mode)
  // This gives the browser time to buffer while user sees the banner
  $effect(() => {
    const video = videoEl;
    if (!video || !hasTrailer || !hasFocusedChild || showTrailer || !trailerUrl) return;

    if (video.getAttribute('src') !== trailerUrl) {
      video.src = trailerUrl;
      video.load();
    }
  });

  // Trailer trigger timer
  $effect(() => {
    // Reiniciar el timer al cambiar de item (incluso si ambos tienen trailer)
    const _ = trailerUrl;
    if (!hasTrailer || !hasFocusedChild) {
      showTrailer = false;
      return;
    }

    trailerTimerId = setTimeout(() => {
      showTrailer = true;
    }, 2500);

    return () => {
      if (trailerTimerId) clearTimeout(trailerTimerId);
    };
  });

  // Video play/pause + body class (SmartTV optimized: keep src cached)
  $effect(() => {
    const video = videoEl;
    if (!video) return;

    if (showTrailer) {
      bodyEl?.classList.add('playing-inmersive-trailer');
      canPlayVideo = false;
      // Only set src if URL actually changed to avoid redundant network request
      if (trailerUrl && video.getAttribute('src') !== trailerUrl) {
        video.src = trailerUrl;
        video.load();
      }
      video.currentTime = 0;
      // play() is called by the canPlay effect below
    } else {
      bodyEl?.classList.remove('playing-inmersive-trailer');
      video.pause();
      // SmartTV: keep src in memory for fast replay, only clean on unmount
    }

    return () => {
      bodyEl?.classList.remove('playing-inmersive-trailer');
      video.pause();
    };
  });

  // Play only when video is ready (critical for SmartTV slow decode)
  $effect(() => {
    const video = videoEl;
    if (!video || !showTrailer || !canPlayVideo) return;
    video.play().catch(() => {});
  });

  $effect(() => {
    onImmersiveChange?.(showTrailer);
  });
</script>

{#if currentItem}
  <FocusContainer
    focusKey="hero-section"
    preferredChildFocusKey="hero-view-more"
    trackChildren={true}
    saveLastFocusedChild={true}
    {focusable}
    {onUpdateHasFocusedChild}
  >
    <!-- Slot: reserva el espacio base en el flujo; SIEMPRE altura fija, nunca cambia -->
    <div
      bind:this={heroEl}
      class="relative w-full bg-black"
      style="height: {baseHeight}px;"
    >
      <!-- Backdrop: se extiende al fondo del viewport en immersive via bottom negativo (absoluto, sin reflow) -->
      <div
        class="absolute inset-x-0 top-0 overflow-hidden pointer-events-none bg-black"
        style="bottom: {showTrailer ? -expandOffset : 0}px;"
      >
        <!-- Layer 1: Background crossfade -->
        <div class="absolute inset-0" style="will-change: opacity;">
          {#if prevBannerUrl}
            <img
              src={prevBannerUrl}
              alt=""
              class="absolute inset-0 w-full h-full object-cover"
            />
          {/if}

          {#if currentBannerUrl}
            <img
              src={currentBannerUrl}
              alt={currentItem.title}
              class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out {showTrailer ? 'opacity-0' : 'opacity-100'}"
              loading="eager"
            />
          {/if}
        </div>

        <!-- Layer 2: Trailer video -->
        {#if hasTrailer}
          <div
            class="absolute inset-0 transition-opacity duration-1000 ease-in-out {showTrailer ? 'opacity-100 z-10' : 'opacity-0 z-0'}"
            style="will-change: opacity;"
          >
            <video
              bind:this={videoEl}
              class="w-full h-full object-cover"
              preload="auto"
              playsinline
              onended={handleTrailerEnded}
              oncanplay={() => { canPlayVideo = true; }}
            >
              <track kind="captions" />
            </video>
          </div>
        {/if}

        <!-- Layer 3: Contrast gradients (Google TV: lateral profundo + base + top sutil) -->
        <div
          class="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 via-40% to-transparent pointer-events-none transition-opacity duration-700 {showTrailer ? 'opacity-20' : 'opacity-100'}"
        ></div>
        <div
          class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent pointer-events-none transition-opacity duration-700 {showTrailer ? 'opacity-30' : 'opacity-100'}"
        ></div>
        <div
          class="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none transition-opacity duration-700 {showTrailer ? 'opacity-0' : 'opacity-100'}"
        ></div>

        <!-- Gradient overlay -->
        <div
          class="absolute inset-x-0 bottom-0 pointer-events-none transition-all duration-700 {showTrailer ? 'opacity-0' : 'opacity-100'}"
          style="height: 150px; background: linear-gradient(to bottom, transparent, rgb(var(--color-bg)));"
        ></div>
      </div>

      <!-- Content: anclado al hero base; baja al fondo con transform (GPU) al expandir -->
      <div
        class="absolute bottom-[clamp(2.5rem,7vh,4.5rem)] left-[clamp(2.5rem,5vw,5rem)] max-w-[clamp(28rem,44vw,38rem)] z-30 flex flex-col items-start text-left transition-transform duration-700 ease-in-out will-change-transform"
        style="transform: translateY({showTrailer ? expandOffset : 0}px);"
      >
        {#key currentItem.id}
          <div class="animate-fade-in flex flex-col items-start w-full">
            <!-- Eyebrow: badge del API si existe, si no "Destacado" -->
            <div class="flex items-center gap-2.5 mb-3 transition-opacity duration-700 {showTrailer ? 'opacity-0' : 'opacity-100'}">
              {#if heroBadge}
                <span
                  class="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 rounded-full border backdrop-blur-sm"
                  style="color: {heroBadge.color ?? '#fff'}; border-color: {heroBadge.color ?? 'rgba(255,255,255,0.25)'}; background: color-mix(in srgb, {heroBadge.color ?? '#fff'} 14%, transparent);"
                >
                  <span class="w-1.5 h-1.5 rounded-full" style="background: {heroBadge.color ?? '#fff'};"></span>
                  {heroBadge.label}
                </span>
              {:else}
                <span class="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.22em] uppercase text-white">
                  <span class="w-1.5 h-1.5 rounded-full bg-accent-light"></span>
                  Destacado
                </span>
              {/if}
              {#if typeLabel}
                <span class="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/40">
                  {typeLabel}
                </span>
              {/if}
              {#if isPremium}
                <span class="text-[10px] font-bold tracking-[0.14em] uppercase px-2 py-0.5 rounded bg-gold/15 text-gold border border-gold/30">
                  Premium
                </span>
              {/if}
            </div>

            <!-- Logo or Title -->
            {#if currentLogoUrl}
              <img
                src={currentLogoUrl}
                alt={currentItem.title}
                class="h-[clamp(3.5rem,8vh,5.5rem)] max-w-[80%] object-contain object-left mb-3 drop-shadow-2xl"
              />
            {:else}
              <h1 class="text-[clamp(2.2rem,3.6vw,3.2rem)] font-black text-white leading-[1.02] mb-3 tracking-[-0.02em] text-left drop-shadow-xl">
                {currentItem.title}
              </h1>
            {/if}

            <!-- Metadata rica: año • duración • rating • calidad • géneros -->
            <div class="flex items-center gap-2 mb-3 text-[clamp(0.8rem,1vw,0.9rem)] font-medium text-white/70 flex-wrap">
              {#if currentItem.year}
                <span class="text-white/90 font-semibold">{currentItem.year}</span>
              {/if}
              {#if durationLabel}
                {#if currentItem.year}<span class="text-white/25">•</span>{/if}
                <span>{durationLabel}</span>
              {/if}
              {#if contentRating}
                {#if currentItem.year || durationLabel}<span class="text-white/25">•</span>{/if}
                <span class="border border-white/30 px-1.5 py-px rounded text-[11px] font-bold text-white/90 leading-none">
                  {contentRating}
                </span>
              {/if}
              {#if hasLeadingMeta}<span class="text-white/25">•</span>{/if}
              <span class="border border-white/25 px-1.5 py-px rounded text-[11px] font-bold text-white/80 leading-none tracking-wide transition-opacity duration-700 {showTrailer ? 'opacity-0' : 'opacity-100'}">
                HD
              </span>
              {#if genreTags.length > 0}
                <span class="text-white/25">•</span>
                <span class="text-white/55">{genreTags.join(' • ')}</span>
              {/if}
            </div>

            <!-- Description -->
            <div
              class="transition-all duration-700 ease-in-out overflow-hidden w-full {showTrailer ? 'max-h-0 opacity-0 mb-0' : 'max-h-24 opacity-100 mb-6'}"
            >
              {#if currentItem.description}
                <p class="text-[clamp(0.9rem,1.15vw,1rem)] text-white/60 line-clamp-2 leading-relaxed font-normal text-left max-w-[clamp(24rem,36vw,32rem)]">
                  {currentItem.description}
                </p>
              {/if}
            </div>

            <!-- Doble CTA: Ver ahora (primario) + Más info (secundario) -->
            <div class="flex items-center gap-3">
              <Focusable
                onEnterPress={handlePrimary}
                onArrowPress={(direction) => {
                  if (direction === 'left') {
                    goTo(currentIndex - 1);
                    return false;
                  }
                  if (direction === 'right') {
                    setFocus('hero-more-info');
                    return false;
                  }
                  if (direction === 'down') return focusDown();
                  if (direction === 'up') {
                    setFocus('topnav');
                    return false;
                  }
                  return true;
                }}
                autoFocus={true}
                focusKey="hero-view-more"
                focusedClass="scale-105 ring-4 ring-white/60"
                class="h-[clamp(2.75rem,5vh,3.25rem)] px-[clamp(1.75rem,3vw,2.5rem)] inline-flex items-center gap-2.5 bg-white text-black text-[clamp(0.9rem,1.15vw,1rem)] font-bold rounded-full transition-all duration-200 cursor-pointer"
                playSound={true}
              >
                {#snippet children()}
                  <Play size={18} class="fill-current shrink-0" />
                  <span>Ver ahora</span>
                {/snippet}
              </Focusable>
              <Focusable
                onEnterPress={handleSecondary}
                onArrowPress={(direction) => {
                  if (direction === 'left') {
                    setFocus('hero-view-more');
                    return false;
                  }
                  if (direction === 'right') {
                    goTo(currentIndex + 1);
                    return false;
                  }
                  if (direction === 'down') return focusDown();
                  if (direction === 'up') {
                    setFocus('topnav');
                    return false;
                  }
                  return true;
                }}
                focusKey="hero-more-info"
                focusedClass="!bg-white !text-black scale-105 ring-4 ring-white/40"
                class="h-[clamp(2.75rem,5vh,3.25rem)] px-[clamp(1.5rem,2.5vw,2rem)] inline-flex items-center gap-2 bg-white/10 text-white text-[clamp(0.9rem,1.15vw,1rem)] font-semibold rounded-full transition-all duration-200 cursor-pointer backdrop-blur-sm border border-white/10"
                playSound={true}
              >
                {#snippet children()}
                  <Info size={18} class="shrink-0" />
                  <span>Más info</span>
                {/snippet}
              </Focusable>
            </div>
          </div>
        {/key}
        </div>

        <!-- Layer 5: Paginación estilo Google TV (píldoras + contador) -->
        {#if items.length > 1}
          <div
            class="absolute bottom-6 right-[clamp(2.5rem,5vw,5rem)] flex items-center gap-3 z-30 transition-opacity duration-500 {showTrailer ? 'opacity-20' : 'opacity-100'}"
            style="transform: translateY({showTrailer ? expandOffset : 0}px); transition: transform 500ms ease, opacity 500ms ease;"
          >
            <span class="text-[11px] font-semibold tracking-[0.14em] text-white/40 tabular-nums">
              {currentIndex + 1} / {items.length}
            </span>
            <div class="flex items-center gap-1.5">
              {#each items as _, i (i)}
                <div
                  class="h-1.5 rounded-full transition-all duration-500 {i === currentIndex ? 'w-7 bg-white' : 'w-1.5 bg-white/25'}"
                ></div>
              {/each}
            </div>
          </div>
        {/if}
    </div>
  </FocusContainer>
{/if}