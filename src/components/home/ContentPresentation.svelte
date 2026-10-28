<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ContentItem } from '@/types/content';
  import { isTVShow } from '@/types/content';
  import { resolveBackdrop, resolveLogo } from '@/utils/helpers';

  let { item, clientEndpoint, children, immersive = false, expanded = true, previewEnabled = true, fullscreenEligible = false, onImmersiveChange }: {
    item: ContentItem;
    clientEndpoint?: string;
    children?: Snippet;
    immersive?: boolean;
    expanded?: boolean;
    previewEnabled?: boolean;
    fullscreenEligible?: boolean;
    onImmersiveChange?: (active: boolean) => void;
  } = $props();

  const backdrop = $derived(
    resolveBackdrop(
      item.images,
      item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover,
      clientEndpoint,
      'xlarge'
    )
  );
  const logo = $derived(resolveLogo(item.images, clientEndpoint));
  let failedLogo = $state<string | null>(null);
  const genres = $derived(
    Array.isArray(item.categories)
      ? item.categories.slice(0, 2).map((c: { name?: string }) => c.name).filter(Boolean)
      : []
  );
  const rating = $derived(
    typeof item.content_rating === 'object' && item.content_rating !== null
      ? String((item.content_rating as { code?: string }).code ?? '')
      : ''
  );
  const duration = $derived.by(() => {
    if (isTVShow(item)) {
      return item.seasons_count
        ? `${item.seasons_count} ${item.seasons_count === 1 ? 'temporada' : 'temporadas'}`
        : 'Serie';
    }
    if (!item.duration) return 'Película';
    const minutes = Math.round(item.duration / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
  });
  const badge = $derived(
    typeof item.content_badge === 'object' && item.content_badge !== null
      ? String((item.content_badge as { label?: string }).label ?? '')
      : ''
  );

  const trailerUrl = $derived.by(() => {
    const raw = item as Record<string, unknown> | undefined;
    const directSources = (raw?.trailer_sources ?? raw?.trailer_video_sources) as
      | { url?: string }[]
      | undefined;
    if (Array.isArray(directSources) && directSources.length > 0 && directSources[0]?.url) {
      return directSources[0].url;
    }
    return null;
  });

  let displayedBackdrop = $state<string | null>(null);
  let isArtworkLoaded = $state(false);

  let showTrailer = $state(false);
  let isVideoPlaying = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let fullscreenReady = $state(false);

  $effect(() => {
    void item.id;
    fullscreenReady = false;
    if (!fullscreenEligible || !previewEnabled) return;
    const timer = setTimeout(() => { fullscreenReady = true; }, 1200);
    return () => clearTimeout(timer);
  });

  // Artwork loading effect
  $effect(() => {
    const nextUrl = backdrop;
    if (!nextUrl) {
      displayedBackdrop = null;
      isArtworkLoaded = false;
      return;
    }

    let active = true;
    const img = new Image();
    img.onload = () => {
      if (!active) return;
      displayedBackdrop = nextUrl;
      isArtworkLoaded = true;
    };
    img.onerror = () => {
      if (!active) return;
      displayedBackdrop = null;
      isArtworkLoaded = false;
    };
    img.src = nextUrl;

    return () => {
      active = false;
    };
  });

  // Trailer auto-preview effect (plays where the banner is after hovering 2s, with sound)
  $effect(() => {
    const url = trailerUrl;
    void item.id;
    showTrailer = false;
    isVideoPlaying = false;

    if (!url || !previewEnabled) return;

    const timer = setTimeout(() => {
      showTrailer = true;
    }, 2000);

    return () => {
      clearTimeout(timer);
      showTrailer = false;
      isVideoPlaying = false;
      if (videoEl) {
        videoEl.pause();
      }
    };
  });

  // Start playback with sound once the video element is mounted
  $effect(() => {
    const video = videoEl;
    if (!showTrailer || !video) return;
    let active = true;

    video.muted = false;
    video.volume = 1;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to muted if browser autoplay policy blocks unmuted
        if (active) {
          video.muted = true;
          video.play().catch(() => {});
        }
      });
    }

    return () => {
      active = false;
      video.pause();
    };
  });
  const fullscreen = $derived(fullscreenEligible && fullscreenReady && previewEnabled && showTrailer && isVideoPlaying);
  $effect(() => { onImmersiveChange?.(fullscreen); });
  $effect(() => () => { onImmersiveChange?.(false); });
</script>

