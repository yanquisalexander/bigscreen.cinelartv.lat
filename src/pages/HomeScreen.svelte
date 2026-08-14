<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import FocusableCard from '@/components/tv/FocusableCard.svelte';
  import FocusableRow from '@/components/tv/FocusableRow.svelte';
  import HeroSection from '@/components/home/HeroSection.svelte';
  import ExitDialog from '@/components/ui/ExitDialog.svelte';
  import CinelarLogo from '@/components/ui/CinelarLogo.svelte';
  import {  svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { toastStore } from '@/stores/toastStore';
  import { getExplore } from '@/features/content/explore';
  import { resolveImageUrl, isBackKey, resolveBackdrop, resolvePoster } from '@/utils/helpers';
  import { syncContinueWatching, syncRecommendations, exitApp, type AndroidTvHomeItem } from '@/services/NativeBridge';
  import { setFocus, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import type { ContentItem, ExploreResponse } from '@/types/content';

  let data = $state<ExploreResponse | null>(null);
  let loading = $state(true);
  let error = $state(false);
  let showExitDialog = $state(false);
  let heroImmersive = $state(false);

  const tokens = $derived($svelteAuthStore.tokens);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);

  function progressPercent(item: ContentItem): number {
    if (!item.progress || !item.duration) return 0;
    return Math.min(100, Math.round((item.progress / item.duration) * 100));
  }

  async function fetchData() {
    error = false;
    loading = true;
    try {
      const explore = await getExplore(tokens?.accessToken, {
        include_trailers: true,
        img_variants: ['xlarge', 'large', 'medium'],
      });
      data = explore;
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
    push(`/watch/${item.id}`);
  }

  function handleInfo(item: ContentItem) {
    push(`/content/${item.id}`);
  }

  const bannerItems = $derived(data?.banner_content ?? []);
  const firstRowId = $derived(data?.content?.[0]?.content?.[0]?.id);
  const firstRowFocusKey = $derived(firstRowId != null ? `home-row-0-item-${firstRowId}` : undefined);
  const preferredChildFocusKey = $derived(bannerItems.length > 0 ? 'hero-section' : 'home-row-0');

  function focusHeroFromFirstRow(direction: string) {
    if (direction !== 'up' || bannerItems.length === 0) return true;
    setFocus('hero-view-more');
    return false;
  }

  function focusSidebarFromRowStart(direction: string) {
    if (direction !== 'left') return true;
    setFocus('sidebar');
    return false;
  }

  function isSidebarFocused(): boolean {
    const key = getCurrentFocusKey();
    return Boolean(key && (key === 'sidebar' || key.startsWith('nav-')));
  }

  $effect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const currentKey = getCurrentFocusKey();
      if (currentKey && doesFocusableExist(currentKey)) return;
      e.preventDefault();
      setFocus(loading || error ? 'sidebar' : 'home-root');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  $effect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.preventDefault();
        if (showExitDialog) {
          showExitDialog = false;
          return;
        }
        if (isSidebarFocused()) {
          showExitDialog = true;
        } else {
          setFocus('sidebar');
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
  class="w-full h-dvh hide-scrollbar transition-all duration-700 {heroImmersive ? 'overflow-hidden' : 'overflow-y-auto'}"
>
  <CinelarLogo class="fixed top-[clamp(1rem,3vh,1.5rem)] right-[clamp(1.5rem,4vw,2rem)] text-white h-[clamp(1.5rem,2vw,2rem)] z-[999]" />

  {#if loading}
    <div class="w-full h-full flex flex-col bg-bg">
      <div class="w-full h-[clamp(360px,70vh,680px)] bg-surface animate-pulse-slow"></div>
      <div class="px-[clamp(3rem,7.5vw,6rem)] py-[clamp(1.25rem,4vh,2rem)] space-y-[clamp(1.5rem,4vh,2rem)]">
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
    {#if bannerItems.length > 0}
      <HeroSection
        items={bannerItems}
        onPlay={handlePlay}
        onInfo={handleInfo}
        {clientEndpoint}
        {firstRowFocusKey}
        sidebarFocusKey="sidebar"
        onImmersiveChange={(imm) => { heroImmersive = imm; }}
      />
    {/if}

<div
  class="relative z-10 h-[clamp(14rem,24vh,20rem)] -mt-[clamp(6rem,9vh,7rem)] -mb-[clamp(6rem,12vh,10rem)] bg-gradient-to-b from-transparent via-bg via-bg/70 to-bg/10 pointer-events-none transition-opacity duration-700 {heroImmersive ? 'opacity-0' : ''}"
></div>
    <div class="relative z-10 pb-[clamp(3rem,8vh,4rem)] transition-all duration-700 will-change-opacity {heroImmersive ? 'opacity-0 pointer-events-none' : ''}">
      {#each data?.content ?? [] as category, catIdx (catIdx)}
        {@const preferredChild = category.content?.[0]?.id != null ? `home-row-${catIdx}-item-${category.content[0].id}` : undefined}

        <FocusableRow
          title={category.title}
          focusKey="home-row-{catIdx}"
          preferredChildFocusKey={preferredChild}
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
                if (itemIdx === 0 && direction === 'left') return focusSidebarFromRowStart(direction);
                return true;
              }}
              onEnterPress={() => handleInfo(item)}
              playSound={true}
            />
          {/each}
        </FocusableRow>
      {/each}
    </div>
  {/if}
</FocusContainer>

{#if showExitDialog}
  <ExitDialog
    onConfirm={() => exitApp()}
    onCancel={() => { showExitDialog = false; }}
  />
{/if}
