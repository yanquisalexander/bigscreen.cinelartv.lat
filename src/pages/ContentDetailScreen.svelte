<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import FocusableButton from '@/components/tv/FocusableButton.svelte';
  import DetailHero from '@/components/detail/DetailHero.svelte';
  import DetailOverview from '@/components/detail/DetailOverview.svelte';
  import DetailSeasonSelector from '@/components/detail/DetailSeasonSelector.svelte';
  import DetailEpisodeRail from '@/components/detail/DetailEpisodeRail.svelte';
  import DetailRecommendations from '@/components/detail/DetailRecommendations.svelte';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { toastStore } from '@/stores/toastStore';
  import { getContentById, prefetchWatchData } from '@/features/content/api';
  import { showPanel, buttonItem, closePanel } from '@/services/overlayPanel';
  import { isBackKey } from '@/utils/helpers';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import type { ContentDetail } from '@/types/content';
  import { isTVShow } from '@/types/content';

  interface Props {
    params?: {
      contentId?: string;
    };
  }

  let { params }: Props = $props();
  const contentId = $derived(params?.contentId ?? '');

  let content = $state<ContentDetail | null>(null);
  let loading = $state(true);
  let selectedSeason = $state(0);
  let containerEl = $state<HTMLDivElement | null>(null);
  let prefetchTimerId: ReturnType<typeof setTimeout> | null = null;

  const tokens = $derived($svelteAuthStore.tokens);
  const isGuest = $derived($svelteAuthStore.isGuest);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);

  const seasons = $derived(content?.seasons ?? []);
  const currentEpisodes = $derived(seasons[selectedSeason]?.episodes ?? []);
  const relatedContent = $derived(content?.related_content ?? []);

  const firstEpisodeId = $derived(currentEpisodes[0]?.id);
  const firstEpisodeFocusKey = $derived(firstEpisodeId != null ? `detail-episode-${firstEpisodeId}` : undefined);
  const selectedSeasonFocusKey = $derived(
    seasons[selectedSeason]?.id != null ? `detail-season-${seasons[selectedSeason].id}` : undefined
  );

  const canPlay = $derived.by(() => {
    if (!content) return false;
    if (!isTVShow(content)) return true;
    if (content.continue_watching?.episode_id) return true;
    return (content.seasons?.[0]?.episodes?.length ?? 0) > 0;
  });

  async function fetchContent(id: string) {
    if (!id) return;
    loading = true;
    try {
      const data = await getContentById(tokens?.accessToken ?? '', id);
      content = data;
    } catch {
      content = null;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (contentId) {
      fetchContent(contentId);
    }
  });

  $effect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.preventDefault();
        window.history.back();
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  });

  $effect(() => {
    return () => {
      if (prefetchTimerId) clearTimeout(prefetchTimerId);
    };
  });

  $effect(() => {
    const el = containerEl;
    if (!el) return;

    let rafId = 0;
    const onFocusChange = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focused = el.querySelector<HTMLElement>('[data-focused="true"]');
        if (!focused) return;

        if (focused.closest('[data-focus-key^="detail-hero"]')) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const rect = focused.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        const topSafeArea = Math.min(80, window.innerHeight * 0.1);
        const bottomSafeArea = Math.min(40, window.innerHeight * 0.06);

        if (rect.top < containerRect.top + topSafeArea) {
          el.scrollBy({
            top: rect.top - containerRect.top - topSafeArea,
            behavior: 'smooth',
          });
        } else if (rect.bottom > containerRect.bottom - bottomSafeArea) {
          el.scrollBy({
            top: rect.bottom - containerRect.bottom + bottomSafeArea,
            behavior: 'smooth',
          });
        }
      });
    };

    const observer = new MutationObserver(onFocusChange);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  });

  $effect(() => {
    if (content && canPlay) {
      const id = requestAnimationFrame(() => {
        setFocus('detail-hero-play');
      });
      return () => cancelAnimationFrame(id);
    }
  });

  function showAuthPanel() {
    showPanel({
      id: 'panel-auth-required',
      title: 'Vincular cuenta',
      subtitle: 'Para mirar este contenido debes vincular una cuenta',
      items: [
        buttonItem(
          { title: 'Vincular cuenta', subtitle: 'Iniciar sesión o crear una nueva', icon: 'login', closeOnSelect: false },
          () => {
            closePanel({ restoreFocus: false });
            push('/auth');
          },
        ),
        buttonItem({ title: 'Volver', subtitle: 'Cancelar', icon: 'x' }),
      ],
    });
  }

  function handlePlay() {
    if (!content || !canPlay) return;
    if (!tokens && isGuest) {
      showAuthPanel();
      return;
    }

    const episodeId = content.continue_watching?.episode_id;
    if (episodeId) {
      push(`/watch/${content.id}/${episodeId}`);
      return;
    }

    if (!isTVShow(content)) {
      push(`/watch/${content.id}`);
      return;
    }

    const firstEpisode = content.seasons?.[0]?.episodes?.[0];
    if (firstEpisode) push(`/watch/${content.id}/${firstEpisode.id}`);
  }

  function handlePlayEpisode(episodeId: string | number) {
    if (!tokens && isGuest) {
      showAuthPanel();
      return;
    }
    push(`/watch/${contentId}/${episodeId}`);
  }

  function handlePlayEpisodeFocus(episodeId: string | number) {
    if (!tokens || !contentId) return;
    if (prefetchTimerId) clearTimeout(prefetchTimerId);
    prefetchTimerId = setTimeout(() => {
      prefetchTimerId = null;
      prefetchWatchData(tokens?.accessToken ?? '', contentId, episodeId);
    }, 4000);
  }

  function handlePlayFocus() {
    if (!content || !tokens) return;
    const episodeId = content.continue_watching?.episode_id
      ?? (isTVShow(content) ? content.seasons?.[0]?.episodes?.[0]?.id : undefined);
    if (prefetchTimerId) clearTimeout(prefetchTimerId);
    prefetchTimerId = setTimeout(() => {
      prefetchTimerId = null;
      prefetchWatchData(tokens?.accessToken ?? '', content!.id, episodeId);
    }, 4000);
  }

  function handlePlayTrailer() {
    const trailerUrl = content?.trailer_sources?.[0]?.url ?? content?.trailer_video_sources?.[0]?.url;
    if (trailerUrl) {
      push(`/watch/${content?.id}`);
    } else {
      toastStore.getState().show('Tráiler no disponible', 'info', 3000);
    }
  }

  function handleToggleList() {
    toastStore.getState().show('Esta funcionalidad aún no está implementada', 'info', 3000);
    // TODO: Implement toggle list functionality
  }

  function handleSelectRelated(item: { id: string | number }) {
    push(`/content/${item.id}`);
  }

  function focusContentTarget(targetKey?: string) {
    if (!targetKey) return true;
    setFocus(targetKey);
    return false;
  }

  function handleSeasonArrowUp(direction: string) {
    if (direction !== 'up') return true;
    return focusContentTarget('detail-hero-play');
  }

  function handleSeasonArrowDown(direction: string) {
    if (direction !== 'down') return true;
    return focusContentTarget(firstEpisodeFocusKey);
  }

  function handleEpisodeArrowUp(direction: string) {
    if (direction !== 'up') return true;
    return focusContentTarget(selectedSeasonFocusKey ?? 'detail-hero-play');
  }

  function handleEpisodeArrowLeft(direction: string) {
    if (direction !== 'left') return true;
    return true;
  }

  function handleRelatedArrowUp(direction: string) {
    if (direction !== 'up') return true;
    return focusContentTarget(firstEpisodeFocusKey ?? selectedSeasonFocusKey ?? 'detail-hero-play');
  }
