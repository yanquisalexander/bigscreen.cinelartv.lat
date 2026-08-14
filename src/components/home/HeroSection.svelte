<script lang="ts">
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { resolveBackdrop, resolveLogo } from '@/utils/helpers';
  import type { ContentItem } from '@/types/content';

  interface Props {
    items: ContentItem[];
    onPlay?: (item: ContentItem) => void;
    onInfo: (item: ContentItem) => void;
    clientEndpoint: string;
    firstRowFocusKey?: string;
    sidebarFocusKey?: string;
    onImmersiveChange?: (immersive: boolean) => void;
  }

  let {
    items,
    onInfo,
    clientEndpoint,
    firstRowFocusKey,
    sidebarFocusKey,
    onImmersiveChange,
  }: Props = $props();

  let currentIndex = $state(0);
  let showTrailer = $state(false);
  let prevBannerUrl = $state<string | null>(null);
  let hasFocusedChild = $state(false);
  let heroEl = $state<HTMLDivElement | null>(null);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let trailerTimerId: ReturnType<typeof setTimeout> | null = null;

  const currentItem = $derived(items[currentIndex]);
  const hasTrailer = $derived(Boolean(currentItem?.trailer_sources?.length));
  const trailerUrl = $derived(hasTrailer && currentItem.trailer_sources ? currentItem.trailer_sources[0].url : null);

  const currentBannerUrl = $derived.by(() => {
    if (!currentItem) return null;
    return resolveBackdrop(
      currentItem.images,
      currentItem.banner_resized ?? currentItem.banner ?? currentItem.cover_resized ?? currentItem.cover,
      clientEndpoint,
      'xlarge'
    );
  });

  const currentLogoUrl = $derived.by(() => {
    if (!currentItem) return null;
    return resolveLogo(currentItem.images, clientEndpoint);
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

  function focusSidebarFromHero(direction: string) {
    if (direction !== 'left' || !sidebarFocusKey) return true;
    setFocus(sidebarFocusKey);
    return false;
  }

  function handleTrailerEnded() {
    showTrailer = false;
  }

  function onUpdateHasFocusedChild(focused: boolean) {
    hasFocusedChild = focused;
    if (focused && heroEl) {
      heroEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  // Trailer trigger timer
  $effect(() => {
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

  // Video play/pause
  $effect(() => {
    const video = videoEl;
    if (!video) return;

    if (showTrailer) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
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
    <div
      bind:this={heroEl}
      class="relative w-full overflow-hidden bg-black transition-[height] duration-700 ease-in-out {showTrailer ? 'h-[100dvh]' : 'h-[clamp(420px,68vh,660px)]'}"
    >
      <!-- Layer 1: Background crossfade -->
      <div class="absolute inset-0">
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
        >
          <video
            bind:this={videoEl}
            src={trailerUrl}
            class="w-full h-full object-cover"
            playsinline
            onended={handleTrailerEnded}
          ></video>
        </div>
      {/if}

      <!-- Layer 3: Contrast gradients -->
      <div
        class="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent pointer-events-none transition-opacity duration-700 z-20 {showTrailer ? 'opacity-20' : 'opacity-100'}"
      ></div>
      <div
        class="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/30 pointer-events-none transition-opacity duration-700 z-20 {showTrailer ? 'opacity-30' : 'opacity-100'}"
      ></div>

      <!-- Layer 4: Content -->
      <div class="absolute bottom-[clamp(2.5rem,7vh,4.5rem)] left-[clamp(2.5rem,5vw,5rem)] max-w-[clamp(26rem,42vw,36rem)] z-30 flex flex-col items-start text-left">
        <!-- Metadata -->
        <div class="flex items-center gap-3 mb-3 text-xs font-semibold text-text-secondary">
          {#if currentItem.year}
            <span class="px-2 py-0.5 rounded bg-white/10 text-white backdrop-blur-md">
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
            class="h-[clamp(3.5rem,8vh,5.5rem)] max-w-[85%] object-contain object-left mb-3 drop-shadow-2xl"
          />
        {:else}
          <h1 class="text-[clamp(2rem,3.2vw,2.8rem)] font-black text-white leading-tight mb-3 drop-shadow-lg tracking-tight text-left">
            {currentItem.title}
          </h1>
        {/if}

        <!-- Description -->
        <div
          class="transition-all duration-700 ease-in-out overflow-hidden w-full {showTrailer ? 'max-h-0 opacity-0 mb-0' : 'max-h-36 opacity-100 mb-6'}"
        >
          {#if currentItem.description}
            <p class="text-[clamp(0.95rem,1.2vw,1.05rem)] text-gray-300 line-clamp-3 leading-relaxed font-normal drop-shadow text-left">
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
                if (currentIndex === 0) return focusSidebarFromHero(direction);
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
