<script lang="ts">
  import { Play, Clapperboard, Plus, RotateCcw } from '@lucide/svelte';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import DetailActionButton from './DetailActionButton.svelte';
  import { formatTime, resolveBackdrop, resolvePoster, resolveLogo } from '@/utils/helpers';
  import { getRuntimeConfig } from '@/runtime';
  import type { ContentDetail } from '@/types/content';
  import { isTVShow } from '@/types/content';

  interface Props {
    content: ContentDetail;
    clientEndpoint?: string;
    canPlay: boolean;
    onPlay: () => void;
    onPlayTrailer?: () => void;
    onToggleList: () => void;
    onNavigateDown: (direction: string) => boolean;
    onNavigateLeft: (direction: string) => boolean;
    onNavigateUp: (direction: string) => boolean;
    onPlayFocus: () => void;
    firstEpisodeFocusKey?: string;
    firstSeasonFocusKey?: string;
  }

  let {
    content,
    clientEndpoint,
    canPlay,
    onPlay,
    onPlayTrailer,
    onToggleList,
    onNavigateDown,
    onNavigateLeft,
    onNavigateUp,
    onPlayFocus,
  }: Props = $props();

  const { appQuality } = getRuntimeConfig();
  const enabled = appQuality !== 'LITE';
  const canvasSize = appQuality === 'FULL_ANIMATION'
    ? { w: 64, h: 36 }
    : { w: 32, h: 18 };

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let hasBackdrop = $state(false);

  let lastDrawnUrl: string | null = null;
  let activeLoadingImg: HTMLImageElement | null = null;

  function drawToCanvas(canvas: HTMLCanvasElement | null, url: string) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeLoadingImg) {
      activeLoadingImg.onload = null;
      activeLoadingImg.onerror = null;
      activeLoadingImg = null;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    activeLoadingImg = img;

    img.onload = () => {
      if (activeLoadingImg !== img) return;
      activeLoadingImg = null;
      lastDrawnUrl = url;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(() => { hasBackdrop = true; });
    };

    img.onerror = () => {
      if (activeLoadingImg === img) {
        activeLoadingImg = null;
      }
    };

    img.src = url;
  }

  function formatDuration(c: ContentDetail): string | null {
    if (c.duration) return formatTime(c.duration);
    if (c.seasons_count && c.episodes_count) {
      const s = c.seasons_count === 1 ? 'temporada' : 'temporadas';
      const e = c.episodes_count === 1 ? 'episodio' : 'episodios';
      return `${c.seasons_count} ${s} · ${c.episodes_count} ${e}`;
    }
    return null;
  }

  const backdropUrl = $derived(resolveBackdrop(content.images, content.banner_resized ?? content.banner ?? content.cover_resized ?? content.cover, clientEndpoint, 'xlarge'));
  const posterUrl = $derived(resolvePoster(content.images, content.cover_resized ?? content.cover, clientEndpoint));
  const logoUrl = $derived(resolveLogo(content.images, clientEndpoint));
  const duration = $derived(formatDuration(content));
  const hasTrailer = $derived(Boolean(content.trailer_sources?.length || content.trailer_video_sources?.length));

  $effect(() => {
    if (!enabled) return;
    const url = backdropUrl;
    if (!url || !canvasEl) {
      if (activeLoadingImg) {
        activeLoadingImg.onload = null;
        activeLoadingImg.onerror = null;
        activeLoadingImg = null;
      }
      lastDrawnUrl = null;
      hasBackdrop = false;
      return;
    }
    if (url === lastDrawnUrl) return;
    drawToCanvas(canvasEl, url);
  });

  const continuePercent = $derived.by(() => {
    if (!content.continue_watching) return null;
    const { progress, duration: d } = content.continue_watching;
    if (!d) return null;
    return Math.min(100, Math.round((progress / d) * 100));
  });

  const contentType = $derived.by(() => {
    if (isTVShow(content)) return 'Serie';
    if (content.content_type || content.contentType) return 'Película';
    return null;
  });

  const metadataParts = $derived.by(() => {
    const parts: string[] = [];
    if (content.year) parts.push(String(content.year));
    if (duration) parts.push(duration);
    if (content.seasons_count && content.episodes_count) {
      const s = content.seasons_count === 1 ? '1 temporada' : `${content.seasons_count} temporadas`;
      const e = content.episodes_count === 1 ? '1 episodio' : `${content.episodes_count} episodios`;
      parts.push(`${s} · ${e}`);
    }
    return parts;
  });

  const genreTags = $derived((content.categories ?? []).slice(0, 4).map((c) => c.name));

  const backdropMaskStyle = $derived(
    enabled
      ? 'mask-image: linear-gradient(to right, transparent 0%, transparent 25%, black 40%); -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 25%, black 40%);'
      : ''
  );