</script>

{#if loading}
  <div class="w-full h-dvh bg-bg flex items-center justify-center">
    <div class="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
  </div>
{:else if !content}
  <div class="w-full h-dvh bg-bg flex flex-col items-center justify-center gap-[clamp(1rem,2.5vh,1.5rem)]">
    <div class="w-[clamp(3rem,6vh,4rem)] h-[clamp(3rem,6vh,4rem)] rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
      <span class="text-white/30 text-[clamp(1.25rem,2vh,1.5rem)] font-bold">!</span>
    </div>
    <p class="text-white/50 text-[clamp(1rem,1.6vw,1.25rem)]">Contenido no encontrado</p>
    <FocusableButton onEnterPress={() => push('/home')} autoFocus={true} playSound={true}>
      {#snippet children()}
        Volver al inicio
      {/snippet}
    </FocusableButton>
  </div>
{:else}
  <FocusContainer
    focusKey="content-root"
    focusable={false}
    preferredChildFocusKey="detail-hero-play"
    trackChildren={true}
    saveLastFocusedChild={true}
  >
    <div
      bind:this={containerEl}
      class="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg"
    >
      <!-- Hero -->
      <DetailHero
        {content}
        {clientEndpoint}
        {canPlay}
        onPlay={handlePlay}
        onPlayTrailer={handlePlayTrailer}
        onToggleList={handleToggleList}
        onNavigateDown={(dir) => {
          if (dir !== 'down') return true;
          if (seasons.length > 0) {
            return focusContentTarget(selectedSeasonFocusKey ?? firstEpisodeFocusKey);
          }
          return true;
        }}
        onNavigateLeft={() => true}
        onNavigateUp={() => { setFocus('topnav'); return false; }}
        onPlayFocus={handlePlayFocus}
        {firstEpisodeFocusKey}
        firstSeasonFocusKey={selectedSeasonFocusKey}
      />

      <!-- Content sections -->
      <div class="px-[clamp(2rem,5vw,6rem)] pb-[clamp(5rem,12vh,7.5rem)] flex flex-col gap-[clamp(2.5rem,6vh,4.5rem)]">
        <!-- Overview -->
        <DetailOverview
          description={content.description}
          class="pt-[clamp(1.5rem,3vh,2.5rem)]"
        />

        <!-- Seasons & Episodes -->
        {#if seasons.length > 0}
          <section>
            <div class="flex items-center gap-[clamp(1rem,2vw,1.5rem)] mb-[clamp(1.25rem,3vh,2rem)]">
              <h2 class="shrink-0 text-white font-bold tracking-tight text-[clamp(1.125rem,1.6vw,1.5rem)]">
                Episodios
              </h2>
              <div class="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent"></div>
            </div>

            <div class="mb-[clamp(1rem,2.5vh,1.5rem)]">
              <DetailSeasonSelector
                {seasons}
                selectedIndex={selectedSeason}
                onSelect={(idx) => { selectedSeason = idx; }}
                onArrowUp={handleSeasonArrowUp}
                onArrowDown={handleSeasonArrowDown}
              />
            </div>

            {#if currentEpisodes.length > 0}
              <DetailEpisodeRail
                episodes={currentEpisodes}
                seasonIndex={selectedSeason}
                preferredChildFocusKey={firstEpisodeFocusKey}
                onPlayEpisode={handlePlayEpisode}
                onFocusEpisode={handlePlayEpisodeFocus}
                onArrowUp={handleEpisodeArrowUp}
                onArrowLeft={handleEpisodeArrowLeft}
              />
            {/if}
          </section>
        {/if}

        <!-- Recommendations -->
        {#if relatedContent.length > 0}
          <section>
            <div class="flex items-center gap-[clamp(1rem,2vw,1.5rem)] mb-[clamp(1.25rem,3vh,2rem)]">
              <h2 class="shrink-0 text-white font-bold tracking-tight text-[clamp(1.125rem,1.6vw,1.5rem)]">
                También te puede gustar
              </h2>
              <div class="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent"></div>
            </div>

            <DetailRecommendations
              items={relatedContent}
              onSelect={handleSelectRelated}
              onArrowUp={handleRelatedArrowUp}
            />
          </section>
        {/if}
      </div>
    </div>
  </FocusContainer>
{/if}