<section class="presentation" class:immersive class:fullscreen class:compact={immersive && !expanded} aria-label={item.title}>
  {#if displayedBackdrop}
    <img
      class="artwork"
      class:loaded={isArtworkLoaded}
      src={displayedBackdrop}
      alt=""
      decoding="async"
    />
  {/if}

  {#if trailerUrl && showTrailer}
    <div class="trailer-canvas">
    <video
      bind:this={videoEl}
      src={trailerUrl}
      class="trailer-video"
      class:playing={isVideoPlaying}
      playsinline
      onplaying={() => {
        isVideoPlaying = true;
      }}
      onended={() => {
        showTrailer = false;
        isVideoPlaying = false;
      }}
      onerror={() => {
        showTrailer = false;
        isVideoPlaying = false;
      }}
    >
      <track kind="captions" />
    </video>
    </div>
  {/if}

  <div class="shade" aria-hidden="true"></div>

  <div class="information">
    <div class="identity">
      {#key item.id}
        {#if logo && failedLogo !== logo}
          <img class="title-logo" src={logo} alt={item.title} onerror={() => { failedLogo = logo; }} />
        {:else}
          <h1>{item.title}</h1>
        {/if}
      {/key}
    </div>
    {#if badge}
      <p class="badge">{badge}</p>
    {/if}
    <div class="metadata">
      {#if item.year}
        <span>{item.year}</span>
      {/if}
      {#if item.year && duration}
        <span class="sep">•</span>
      {/if}
      <span>{duration}</span>
      {#each genres as genre}
        <span class="sep">•</span>
        <span>{genre}</span>
      {/each}
      {#if rating}
        <span class="rating">{rating}</span>
      {/if}
    </div>
    <p class="synopsis">{item.description ?? ''}</p>
    <div class="actions">
      {@render children?.()}
    </div>
  </div>
</section>

<style>
  .presentation { position: relative; isolation: isolate; height: var(--browse-stage-height, 23.3333rem); min-height: 13.3333rem; background: var(--color-bg); overflow: hidden; }
  .artwork, .trailer-canvas {
    position: absolute; top: 0; right: 0;
    width: 51.3333rem; height: 100%;
    -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,.4) 8%, black 22%), linear-gradient(to top, transparent 0%, rgba(0,0,0,.6) 12%, black 30%);
    -webkit-mask-composite: destination-in;
    mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,.4) 8%, black 22%), linear-gradient(to top, transparent 0%, rgba(0,0,0,.6) 12%, black 30%);
    mask-composite: intersect;
  }
  .artwork { object-fit: cover; object-position: right 25%; opacity: 0; transition: opacity 180ms ease-out; }
  .artwork.loaded { opacity: 1; }
  .trailer-canvas { width: var(--tv-screen-width, 80rem); height: var(--tv-screen-height, 45rem); transform-origin: right top; transform: scale(.72); z-index: 1; pointer-events: none; transition: transform 280ms ease-out; }
  .trailer-video { display: block; width: 100%; height: 100%; object-fit: cover; object-position: right top; opacity: 0; transition: opacity 180ms ease-out; }
  .trailer-video.playing { opacity: 1; }
  .shade { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(90deg, #0a0a0a 0%, rgba(10,10,10,.94) 26%, rgba(10,10,10,.75) 42%, rgba(10,10,10,.15) 68%, transparent), linear-gradient(0deg, #0a0a0a, rgba(10,10,10,.5) 20%, transparent 50%); }
  .information { position: relative; z-index: 3; height: 100%; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: calc(var(--topnav-h) + 0.6667rem) 0 1rem var(--browse-inset, var(--tv-content-inset)); max-width: 32rem; width: 100%; box-sizing: border-box; transition: transform 240ms ease-out; }
  .identity { height: 4rem; flex: 0 0 4rem; display: flex; align-items: center; margin-bottom: .50rem; width: 100%; overflow: hidden; }
  .title-logo { display: block; width: 17.3333rem; max-width: 100%; height: 100%; object-fit: contain; object-position: left center; }
  h1 { font-size: 1.8rem; font-weight: 700; line-height: 1.1; letter-spacing: -.02em; margin: 0; color: rgba(255,255,255,.9); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .badge { margin: 0 0 0.3333rem; color: var(--color-gold); font-size: 0.6667rem; font-weight: 600; }
  .metadata { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4667rem; color: rgba(255,255,255,.6); font-size: 0.75rem; font-weight: 500; }
  .sep { opacity: .4; }
  .rating { background: var(--color-surface); border: 0.0417rem solid rgba(255,255,255,.22); color: rgba(255,255,255,.9); padding: 0.0667rem .30rem; border-radius: 0.1667rem; font-size: 0.5833rem; font-weight: 600; line-height: 1; }
  .synopsis { color: rgba(243,244,245,.82); font-size: 0.8333rem; line-height: 1.45; margin: 0.6667rem 0 1rem; max-width: 28.6667rem; min-height: 2.1333rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.8333rem; }
  .immersive .information { justify-content: flex-start; }
  .compact .synopsis { display: none; }
  .compact .actions { margin-top: 0.6667rem; }
  .immersive .synopsis { -webkit-line-clamp: 2; min-height: 0; }
  .fullscreen { overflow: visible; }
  .fullscreen .trailer-canvas { transform: scale(1); -webkit-mask-image: none; mask-image: none; }
  .fullscreen .trailer-video { object-fit: contain; background: #000; }
  .fullscreen .shade { height: var(--tv-screen-height, 45rem); background: linear-gradient(0deg, rgba(0,0,0,.85), rgba(0,0,0,.2) 24%, transparent 45%); }
  .fullscreen .information { transform: translateY(calc(var(--tv-screen-height, 45rem) - var(--topnav-h) - 9.3333rem)); }
  .fullscreen .metadata, .fullscreen .synopsis, .fullscreen .badge { display: none; }
  .fullscreen .actions { margin-top: 0.6667rem; }
</style>
