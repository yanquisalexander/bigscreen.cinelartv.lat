<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
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
    onImmersiveChange?: (immersive: boolean) => void;
    onUpdateHasFocusedChild?: (focused: boolean) => void;
  }

  let {
    items,
    onInfo,
    clientEndpoint,
    firstRowFocusKey,
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
    if (focused && heroEl) {
      heroEl.scrollIntoView({ behavior: canAnimate ? 'smooth' : 'auto', block: 'start' });
    }
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
    {onUpdateHasFocusedChild}
  >
    <!-- Slot: reserva el espacio base en el flujo; SIEMPRE altura fija, nunca cambia -->
    <div
      bind:this={heroEl}
      class="relative w-full bg-black"
      style="height: {baseHeight}px;"
    >
      <!-- Backdrop: siempre cubre el viewport a pantalla completa; se revela al desvanecerse el telon -->
      <div class="absolute inset-x-0 top-0 h-[100dvh] overflow-hidden pointer-events-none">
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

        <!-- Layer 3: Contrast gradients -->
        <div
          class="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent pointer-events-none transition-opacity duration-700 z-20 {showTrailer ? 'opacity-20' : 'opacity-100'}"
        ></div>
        <div
          class="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent pointer-events-none transition-opacity duration-700 z-20 {showTrailer ? 'opacity-30' : 'opacity-100'}"
        ></div>

        <!-- Gradient overlay -->
        <div
          class="absolute inset-0 pointer-events-none z-10 transition-opacity duration-700 {showTrailer ? 'opacity-0' : 'opacity-100'}"
          style="background: linear-gradient(to bottom, transparent 70%, rgb(var(--color-bg)) 100%);"
        ></div>
      </div>

      <!-- Content: anclado al hero base; baja al fondo con transform (GPU) al expandir -->
      <div
        class="absolute bottom-[clamp(2.5rem,7vh,4.5rem)] left-[clamp(2.5rem,5vw,5rem)] max-w-[clamp(26rem,42vw,36rem)] z-30 flex flex-col items-start text-left transition-transform duration-700 ease-in-out will-change-transform"
        style="transform: translateY({showTrailer ? expandOffset : 0}px);"
      >
          <!-- Metadata -->
          <div class="flex items-center gap-3 mb-3 text-xs font-semibold text-text-secondary">
            {#if currentItem.year}
              <span class="px-2 py-0.5 rounded bg-black/40 text-white">
                {currentItem.year}
              </span>
            {/if}
            {#if currentItem.duration}
              <span>{currentItem.duration} min</span>
            {/if}
            <span class="border border-white/30 px-1.5 py-0.2 rounded text-[10px] text-white">
              HD
            </span>
          </div>

          <!-- Logo or Title -->
          {#if currentLogoUrl}
            <img
              src={currentLogoUrl}
              alt={currentItem.title}
              class="h-[clamp(3.5rem,8vh,5.5rem)] max-w-[85%] object-contain object-left mb-3"
            />
          {:else}
            <h1 class="text-[clamp(2rem,3.2vw,2.8rem)] font-black text-white leading-tight mb-3 tracking-tight text-left">
              {currentItem.title}
            </h1>
          {/if}

          <!-- Description -->
          <div
            class="transition-all duration-700 ease-in-out overflow-hidden w-full {showTrailer ? 'max-h-0 opacity-0 mb-0' : 'max-h-36 opacity-100 mb-6'}"
          >
            {#if currentItem.description}
              <p class="text-[clamp(0.95rem,1.2vw,1.05rem)] text-gray-300 line-clamp-3 leading-relaxed font-normal text-left">
                {currentItem.description}
              </p>
            {/if}
          </div>

          <!-- Action Button -->
          <div class="flex items-center gap-4">
            <Focusable
              onEnterPress={() => onInfo(currentItem)}
              onArrowPress={(direction) => {
                if (direction === 'left') {
                  goTo(currentIndex - 1);
                  return false;
                }
                if (direction === 'right') {
                  goTo(currentIndex + 1);
                  return false;
                }
                if (direction === 'down') {
                  if (firstRowFocusKey) {
                    setFocus(firstRowFocusKey);
                    return false;
                  }
                }
                if (direction === 'up') {
                  setFocus('topnav');
                  return false;
                }
                return true;
              }}
              autoFocus={true}
              focusKey="hero-view-more"
              focusedClass="scale-105 !bg-white !text-black ring-4 ring-white/50"
              class="px-7 py-3 bg-white text-black text-sm font-bold rounded-xl transition-all duration-200 border border-white/20 cursor-pointer"
              playSound={true}
            >
              {#snippet children()}
                Ver detalles
              {/snippet}
            </Focusable>
          </div>
        </div>

        <!-- Layer 5: Pagination indicators -->
        {#if items.length > 1}
          <div
            class="absolute bottom-6 right-[clamp(2.5rem,5vw,5rem)] flex items-center gap-2 z-30 transition-opacity duration-500 {showTrailer ? 'opacity-20' : 'opacity-100'}"
            style="transform: translateY({showTrailer ? expandOffset : 0}px); transition: transform 500ms ease, opacity 500ms ease;"
          >
            {#each items as _, i (i)}
              <div
                class="h-1.5 rounded-full transition-all duration-500 {i === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}"
              ></div>
            {/each}
          </div>
        {/if}
    </div>
  </FocusContainer>
{/if}