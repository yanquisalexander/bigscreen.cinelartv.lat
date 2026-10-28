<script lang="ts">
  import { TV_SCALE_EVENT } from '@/services/tvScale';
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import VirtualizedShelves from '@/components/home/VirtualizedShelves.svelte';
  import ContentPresentation from '@/components/home/ContentPresentation.svelte';
  import DetailActionButton from '@/components/detail/DetailActionButton.svelte';
  import { Play, Info } from '@lucide/svelte';
  import { tick } from 'svelte';
  import { homeBrowseMemory } from '@/stores/homeBrowseMemory';
  import ExitDialog from '@/components/ui/ExitDialog.svelte';
  import { authStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { toastStore } from '@/stores/toastStore';
  import { getExplore } from '@/features/content/explore';
  import { resolveImageUrl, isBackKey, resolveBackdrop, resolvePoster } from '@/utils/helpers';
  import { syncContinueWatching, syncRecommendations, exitApp, type AndroidTvHomeItem } from '@/services/NativeBridge';
  import { setFocus, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import type { ContentItem, ExploreResponse } from '@/types/content';
  import { trackHomeLoaded, trackContentSelect, trackContentImpression } from '@/lib/analytics';

  let data = $state<ExploreResponse | null>(null);
  let loading = $state(true);
  let error = $state(false);
  let showExitDialog = $state(false);
  const profileKey = String(authStore.getState().selectedProfile?.id ?? 'guest');
  if (homeBrowseMemory.profile !== profileKey) Object.assign(homeBrowseMemory, { profile: profileKey, itemId: '', categoryIndex: 0, focusKey: '', scrollY: 0 });
  let scrollY = $state(homeBrowseMemory.scrollY);
  let selectedItem = $state<ContentItem | null>(null);
  let activeCategoryIndex = $state(homeBrowseMemory.categoryIndex);
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let lastCardKey = homeBrowseMemory.focusKey;
  let viewportHeight = $state(0);
  let listFocused = $state(false);
  let heroFocused = $state(false);
  let trailerFullscreen = $state(false);
  let fullscreenSuppressed = $state(false);
  let remSize = $state(16);
  let viewportWidth = $state(1920);

  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);

  async function fetchData() {
    error = false;
    loading = true;
    const startTime = performance.now();
    try {
      const explore = await getExplore(authStore.getState().tokens?.accessToken, {
        include_trailers: true,
        img_variants: ['xlarge', 'large', 'medium'],
      });
      data = explore;
      const loadDuration = Math.round(performance.now() - startTime);
      const contentRows = explore.content?.length ?? 0;
      const hasBanner = (explore.banner_content?.length ?? 0) > 0;
      trackHomeLoaded(loadDuration, contentRows, hasBanner);
    } catch (e: any) {
      error = true;
      const errStr = String(e?.message ?? e ?? '');
      const is502 = e?.status === 502 || errStr.includes('502') || errStr.toLowerCase().includes('bad gateway');
      toastStore.getState().show(
        is502
          ? 'El servicio no está disponible temporalmente. Intenta de nuevo.'
          : 'Error al cargar la página. Intenta de nuevo.',
        'error',
        is502 ? 6000 : 5000,
      );
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchData();
  });

  // Track content impressions when data loads
  $effect(() => {
    if (!data) return;
    for (const [catIdx, category] of (data.content ?? []).entries()) {
      for (const [itemIdx, item] of (category.content ?? []).entries()) {
        trackContentImpression(
          item.id,
          item.content_type ?? item.contentType ?? 'movie',
          `home-row-${catIdx}`,
          itemIdx,
          'home',
        );
      }
    }
  });

  $effect(() => {
    if (!data) return;
    const items: AndroidTvHomeItem[] = [];
    for (const cat of data.content ?? []) {
      for (const item of cat.content ?? []) {
        const poster = resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint);
        const backdrop = resolveBackdrop(item.images, item.banner_resized ?? item.banner, clientEndpoint, 'medium');
        items.push({
          content_id: item.id,
          title: item.title,
          description: item.description,
          content_type: item.content_type ?? item.contentType,
          cover: resolveImageUrl(item.cover, clientEndpoint)!,
          cover_resized: poster ?? resolveImageUrl(item.cover_resized, clientEndpoint)!,
          banner: resolveImageUrl(item.banner, clientEndpoint)!,
          banner_resized: backdrop ?? resolveImageUrl(item.banner_resized, clientEndpoint)!,
          progress: item.progress,
          duration: item.duration,
          year: item.year,
          url: `/content/${item.id}`,
          image_url: backdrop ?? poster ?? resolveImageUrl(item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover, clientEndpoint)!,
        });
      }
    }
    syncContinueWatching(
      items
        .filter((i) => i.progress != null && i.progress > 0)
        .slice(0, 3)
        .map((i) => ({ ...i, progress: undefined }))
    );
    syncRecommendations(items);
  });

  function handlePlay(item: ContentItem) {
    trackContentSelect(item.id, item.content_type ?? item.contentType ?? 'movie', 'hero', item.title);
    push(`/watch/${item.id}`);
  }

  function handleInfo(item: ContentItem) {
    trackContentSelect(item.id, item.content_type ?? item.contentType ?? 'movie', 'home', item.title);
    push(`/content/${item.id}`);
  }

  function handleCardEnter(item: ContentItem) {
    if (item.content_type === 'LIVETV' || (item as any).contentType === 'LIVETV') {
      push(`/live/${item.id}`);
      return;
    }
    if (item.continue_watching && (item.continue_watching.progress ?? 0) > 0) {
      handlePlay(item);
      return;
    }
    handleInfo(item);
  }


  const categories = $derived((data?.content ?? []).filter(category => (category.content?.length ?? 0) > 0));
  const presentationItem = $derived(selectedItem ?? data?.banner_content?.[0] ?? categories[0]?.content?.[0]);
  const expandedStageHeight = $derived(Math.max(12 * remSize, Math.min(24 * remSize, viewportHeight - 18 * remSize)));
  const compactStageHeight = $derived(Math.max(10 * remSize, Math.min(18 * remSize, expandedStageHeight - 3.5 * remSize)));
  const stageHeight = $derived(trailerFullscreen ? viewportHeight : listFocused ? expandedStageHeight : compactStageHeight);
  const railViewportHeight = $derived(Math.max(0, viewportHeight - stageHeight));

  const resumeProgress = $derived(
    presentationItem?.continue_watching?.duration
      ? Math.max(0, Math.min(100, (presentationItem.continue_watching.progress / presentationItem.continue_watching.duration) * 100))
      : 0
  );

  const heroPlayLabel = $derived(
    presentationItem?.continue_watching
      ? 'Continuar viendo'
      
      : 'Ver ahora'
  );

  function focusNav() {
    if (doesFocusableExist('topnav')) setFocus('topnav');
    return false;
  }

  function focusCards() {
    fullscreenSuppressed = true;
    if (lastCardKey && doesFocusableExist(lastCardKey)) { setFocus(lastCardKey); return false; }
    const first = categories[0]?.content?.[0];
    const prefix = categories[0]?.section_kind === 'top_10_by_country' ? 'home-top10-0' : 'home-row-0';
    const key = first ? prefix + '-item-' + first.id : '';
    if (key && doesFocusableExist(key)) setFocus(key);
    return false;
  }

  function handleCardFocus(item: ContentItem, catIdx: number, key: string) {
    listFocused = true;
    heroFocused = false;
    fullscreenSuppressed = false;
    activeCategoryIndex = catIdx;
    lastCardKey = key;
    Object.assign(homeBrowseMemory, { itemId: item.id, categoryIndex: catIdx, focusKey: key });
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { selectedItem = item; }, 240);
  }

  function handleShelfFocusUpdate(catIdx: number, hasFocused: boolean, shelfY: number) {
    if (!hasFocused) return;
    activeCategoryIndex = catIdx;
    scrollY = shelfY;
    homeBrowseMemory.scrollY = shelfY;
  }

  $effect(() => {
    if (!data || loading) return;
    const remembered = categories[homeBrowseMemory.categoryIndex]?.content?.find(item => item.id === homeBrowseMemory.itemId);
    if (remembered) selectedItem = remembered;
    let cancelled = false;
    void tick().then(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const target = remembered && doesFocusableExist(homeBrowseMemory.focusKey) ? homeBrowseMemory.focusKey : 'hero-view-more';
        if (doesFocusableExist(target)) setFocus(target);
        else focusNav();
      });
    });
    return () => { cancelled = true; };
  });

  $effect(() => {
    const resize = () => {
      viewportHeight = window.innerHeight;
      viewportWidth = window.innerWidth;
      remSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    };
    resize();
    const back = (event: KeyboardEvent) => {
      if (!isBackKey(event)) return;
      event.preventDefault();
      if (trailerFullscreen) { fullscreenSuppressed = true; return; }
      if (showExitDialog) { showExitDialog = false; return; }
      const key = getCurrentFocusKey();
      if (key === 'topnav' || key?.startsWith('nav-')) showExitDialog = true;
      else focusNav();
    };
    window.addEventListener(TV_SCALE_EVENT, resize);
    window.addEventListener('keydown', back);
    return () => {
      clearTimeout(previewTimer);
      window.removeEventListener(TV_SCALE_EVENT, resize);
      window.removeEventListener('keydown', back);
    };
  });
  $effect(() => {
    document.body.classList.toggle('playing-inmersive-trailer', trailerFullscreen);
    return () => document.body.classList.remove('playing-inmersive-trailer');
  });
