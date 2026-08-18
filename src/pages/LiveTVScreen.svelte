<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import FocusableRow from '@/components/tv/FocusableRow.svelte';
  import ChannelCardEpg from '@/components/tv/ChannelCardEpg.svelte';
  import NowAndNextRow from '@/components/tv/NowAndNextRow.svelte';
  import EpgProgressBar from '@/components/tv/EpgProgressBar.svelte';
  import { svelteAuthStore } from '@/stores/authStore';
  import { svelteLiveTvFavoritesStore, liveTvFavoritesStore } from '@/stores/liveTvFavoritesStore';
  import { getApiConfig } from '@/api/client';
  import { supportsLiveTV, playLiveChannel, type LiveChannelInfo } from '@/services/NativeBridge';
  import { getLiveTvChannels, type LiveTvChannel } from '@/api/live';
  import { isBackKey } from '@/utils/helpers';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import { Tv, RefreshCw, Search, X, Play, Clock } from '@lucide/svelte';

  interface Props {
    geoblockedSidebarKey?: string;
  }

  let { geoblockedSidebarKey }: Props = $props();

  let channels = $state<LiveTvChannel[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchOpen = $state(false);
  let searchQuery = $state('');
  let scrollContainerEl = $state<HTMLDivElement | null>(null);
  let activeCategory = $state<string>('Todos');

  const nativeSupported = supportsLiveTV();
  const tokens = $derived($svelteAuthStore.tokens);
  const favorites = $derived($svelteLiveTvFavoritesStore.favorites);

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function channelCategory(c: LiveTvChannel): string {
    return c.current_program?.category || 'Otros';
  }

  async function fetchChannels() {
    loading = true;
    error = null;
    try {
      const data = await getLiveTvChannels(tokens?.accessToken);
      channels = data;
    } catch {
      error = 'No se pudieron cargar los canales.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (nativeSupported) {
      fetchChannels();
    }
  });

  $effect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.preventDefault();
        if (searchOpen) {
          searchOpen = false;
          searchQuery = '';
        } else {
          push('/home');
        }
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  });

  const isGuideView = $derived(activeCategory === 'Guía');

  const filteredChannels = $derived.by(() => {
    let result = channels;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.current_program?.title.toLowerCase().includes(q),
      );
    }
    if (!isGuideView && activeCategory !== 'Todos') {
      if (activeCategory === 'Favoritos') {
        result = result.filter((c) => favorites.has(c.id));
      } else {
        result = result.filter((c) => channelCategory(c) === activeCategory);
      }
    }
    return result;
  });

  const categories = $derived.by(() => {
    const cats = new Set<string>();
    for (const ch of channels) {
      cats.add(channelCategory(ch));
    }
    return ['Todos', 'Guía', 'Favoritos', ...Array.from(cats).sort()];
  });

  const favoriteChannels = $derived(channels.filter((c) => favorites.has(c.id)));

  const nowPlayingChannels = $derived(
    channels.filter((c) => c.current_program && favorites.has(c.id)).slice(0, 10),
  );

  const channelsByCategory = $derived.by(() => {
    const map = new Map<string, LiveTvChannel[]>();
    for (const ch of filteredChannels) {
      const cat = channelCategory(ch);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ch);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  });

  $effect(() => {
    if (channels.length > 0 && !searchOpen) {
      setTimeout(() => {
        if (doesFocusableExist('live-cat-Todos')) {
          setFocus('live-cat-Todos');
        }
      }, 50);
    }
  });

  let rafId = 0;

  function scrollFollow(node: HTMLElement) {
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focused = node.querySelector<HTMLElement>('[data-focused="true"]');
        if (focused) {
          focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    });
    observer.observe(node, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });
    return { destroy() { observer.disconnect(); cancelAnimationFrame(rafId); } };
  }

  function handlePlayChannel(channel: LiveTvChannel) {
    const { CLIENT_ENDPOINT } = getApiConfig();
    const info: LiveChannelInfo = {
      id: channel.id,
      name: channel.name,
      url: channel.stream_url,
      logo: channel.logo_url,
      accessToken: tokens?.accessToken,
      clientEndpoint: CLIENT_ENDPOINT,
    };
    playLiveChannel(info);
  }
</script>

<FocusContainer
  focusKey="livetv-root"
  focusable={false}
  preferredChildFocusKey="live-cat-Todos"
  trackChildren={true}
  saveLastFocusedChild={true}
  class="w-full h-dvh flex flex-col bg-bg"