</script>

<div class="relative w-full overflow-hidden min-h-[clamp(30rem,72vh,50rem)] bg-bg">
  <!-- Backdrop -->
  {#if enabled}
    <div
      class="absolute inset-0 overflow-hidden content-detail-backdrop transition-opacity duration-700 ease-in-out"
      style="opacity: {hasBackdrop ? 1 : 0}; {backdropMaskStyle}"
    >
      <canvas
        width={canvasSize.w}
        height={canvasSize.h}
        bind:this={canvasEl}
        aria-hidden="true"
        class="absolute inset-0 w-full h-full object-cover"
      ></canvas>
    </div>
  {:else if backdropUrl}
    <img
      src={backdropUrl}
      alt=""
      aria-hidden="true"
      class="absolute inset-0 w-full h-full object-cover opacity-40"
      style={backdropMaskStyle}
    />
  {/if}
  <div class="absolute inset-0 bg-gradient-to-t from-bg/60 via-bg/15 to-transparent"></div>

  <!-- Content grid -->
  <div
    class="relative h-full grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_clamp(14rem,22vw,22rem)] items-end gap-[clamp(1rem,3vw,3rem)] px-[clamp(2rem,5vw,6rem)] pt-[clamp(3rem,8vh,6rem)] pb-[clamp(1.5rem,3vh,2.5rem)] min-h-[clamp(26rem,64vh,44rem)]"
  >
    <FocusContainer
      focusKey="detail-hero"
      focusable={false}
      preferredChildFocusKey="detail-hero-play"
      trackChildren={true}
      saveLastFocusedChild={true}
      class="flex flex-col items-start max-w-[46rem]"
    >
      <!-- Logo / Title -->
      {#if logoUrl}
        <img
          src={logoUrl}
          alt={content.title}
          class="h-[clamp(3rem,7vh,5rem)] max-w-[80%] object-contain object-left mb-[clamp(0.75rem,1.5vh,1rem)]"
        />
      {:else}
        <h1
          class="font-black text-white leading-[0.98] tracking-[-0.03em] text-[clamp(2.5rem,5.2vw,4.25rem)] mb-[clamp(0.75rem,1.5vh,1rem)] max-w-[85%]"
        >
          {content.title}
        </h1>
      {/if}

      <!-- Metadata inline -->
      {#if metadataParts.length > 0 || genreTags.length > 0}
        <div class="flex items-center gap-[clamp(0.375rem,0.7vw,0.5rem)] mb-[clamp(0.75rem,1.6vh,1rem)] text-[clamp(0.8125rem,1.05vw,0.9375rem)] text-white/60 flex-wrap">
          {#if contentType}
            <span class="text-white/80 font-medium">{contentType}</span>
            <span class="text-white/25">·</span>
          {/if}
          {#if content.year}
            <span>{content.year}</span>
            <span class="text-white/25">·</span>
          {/if}
          {#if duration}
            <span>{duration}</span>
            <span class="text-white/25">·</span>
          {/if}
          {#each genreTags as genre, i (i)}
            <span>{genre}</span>
            {#if i < genreTags.length - 1}
              <span class="text-white/25">·</span>
            {/if}
          {/each}
        </div>
      {/if}

      <!-- Description -->
      {#if content.description}
        <p
          class="text-[clamp(0.9375rem,1.3vw,1.125rem)] text-white/70 font-normal max-w-[clamp(30rem,40vw,42rem)] leading-[1.5] mb-[clamp(1.5rem,3.4vh,2.25rem)] line-clamp-3"
        >
          {content.description}
        </p>
      {/if}

      <!-- Continue watching -->
      {#if continuePercent != null}
        <div class="flex items-center gap-[clamp(0.75rem,1.4vw,1rem)] mb-[clamp(1.5rem,3.4vh,2.25rem)] pl-[clamp(0.75rem,1.4vw,1rem)] pr-[clamp(1.25rem,2vw,1.5rem)] py-[clamp(0.625rem,1.2vh,0.8125rem)] rounded-xl bg-surface-elevated border border-white/10 max-w-[clamp(22rem,32vw,28rem)]">
          <div class="shrink-0 w-[clamp(2rem,4vh,2.5rem)] h-[clamp(2rem,4vh,2.5rem)] rounded-full bg-surface flex items-center justify-center">
            <RotateCcw size={16} class="text-white/70" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-[0.3125rem]">
              <span class="text-[clamp(0.6875rem,0.85vw,0.75rem)] text-white/70 font-semibold uppercase tracking-wide">
                Continuar viendo
              </span>
              <span class="text-[clamp(0.6875rem,0.85vw,0.75rem)] text-white/90 font-bold">
                {continuePercent}%
              </span>
            </div>
            <div class="h-[4px] bg-white/20 rounded-full overflow-hidden">
              <div
                class="h-full bg-accent rounded-full"
                style="width: {continuePercent}%;"
              ></div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Action buttons -->
      <div class="flex items-center gap-[clamp(0.75rem,1.5vw,1.125rem)]">
        {#if canPlay}
          <DetailActionButton
            focusKey="detail-hero-play"
            autoFocus={true}
            variant="primary"
            label={content.continue_watching ? 'Reanudar' : isTVShow(content) ? 'Episodio 1' : 'Reproducir'}
            onEnterPress={onPlay}
            onFocus={onPlayFocus}
            onArrowPress={(dir) => {
              if (dir === 'left') return onNavigateLeft(dir);
              if (dir === 'up') return onNavigateUp(dir);
              if (dir === 'down') return onNavigateDown(dir);
              return true;
            }}
          >
            {#snippet icon()}
              <Play size={20} class="fill-current" />
            {/snippet}
          </DetailActionButton>
        {/if}

        {#if hasTrailer && onPlayTrailer}
          <DetailActionButton
            focusKey="detail-hero-trailer"
            variant="secondary"
            label="Tráiler"
            onEnterPress={onPlayTrailer}
            onArrowPress={(dir) => {
              if (dir === 'left') return true;
              if (dir === 'up') return onNavigateUp(dir);
              if (dir === 'down') return onNavigateDown(dir);
              return true;
            }}
          >
            {#snippet icon()}
              <Clapperboard size={16} />
            {/snippet}
          </DetailActionButton>
        {/if}

        <DetailActionButton
          focusKey="detail-hero-list"
          variant="ghost"
          label="Mi colección"
          onEnterPress={onToggleList}
          onArrowPress={(dir) => {
            if (dir === 'left') return true;
            if (dir === 'up') return onNavigateUp(dir);
            if (dir === 'down') return onNavigateDown(dir);
            return true;
          }}
        >
          {#snippet icon()}
            <Plus size={16} />
          {/snippet}
        </DetailActionButton>
      </div>
    </FocusContainer>

    <!-- Floating art poster -->
    <div class="hidden md:flex justify-end relative">
      <div class="relative rounded-2xl overflow-hidden border border-white/10 w-[clamp(10rem,16vw,18rem)] aspect-[3/4] bg-surface shadow-2xl shadow-black/40">
        {#if posterUrl ?? backdropUrl}
          <img src={posterUrl ?? backdropUrl} alt="" aria-hidden="true" class="w-full h-full object-cover" />
        {:else}
          <div class="w-full h-full bg-surface"></div>
        {/if}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      </div>
    </div>
  </div>

  <!-- Bottom gradient blend -->
  <div class="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg"></div>
</div>
