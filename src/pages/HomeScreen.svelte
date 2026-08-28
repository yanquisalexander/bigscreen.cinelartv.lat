<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import FocusableCard from '@/components/tv/FocusableCard.svelte';
  import FocusableRow from '@/components/tv/FocusableRow.svelte';
  import HeroSection from '@/components/home/HeroSection.svelte';
  import ExitDialog from '@/components/ui/ExitDialog.svelte';
  import {  svelteAuthStore } from '@/stores/authStore';
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
  let heroImmersive = $state(false);
  let scrollY = $state(0);
  let rowRefs = $state<Record<number, HTMLElement>>({});

  const tokens = $derived($svelteAuthStore.tokens);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);

  function progressPercent(item: ContentItem): number {
    if (!item.progress || !item.duration) return 0;
    return Math.min(100, Math.round((item.progress / item.duration) * 100));
  }

  async function fetchData() {
    error = false;
    loading = true;
    const startTime = performance.now();
    try {
      const explore = await getExplore(tokens?.accessToken, {
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

  const bannerItems = $derived(data?.banner_content ?? []);
  const firstRowId = $derived(data?.content?.[0]?.content?.[0]?.id);
  const firstRowFocusKey = $derived(firstRowId != null ? `home-row-0-item-${firstRowId}` : undefined);
  const preferredChildFocusKey = $derived(bannerItems.length > 0 ? 'hero-section' : 'home-row-0');

  function focusTopNav() {
    setFocus('topnav');
    return false;
  }

  function focusHeroFromFirstRow(direction: string) {
    if (direction !== 'up' || bannerItems.length === 0) return focusTopNav();
    setFocus('hero-view-more');
    return false;
  }

  $effect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const currentKey = getCurrentFocusKey();
      if (currentKey && doesFocusableExist(currentKey)) return;
      e.preventDefault();
      setFocus(loading || error ? 'topnav' : 'home-root');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  function isTopNavFocused(): boolean {
    const key = getCurrentFocusKey();
    return Boolean(key && (key === 'topnav' || key.startsWith('nav-')));
  }

  $effect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.preventDefault();
        if (showExitDialog) {
          showExitDialog = false;
          return;
        }
        if (isTopNavFocused()) {
          showExitDialog = true;
        } else {
          setFocus('topnav');
        }
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  });
</script>

<FocusContainer
  focusKey="home-root"
  {preferredChildFocusKey}
  focusable={false}
  trackChildren={true}
  saveLastFocusedChild={true}
  class="w-full h-dvh overflow-hidden relative hide-scrollbar"
>
  {#if loading}
    <div class="w-full h-full flex flex-col bg-bg">
      <div class="relative w-full h-[clamp(420px,68vh,660px)] bg-black overflow-hidden">
        <div class="absolute inset-0 bg-surface animate-pulse-slow"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/30"></div>
        <div class="absolute bottom-[clamp(2.5rem,7vh,4.5rem)] left-[clamp(2.5rem,5vw,5rem)] flex flex-col items-start gap-3 z-10">
          <div class="h-3 w-16 rounded bg-white/10 animate-pulse-slow"></div>
          <div class="h-[clamp(2rem,3.2vw,2.8rem)] w-[clamp(14rem,28vw,22rem)] rounded-lg bg-white/10 animate-pulse-slow"></div>
          <div class="h-3 w-[clamp(16rem,24vw,20rem)] rounded bg-white/10 animate-pulse-slow"></div>
          <div class="h-3 w-[clamp(12rem,18vw,16rem)] rounded bg-white/10 animate-pulse-slow"></div>
          <div class="mt-2 h-[clamp(2.5rem,4vh,3rem)] w-[clamp(8rem,10vw,10rem)] rounded-xl bg-white/10 animate-pulse-slow"></div>
        </div>
      </div>
      <div class="relative px-[clamp(3rem,7.5vw,6rem)] pt-[clamp(1rem,2vh,1.5rem)] pb-[clamp(3rem,8vh,4rem)] space-y-[clamp(1.5rem,4vh,2rem)]">
        {#each [1, 2, 3] as i (i)}
          <div>
            <div class="h-[clamp(1.125rem,2.4vh,1.5rem)] w-[clamp(10rem,15vw,12rem)] bg-surface rounded mb-[clamp(0.75rem,2vh,1rem)] animate-pulse-slow"></div>
            <div class="flex gap-[clamp(0.5rem,1vw,0.75rem)]">
              {#each [1, 2, 3, 4, 5] as j (j)}
                <div class="w-[clamp(156px,18vw,230px)] h-[clamp(88px,10.2vw,130px)] bg-surface rounded-xl animate-pulse-slow"></div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if error}
    <div class="w-full h-full flex flex-col items-center justify-center gap-8 px-8 bg-bg">
      <p class="text-text-secondary text-[clamp(1rem,1.4vw,1.25rem)] text-center max-w-md">
        No se pudo cargar el contenido. Verifica tu conexión e intenta de nuevo.
      </p>
      <Focusable
        focusKey="home-retry"
        onEnterPress={fetchData}
        focusedClass="!bg-white !text-black scale-105"
        class="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(2rem,3vw,3rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
        playSound={true}
      >
        {#snippet children()}
          Reintentar
        {/snippet}
      </Focusable>
    </div>
  {:else}
    <div
      class="w-full h-full transition-transform duration-300 ease-out will-change-transform"
      style="transform: translateY(-{scrollY}px);"
    >
      {#if bannerItems.length > 0}
        <HeroSection
          items={bannerItems}
          onPlay={handlePlay}
          onInfo={handleInfo}
          {clientEndpoint}
          {firstRowFocusKey}
          onImmersiveChange={(imm) => { heroImmersive = imm; }}
          onUpdateHasFocusedChild={(focused) => {
            if (focused) scrollY = 0;
          }}
        />
      {/if}

      <div class="relative z-25 pb-[clamp(3rem,8vh,4rem)] transition-opacity duration-700 will-change-opacity {heroImmersive ? 'opacity-0 pointer-events-none' : ''}">
        <div
          class="relative h-[clamp(14rem,24vh,20rem)] -mt-[clamp(6rem,9vh,7rem)] -mb-[clamp(6rem,12vh,10rem)] bg-gradient-to-b from-transparent via-bg via-bg/70 to-bg/10 pointer-events-none"
        ></div>
        {#each data?.content ?? [] as category, catIdx (catIdx)}
          {@const preferredChild = category.content?.[0]?.id != null ? `home-row-${catIdx}-item-${category.content[0].id}` : undefined}

          <div bind:this={rowRefs[catIdx]}>
            <FocusableRow
              title={category.title}
              focusKey="home-row-{catIdx}"
              preferredChildFocusKey={preferredChild}
              onUpdateHasFocusedChild={(hasFocused) => {
                if (hasFocused && rowRefs[catIdx]) {
                  const rowTop = rowRefs[catIdx].offsetTop;
                  scrollY = Math.max(0, rowTop - 160);
                }
              }}
            >
              {#each category.content ?? [] as item, itemIdx (item.id)}
                {@const image = resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint)}
                {@const bannerImage = resolveBackdrop(item.images, item.banner_resized ?? item.banner, clientEndpoint, 'medium')}
                {@const ambientImage = resolveBackdrop(item.images, item.banner_resized ?? item.banner, clientEndpoint, 'thumbnail')}

                <FocusableCard
                  variant="row"
                  focusKey="home-row-{catIdx}-item-{item.id}"
                  title={item.title}
                  description={item.description}
                  year={item.year!}
                  {image}
                  {bannerImage}
                  ambientImageUrl={ambientImage}
                  progress={progressPercent(item)}
                  onArrowPress={(direction) => {
                    if (catIdx === 0 && direction === 'up') return focusHeroFromFirstRow(direction);
                    return true;
                  }}
                  onEnterPress={() => handleInfo(item)}
                  playSound={true}
                />
              {/each}
            </FocusableRow>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</FocusContainer>

{#if showExitDialog}
  <ExitDialog
    onConfirm={() => exitApp()}
    onCancel={() => { showExitDialog = false; }}
  />
{/if}