>
  {#if !nativeSupported}
    <div class="w-full h-dvh flex flex-col items-center justify-center bg-bg px-[clamp(3rem,7.5vw,6rem)]">
      <div class="flex flex-col items-center text-center max-w-[clamp(280px,40vw,500px)]">
        <div class="w-[clamp(4rem,8vw,6rem)] h-[clamp(4rem,8vw,6rem)] rounded-full bg-surface flex items-center justify-center mb-[clamp(1.5rem,3vh,2.5rem)]">
          <Tv class="w-[clamp(1.75rem,3.5vw,2.5rem)] h-[clamp(1.75rem,3.5vw,2.5rem)] text-text-secondary" />
        </div>
        <h1 class="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-semibold mb-[clamp(0.75rem,1.5vh,1rem)]">
          TV en Vivo
        </h1>
        <p class="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)] leading-relaxed mb-[clamp(2rem,4vh,3rem)]">
          La funcionalidad de TV en vivo no está disponible para este dispositivo.
        </p>
        <Focusable
          focusKey="livetv-back"
          onEnterPress={() => push('/home')}
          focusedClass="!bg-white !text-black"
          class="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center justify-center cursor-pointer"
          playSound={true}
        >
          {#snippet children()}
            Volver al inicio
          {/snippet}
        </Focusable>
      </div>
    </div>
  {:else if loading}
    <div class="w-full h-dvh flex flex-col bg-bg">
      <div class="px-[clamp(3rem,7.5vw,6rem)] pt-[clamp(1.5rem,3vh,3rem)] pb-4 shrink-0">
        <div class="w-full h-[clamp(200px,30vh,320px)] rounded-3xl bg-surface"></div>
      </div>
      <div class="flex-1 px-[clamp(3rem,7.5vw,6rem)] space-y-6 overflow-hidden">
        {#each [1, 2] as i (i)}
          <div>
            <div class="w-32 h-4 bg-surface rounded mb-3"></div>
            <div class="flex gap-4">
              {#each [1, 2, 3, 4] as j (j)}
                <div class="shrink-0 w-[clamp(160px,14vw,200px)] h-[clamp(200px,22vh,260px)] rounded-2xl bg-surface"></div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if error}
    <div class="w-full h-dvh flex flex-col items-center justify-center bg-bg px-[clamp(3rem,7.5vw,6rem)]">
      <p class="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)] mb-[clamp(1.5rem,3vh,2rem)]">
        {error}
      </p>
      <Focusable
        focusKey="livetv-retry"
        onEnterPress={fetchChannels}
        focusedClass="!bg-white !text-black"
        class="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center gap-2 cursor-pointer"
        playSound={true}
      >
        {#snippet children()}
          <RefreshCw class="w-4 h-4" />
          Reintentar
        {/snippet}
      </Focusable>
    </div>
  {:else if channels.length === 0}
    <div class="w-full h-dvh flex flex-col items-center justify-center bg-bg">
      <Tv class="w-16 h-16 text-text-tertiary mb-4" />
      <p class="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)]">
        No hay canales disponibles en este momento.
      </p>
    </div>
  {:else}
    <!-- Header -->
    <div class="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(3rem,7.5vw,6rem)] pt-[calc(var(--topnav-h)+1.5rem)] pb-[clamp(0.5rem,1vh,0.75rem)] shrink-0">
      <div class="w-[clamp(2rem,3.5vw,3rem)] h-[clamp(2rem,3.5vw,3rem)] rounded-full bg-surface flex items-center justify-center shrink-0">
        <Tv class="w-[clamp(1rem,1.5vw,1.25rem)] h-[clamp(1rem,1.5vw,1.25rem)] text-accent-light" />
      </div>
      <div class="flex-1 min-w-0">
        <h1 class="text-white text-[clamp(1.25rem,2.5vw,1.75rem)] font-bold">
          TV en Vivo
        </h1>
        <p class="text-text-secondary text-[clamp(0.7rem,0.9vw,0.8rem)]">
          {filteredChannels.length} {filteredChannels.length === 1 ? 'canal' : 'canales'} disponibles
        </p>
      </div>

      {#if !searchOpen}
        <Focusable
          focusKey="live-search-toggle"
          onEnterPress={() => { searchOpen = true; }}
          onArrowPress={(direction) => {
            if (direction === 'down') {
              setFocus('live-cat-Todos');
              return false;
            }
            if (direction === 'up') {
              setFocus('topnav');
              return false;
            }
            return true;
          }}
          focusedClass="!bg-white !text-black"
          class="w-[clamp(2rem,3.5vh,2.5rem)] h-[clamp(2rem,3.5vh,2.5rem)] rounded-full bg-surface flex items-center justify-center cursor-pointer shrink-0"
          playSound={true}
        >
          {#snippet children()}
            <Search class="w-4 h-4 text-text-secondary" />
          {/snippet}
        </Focusable>
      {:else}
        <div class="flex items-center gap-2 bg-surface rounded-full px-4 h-[clamp(2rem,3.5vh,2.5rem)] border border-white/10">
          <Search class="w-4 h-4 text-text-secondary shrink-0" />
          <input
            bind:value={searchQuery}
            placeholder="Buscar canal..."
            class="bg-transparent text-white text-[clamp(0.8rem,1.1vw,0.9rem)] outline-none w-[clamp(120px,18vw,220px)]"
          />
          <button type="button" onclick={() => { searchOpen = false; searchQuery = ''; }}>
            <X class="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      {/if}
    </div>

    <!-- Category filter bar -->
    <div class="px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(0.5rem,1vh,0.75rem)] shrink-0">
      <FocusContainer
        focusKey="live-categories"
        focusable={false}
        trackChildren={true}
        saveLastFocusedChild={true}
        preferredChildFocusKey="live-cat-Todos"
      >
        <div class="flex gap-2 overflow-x-auto hide-scrollbar py-1">
          {#each categories as cat, idx (cat)}
            <Focusable
              focusKey="live-cat-{cat}"
              onEnterPress={() => { activeCategory = cat; }}
              onArrowPress={(direction) => {
                if (direction === 'up') {
                  setFocus('live-search-toggle');
                  return false;
                }
                if (direction === 'down') {
                  if (isGuideView) {
                    const firstGuide = filteredChannels[0];
                    if (firstGuide && doesFocusableExist('guide-ch-' + firstGuide.id)) {
                      setFocus('guide-ch-' + firstGuide.id);
                    }
                  } else {
                    const firstCard = filteredChannels[0];
                    if (firstCard && doesFocusableExist('live-ch-' + firstCard.id)) {
                      setFocus('live-ch-' + firstCard.id);
                    }
                  }
                  return false;
                }
                if (direction === 'left' && idx > 0) {
                  setFocus(`live-cat-${categories[idx - 1]}`);
                  return false;
                }
                if (direction === 'right' && idx < categories.length - 1) {
                  setFocus(`live-cat-${categories[idx + 1]}`);
                  return false;
                }
                return true;
              }}
              focusedClass="!ring-2 !ring-white !ring-offset-2 !ring-offset-bg"
              class="shrink-0 h-[clamp(1.75rem,3vh,2.25rem)] px-4 rounded-full text-[clamp(0.7rem,0.9vw,0.8rem)] font-medium flex items-center justify-center cursor-pointer transition-all {activeCategory === cat ? 'bg-white text-black' : 'bg-surface text-text-secondary'}"
              playSound={true}
            >
              {#snippet children()}
                {cat}
              {/snippet}
            </Focusable>
          {/each}
        </div>
      </FocusContainer>
    </div>

    <!-- Scrollable content -->
    {#if filteredChannels.length === 0}
      <div class="flex-1 flex flex-col items-center justify-center">
        <Search class="w-12 h-12 text-text-tertiary mb-4" />
        <p class="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)]">
          Ningún canal coincide con "{searchQuery}"
        </p>
      </div>
    {:else if isGuideView}
      <!-- EPG Guide list view -->
      <div
        bind:this={scrollContainerEl}
        class="flex-1 overflow-y-auto hide-scrollbar pb-8 px-[clamp(3rem,7.5vw,6rem)]"
        use:scrollFollow
      >
        <FocusContainer
          focusKey="guide-list"
          focusable={false}
          trackChildren={true}
          saveLastFocusedChild={true}
          preferredChildFocusKey="guide-ch-{filteredChannels[0].id}"
        >
          <div class="space-y-2">
            {#each filteredChannels as ch, idx (ch.id)}
              <Focusable
                focusKey="guide-ch-{ch.id}"
                onEnterPress={() => handlePlayChannel(ch)}
                onArrowPress={(direction) => {
                  if (direction === 'up' && idx === 0) {
                    setFocus('live-cat-Guía');
                    return false;
                  }
                  return true;
                }}
                focusedClass="!bg-white/10 !border-white/30"
                class="flex items-center gap-4 rounded-xl border border-transparent bg-surface/50 px-4 py-3 cursor-pointer transition-colors"
                playSound={true}
              >
                {#snippet children({ focused })}
                  <div class="shrink-0">
                    {#if ch.logo_url}
                      <img
                        src={ch.logo_url}
                        alt={ch.name}
                        class="w-10 h-10 object-contain"
                        loading="lazy"
                      />
                    {:else}
                      <div class="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center">
                        <Tv class="w-5 h-5 text-text-secondary" />
                      </div>
                    {/if}
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="text-white text-[clamp(0.85rem,1.1vw,0.95rem)] font-semibold truncate">
                        {ch.name}
                      </p>
                      {#if ch.current_program?.category}
                        <span class="text-[9px] font-medium uppercase tracking-wider text-accent-light bg-accent/15 rounded-full px-2 py-0.5 shrink-0">
                          {ch.current_program.category}
                        </span>
                      {/if}
                    </div>
                    {#if ch.current_program}
                      <p class="text-text-secondary text-[clamp(0.7rem,0.9vw,0.8rem)] mt-0.5 truncate">
                        {ch.current_program.title}
                      </p>
                    {/if}
                  </div>

                  <div class="shrink-0 text-right w-[clamp(100px,12vw,160px)]">
                    {#if ch.current_program}
                      <div class="flex items-center gap-1.5 justify-end mb-1">
                        <Clock class="w-3 h-3 text-accent-light shrink-0" />
                        <p class="text-accent-light text-[clamp(0.6rem,0.75vw,0.7rem)]">
                          {formatTime(ch.current_program.start_time)} – {formatTime(ch.current_program.end_time)}
                        </p>
                      </div>
                      <EpgProgressBar program={ch.current_program} size="sm" showLabel={false} />
                    {:else}
                      <p class="text-text-tertiary text-[clamp(0.6rem,0.7vw,0.65rem)]">Sin programación</p>
                    {/if}
                  </div>

                  {#if focused}
                    <div class="shrink-0 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                      <Play class="w-4 h-4 text-white ml-0.5" />
                    </div>
                  {/if}
                {/snippet}
              </Focusable>
            {/each}
          </div>
        </FocusContainer>
      </div>
    {:else}
      <div bind:this={scrollContainerEl} class="flex-1 overflow-y-auto hide-scrollbar pb-8">
        <!-- Now playing row (favorites) -->
        {#if nowPlayingChannels.length > 0 && activeCategory === 'Todos'}
          <NowAndNextRow
            channels={nowPlayingChannels}
            {favorites}
            onPlay={handlePlayChannel}
            onToggleFavorite={(id) => liveTvFavoritesStore.getState().toggleFavorite(id)}
            focusKey="live-now-next"
            onArrowUp={() => {
              if (doesFocusableExist('live-cat-Todos')) {
                setFocus('live-cat-Todos');
              }
              return false;
            }}
          />
        {/if}

        <!-- Favorites rail -->
        {#if favoriteChannels.length > 0 && activeCategory === 'Todos'}
          <FocusableRow
            title="Favoritos"
            focusKey="live-favorites"
            preferredChildFocusKey={`live-ch-${favoriteChannels[0].id}`}
          >
            {#each favoriteChannels as ch (ch.id)}
              <ChannelCardEpg
                channel={ch}
                isFavorite={true}
                onPlay={handlePlayChannel}
                onToggleFavorite={(id) => liveTvFavoritesStore.getState().toggleFavorite(id)}
                onArrowPress={(direction) => {
                  if (direction === 'up') {
                    if (doesFocusableExist('live-cat-Todos')) {
                      setFocus('live-cat-Todos');
                    }
                    return false;
                  }
                  return true;
                }}
                focusKey="live-ch-{ch.id}"
              />
            {/each}
          </FocusableRow>
        {/if}

        <!-- Category rails -->
        {#each channelsByCategory as [category, cats] (category)}
          <FocusableRow
            title={category}
            focusKey="live-catrow-{category}"
            preferredChildFocusKey="live-ch-{cats[0].id}"
          >
            {#each cats as ch (ch.id)}
              <ChannelCardEpg
                channel={ch}
                isFavorite={favorites.has(ch.id)}
                onPlay={handlePlayChannel}
                onToggleFavorite={(id) => liveTvFavoritesStore.getState().toggleFavorite(id)}
                onArrowPress={(direction) => {
                  if (direction === 'up') {
                    if (doesFocusableExist('live-cat-Todos')) {
                      setFocus('live-cat-Todos');
                    }
                    return false;
                  }
                  return true;
                }}
                focusKey="live-ch-{ch.id}"
              />
            {/each}
          </FocusableRow>
        {/each}
      </div>
    {/if}
  {/if}
</FocusContainer>
