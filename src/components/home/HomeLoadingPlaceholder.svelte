<script lang="ts">
  // Skeleton del home mientras carga el catálogo: replica la geometría real
  // (hero con arte a la derecha + texto anclado abajo, filas de cards 16:9)
  // para que al llegar los datos no haya salto de layout. Sin elementos
  // enfocables: es solo decoración + texto para lectores de pantalla.
  interface Props {
    heroHeightRem: number;
    shelfOffsetRem: number;
    overlapRem?: number;
    creepRem?: number;
  }

  let { heroHeightRem, shelfOffsetRem, overlapRem = 0, creepRem = 0 }: Props = $props();

  const CARDS_PER_ROW = 6;
  const ROWS = [0, 1, 2];
</script>

<div
  class="home-skeleton"
  role="status"
  aria-label="Cargando tu catálogo"
  style="--hero-overlap: {overlapRem}rem; --hero-shelf-creep: {creepRem}rem;"
>
  <!-- Hero skeleton -->
  <div class="skeleton-hero" style="height: {heroHeightRem}rem;" aria-hidden="true">
    <div class="skeleton-artwork sk"></div>
    <div class="skeleton-shade"></div>
    <div class="skeleton-info">
      <div class="sk sk-title"></div>
      <div class="sk sk-meta"></div>
      <div class="sk sk-line" style="width: 92%;"></div>
      <div class="sk sk-line" style="width: 64%;"></div>
      <div class="skeleton-actions">
        <div class="sk sk-cta sk-cta-primary"></div>
        <div class="sk sk-cta"></div>
      </div>
    </div>
  </div>

  <!-- Filas skeleton -->
  <div class="skeleton-shelves" style="transform: translateY({shelfOffsetRem}rem);" aria-hidden="true">
    {#each ROWS as row (row)}
      <div class="sk-shelf">
        <div class="sk sk-shelf-title" style="animation-delay: {row * 0.15}s;"></div>
        <div class="sk-cards">
          {#each Array.from({ length: CARDS_PER_ROW }) as _, i (i)}
            <div class="sk-card">
              <div class="sk sk-thumb" style="animation-delay: {(row * CARDS_PER_ROW + i) * 0.07}s;"></div>
              <div class="sk sk-card-line" style="animation-delay: {(row * CARDS_PER_ROW + i) * 0.07}s;"></div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <span class="sr-only">Cargando tu catálogo…</span>
</div>

<style>
  .home-skeleton {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .sk {
    background: #262626;
    animation: pulse 2s ease-in-out infinite;
    will-change: opacity;
  }

  /* ── Hero ─────────────────────────────────────────────────────────────── */
  .skeleton-hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    background: var(--color-bg);
  }

  .skeleton-artwork {
    position: absolute;
    top: 0;
    right: 0;
    width: 58rem;
    height: 100%;
    /* Mismo fundido que el artwork real de ContentPresentation */
    -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.35) 9%, black 26%), linear-gradient(to top, transparent 0%, rgba(0, 0, 0, 0.35) 16%, rgba(0, 0, 0, 0.78) 36%, black 58%);
    -webkit-mask-composite: destination-in;
    mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.35) 9%, black 26%), linear-gradient(to top, transparent 0%, rgba(0, 0, 0, 0.35) 16%, rgba(0, 0, 0, 0.78) 36%, black 58%);
    mask-composite: intersect;
  }

  .skeleton-shade {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: linear-gradient(90deg, #0a0a0a 0%, rgba(10, 10, 10, 0.94) 26%, rgba(10, 10, 10, 0.75) 42%, rgba(10, 10, 10, 0.15) 68%, transparent), linear-gradient(0deg, #0a0a0a 0%, rgba(10, 10, 10, 0.85) 16%, rgba(10, 10, 10, 0.45) 36%, rgba(10, 10, 10, 0.12) 52%, transparent 68%);
  }

  .skeleton-info {
    position: relative;
    z-index: 3;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    box-sizing: border-box;
    max-width: 34rem;
    padding: calc(var(--topnav-h) + 0.6667rem) 0 calc(1.25rem + var(--hero-overlap, 0rem) + var(--hero-shelf-creep, 0rem)) var(--browse-inset, var(--tv-content-inset));
  }

  .sk-title {
    width: 19rem;
    max-width: 100%;
    height: 4.5rem;
    border-radius: 0.5rem;
    margin-bottom: 0.6rem;
  }

  .sk-meta {
    width: 11rem;
    height: 0.8125rem;
    border-radius: 0.25rem;
    margin-bottom: 0.6667rem;
  }

  .sk-line {
    height: 0.9rem;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .skeleton-actions {
    display: flex;
    align-items: center;
    gap: 0.8333rem;
    margin-top: 0.5rem;
  }

  .sk-cta {
    height: 2.5rem;
    border-radius: 999rem;
  }

  .sk-cta-primary {
    width: 10.5rem;
    background: rgba(255, 255, 255, 0.22);
  }

  .sk-cta:not(.sk-cta-primary) {
    width: 9rem;
  }

  /* ── Filas ────────────────────────────────────────────────────────────── */
  .skeleton-shelves {
    position: absolute;
    z-index: 1;
    inset: 0 0 auto;
    height: 100%;
    overflow: hidden;
    will-change: transform;
  }

  .sk-shelf {
    margin-bottom: clamp(0.5rem, 1.2vh, 1rem);
  }

  .sk-shelf-title {
    width: 9rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    margin: 0 0 clamp(0.35rem, 0.7vh, 0.5rem) var(--tv-content-inset);
  }

  .sk-cards {
    display: flex;
    gap: var(--tv-card-gap);
    margin-left: calc(var(--tv-content-inset) - 0.25rem);
    padding-left: 0.25rem;
    padding-right: var(--tv-content-inset);
  }

  .sk-card {
    flex: 0 0 auto;
    width: var(--tv-browse-card-width);
  }

  .sk-thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: clamp(0.5rem, 0.7vw, 0.625rem);
  }

  .sk-card-line {
    width: 72%;
    height: 0.75rem;
    border-radius: 0.25rem;
    margin-top: 0.55rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