</script>

<div style="--tv-screen-width: {viewportWidth / remSize}rem; --tv-screen-height: {viewportHeight / remSize}rem;">
<FocusContainer focusKey="home-root" preferredChildFocusKey="hero-section" focusable={false} saveLastFocusedChild={true} onUpdateHasFocusedChild={(focused) => { if (!focused) listFocused = false; }} class="browse-home">
  {#if loading}
    <div class="loading-state">Cargando tu catálogo…</div>
  {:else if error}
    <div class="loading-state">
      <p>No se pudo cargar el catálogo.</p>
      <DetailActionButton focusKey="home-retry" label="Reintentar" onEnterPress={fetchData} autoFocus={true} />
    </div>
  {:else if presentationItem}
    <div class="immersive-stage" class:trailer-fullscreen={trailerFullscreen} style="--browse-stage-height: {expandedStageHeight / remSize}rem;">
      <FocusContainer focusKey="hero-section" focusable={false} preferredChildFocusKey="hero-view-more" saveLastFocusedChild={true} onUpdateHasFocusedChild={(focused) => { heroFocused = focused; if (focused) listFocused = false; fullscreenSuppressed = false; }}>
        <ContentPresentation item={presentationItem} {clientEndpoint} immersive={true} expanded={listFocused} previewEnabled={listFocused || heroFocused} fullscreenEligible={heroFocused && !fullscreenSuppressed} onImmersiveChange={(active) => { trailerFullscreen = active; }}>
          <div class="hero-action-wrap">
            <DetailActionButton
              focusKey="hero-view-more"
              label={heroPlayLabel}
              onEnterPress={() => handlePlay(presentationItem!)}
              onArrowPress={(dir) => (dir === 'down' ? focusCards() : dir === 'left' || dir === 'up' ? focusNav() : true)}
            >
              {#snippet icon()}<Play size="1.375rem" class="fill-current" />{/snippet}
            </DetailActionButton>
            {#if resumeProgress > 0}
              <div
                class="hero-resume-progress"
                role="progressbar"
                aria-label="Progreso"
                aria-valuenow={Math.round(resumeProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style="width: {resumeProgress}%;"></span>
              </div>
            {/if}
          </div>
          <DetailActionButton
            focusKey="hero-more-info"
            label="Más información"
            variant="secondary"
            onEnterPress={() => handleInfo(presentationItem!)}
            onArrowPress={(dir) => (dir === 'down' ? focusCards() : dir === 'up' ? focusNav() : true)}
          >
            {#snippet icon()}<Info size="1.375rem" />{/snippet}
          </DetailActionButton>
        </ContentPresentation>
      </FocusContainer>
    </div>
    <div class="shelf-viewport" style="transform: translateY({stageHeight / remSize}rem) translateZ(0);">
      <div class="shelf-track" style="transform: translateY({-scrollY / remSize}rem) translateZ(0);">
        <VirtualizedShelves {categories} {scrollY} viewportHeight={railViewportHeight} {clientEndpoint} {activeCategoryIndex}
          initialItemId={homeBrowseMemory.itemId}
          onCardEnterPress={handleCardEnter}
          onCardFocus={handleCardFocus}
          onCardArrowPress={(dir, catIdx) => {
            if (dir === 'left') return focusNav();
            if (dir === 'up' && catIdx === 0) {
              clearTimeout(previewTimer);
              if (doesFocusableExist('hero-view-more')) setFocus('hero-view-more');
              return false;
            }
            return true;
          }}
          onShelfFocusUpdate={handleShelfFocusUpdate}
        />
      </div>
    </div>
  {:else}
    <div class="loading-state">Todavía no hay títulos disponibles.</div>
  {/if}
</FocusContainer>
</div>
{#if showExitDialog}
  <ExitDialog onConfirm={() => exitApp()} onCancel={() => { showExitDialog = false; }} />
{/if}

<style>
  :global(.browse-home) {
    height: 100vh;
    overflow: hidden;
    background: #0a0a0a;
    position: relative;
    --browse-inset: var(--tv-content-inset);
  }

  .loading-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.55);
  }

  .hero-action-wrap {
    position: relative;
    display: inline-flex;
    flex-direction: column;
  }

  .hero-resume-progress {
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    bottom: -0.5rem;
    height: .1875rem;
    background: rgba(255, 255, 255, 0.22);
    border-radius: .125rem;
    overflow: hidden;
  }

  .hero-resume-progress span {
    display: block;
    height: 100%;
    background: #FFFFFF;
    border-radius: 2px;
  }

  .shelf-viewport {
    position: absolute;
    z-index: 1;
    inset: 0 0 auto;
    height: 100%;
    overflow: hidden;
    background: #0a0a0a;
    transition: transform 180ms ease-out;
    will-change: transform;
  }

  .immersive-stage {
    position: absolute;
    inset: 0 0 auto;
    z-index: 0;
    isolation: isolate;
  }

  .trailer-fullscreen { z-index: 20; }

  .shelf-track {
    transition: transform 180ms ease-out;
    will-change: transform;
  }
</style>
