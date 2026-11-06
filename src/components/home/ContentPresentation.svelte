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
  // Los banners no siempre traen content_type: sin tipo/duración conocidos
  // no se muestra nada (antes caía a "Película" por defecto, incorrecto).
  const duration = $derived.by(() => {
    if (isTVShow(item)) {
      return item.seasons_count
        ? `${item.seasons_count} ${item.seasons_count === 1 ? 'temporada' : 'temporadas'}`
        : 'Serie';
    }
    if (!item.duration) return '';
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
      {#if duration}
        {#if item.year}<span class="sep">•</span>{/if}
        <span>{duration}</span>
      {/if}
      {#each genres as genre, genreIndex}
        {#if item.year || duration || genreIndex > 0}<span class="sep">•</span>{/if}
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
    width: 58rem; height: 100%;
    /* Fundidos largos en ambos ejes: el arte entra desde la derecha y se
       disuelve hacia abajo durante más de la mitad del alto, para que no
       se lea como un panel recortado contra el fondo. */
    -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 9%, black 26%), linear-gradient(to top, transparent 0%, rgba(0,0,0,.35) 16%, rgba(0,0,0,.78) 36%, black 58%);
    -webkit-mask-composite: destination-in;
    mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 9%, black 26%), linear-gradient(to top, transparent 0%, rgba(0,0,0,.35) 16%, rgba(0,0,0,.78) 36%, black 58%);
    mask-composite: intersect;
  }
  .artwork { object-fit: cover; object-position: right 30%; opacity: 0; transition: opacity 450ms ease-out; }
  .artwork.loaded { opacity: 1; }
  .trailer-canvas { width: var(--tv-screen-width, 80rem); height: var(--tv-screen-height, 45rem); transform-origin: right top; transform: scale(.72); z-index: 1; pointer-events: none; transition: transform 280ms ease-out; }
  .trailer-video { display: block; width: 100%; height: 100%; object-fit: cover; object-position: right top; opacity: 0; transition: opacity 320ms ease-out; }
  .trailer-video.playing { opacity: 1; }
  .shade { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(90deg, #0a0a0a 0%, rgba(10,10,10,.94) 26%, rgba(10,10,10,.75) 42%, rgba(10,10,10,.15) 68%, transparent), linear-gradient(0deg, #0a0a0a 0%, rgba(10,10,10,.85) 16%, rgba(10,10,10,.45) 36%, rgba(10,10,10,.12) 52%, transparent 68%); }
  /* Texto anclado abajo, justo encima de la primera fila: el hero se lee
     como una sola superficie (arte + título + CTAs) y no como un banner
     con la mitad inferior vacía. En Home, --hero-overlap/--hero-shelf-creep
     reservan el espacio que las filas ocupan por delante del backdrop. */
  .information { position: relative; z-index: 3; height: 100%; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end; padding: calc(var(--topnav-h) + 0.6667rem) 0 calc(1.25rem + var(--hero-overlap, 0rem)) var(--browse-inset, var(--tv-content-inset)); max-width: 34rem; width: 100%; box-sizing: border-box; transition: transform 240ms ease-out; }
  .compact .information { padding-bottom: calc(1.25rem + var(--hero-overlap, 0rem) + var(--hero-shelf-creep, 0rem)); }
  .identity { height: 4.5rem; flex: 0 0 4.5rem; display: flex; align-items: center; margin-bottom: .60rem; width: 100%; overflow: hidden; }
  .title-logo { display: block; width: 19rem; max-width: 100%; height: 100%; object-fit: contain; object-position: left bottom; }
  h1 { font-size: 2.1rem; font-weight: 700; line-height: 1.08; letter-spacing: -.02em; margin: 0; color: rgba(255,255,255,.94); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .badge { margin: 0 0 0.3333rem; color: var(--color-gold); font-size: 0.6667rem; font-weight: 600; }
  .metadata { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4667rem; color: rgba(255,255,255,.62); font-size: 0.8125rem; font-weight: 500; }
  .sep { opacity: .4; }
  .rating { background: var(--color-surface); border: 0.0417rem solid rgba(255,255,255,.22); color: rgba(255,255,255,.9); padding: 0.0667rem .30rem; border-radius: 0.1667rem; font-size: 0.5833rem; font-weight: 600; line-height: 1; }
  .synopsis { color: rgba(243,244,245,.85); font-size: 0.9rem; line-height: 1.5; margin: 0.6667rem 0 1rem; max-width: 30rem; min-height: 2.1333rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.8333rem; }
  .compact .synopsis { display: none; }
  .compact .actions { margin-top: 0.6667rem; }
  .immersive .synopsis { -webkit-line-clamp: 2; min-height: 0; }
  .fullscreen { overflow: visible; }
  .fullscreen .trailer-canvas { transform: scale(1); -webkit-mask-image: none; mask-image: none; }
  .fullscreen .trailer-video { object-fit: contain; background: #000; }
  .fullscreen .shade { height: var(--tv-screen-height, 45rem); background: linear-gradient(0deg, rgba(0,0,0,.85), rgba(0,0,0,.2) 24%, transparent 45%); }
  /* Con el contenido anclado abajo, el desplazamiento en fullscreen lleva
     los CTAs al pie de la pantalla conservando el margen inferior. */
  .fullscreen .information { transform: translateY(calc(var(--tv-screen-height, 45rem) - var(--browse-stage-height, 23.3333rem) + var(--hero-overlap, 0rem) + var(--hero-shelf-creep, 0rem))); }
  .fullscreen .metadata, .fullscreen .synopsis, .fullscreen .badge { display: none; }
  .fullscreen .actions { margin-top: 0.6667rem; }
</style>
