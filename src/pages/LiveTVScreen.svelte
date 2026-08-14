<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import FocusableRow from '@/components/tv/FocusableRow.svelte';
  import { svelteAuthStore } from '@/stores/authStore';
  import { svelteLiveTvFavoritesStore, liveTvFavoritesStore } from '@/stores/liveTvFavoritesStore';
  import { getApiConfig } from '@/api/client';
  import { supportsLiveTV, playLiveChannel, type LiveChannelInfo } from '@/services/NativeBridge';
  import { getLiveTvChannels, type LiveTvChannel } from '@/api/live';
  import { isBackKey } from '@/utils/helpers';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import { Tv, RefreshCw, Search, Star, Play, X, Clock } from '@lucide/svelte';

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
        } else if (geoblockedSidebarKey) {
          setFocus(geoblockedSidebarKey);
        } else {
          push('/home');
        }
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  });

  const filteredChannels = $derived.by(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.trim().toLowerCase();
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.current_program?.title.toLowerCase().includes(q),
    );
  });

  const favoriteChannels = $derived(filteredChannels.filter((c) => favorites.has(c.id)));

  const featuredChannel = $derived(
    favoriteChannels.length > 0 ? favoriteChannels[0] : filteredChannels[0] ?? null
  );

  const channelsByCategory = $derived.by(() => {
    const map = new Map<string, LiveTvChannel[]>();
    for (const ch of filteredChannels) {
      if (ch.id === featuredChannel?.id) continue;
      const cat = channelCategory(ch);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ch);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  });

  $effect(() => {
    if (channels.length > 0 && !searchOpen) {
      setTimeout(() => {
        setFocus('live-hero-play');
      }, 50);
    }
  });

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

  function focusSidebar() {
    setFocus(geoblockedSidebarKey ?? 'sidebar');
  }

  function handleHeroFocus() {
    setFocus('live-hero-play');
    requestAnimationFrame(() => {
      scrollContainerEl?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
</script>

<FocusContainer
  focusKey="livetv-root"
  focusable={false}
  preferredChildFocusKey="live-hero-play"
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
          onEnterPress={() => {
            if (geoblockedSidebarKey) {
              setFocus(geoblockedSidebarKey);
            } else {
              push('/home');
            }
          }}
          onArrowPress={(direction) => {
            if (direction !== 'left') return true;
            focusSidebar();
            return false;
          }}
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
        <div class="w-full h-[clamp(300px,45vh,500px)] rounded-3xl bg-surface"></div>
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
        onArrowPress={(direction) => {
          if (direction !== 'left') return true;
          focusSidebar();
          return false;
        }}
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
    <div class="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(3rem,7.5vw,6rem)] pt-[clamp(1.5rem,3vh,3rem)] pb-[clamp(0.75rem,1.5vh,1rem)] shrink-0">
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
          onEnterPress={() => {
            searchOpen = true;
            requestAnimationFrame(() => {
              const first = filteredChannels[0];
              if (first && doesFocusableExist('live-ch-' + first.id)) {
                setFocus('live-ch-' + first.id);
              }
            });
          }}
          onArrowPress={(direction) => {
            if (direction === 'down') {
              setFocus('live-hero-play');
              return false;
            }
            if (direction === 'left') {
              focusSidebar();
              return false;
            }
            return direction !== 'up';
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

    <!-- Scrollable content -->
    {#if filteredChannels.length === 0}
      <div class="flex-1 flex flex-col items-center justify-center">
        <Search class="w-12 h-12 text-text-tertiary mb-4" />
        <p class="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)]">
          Ningún canal coincide con "{searchQuery}"
        </p>
      </div>
    {:else}
      <div bind:this={scrollContainerEl} class="flex-1 overflow-y-auto hide-scrollbar pb-8">
        <!-- Hero -->
        {#if featuredChannel}
          <div class="px-0 pt-2 pb-6">
            <div class="relative w-full h-[clamp(300px,45vh,500px)] shrink-0 overflow-hidden rounded-3xl mx-auto max-w-[calc(100%-6rem)]">
              <div class="absolute inset-0 bg-gradient-to-br from-accent/30 via-surface to-bg"></div>
              <div class="absolute inset-0 flex items-center gap-[clamp(2rem,5vw,5rem)] px-[clamp(2rem,5vw,4rem)]">
                <!-- Channel Logo -->
                <div class="shrink-0">
                  {#if featuredChannel.logo_url}
                    <img
                      src={featuredChannel.logo_url}
                      alt={featuredChannel.name}
                      class="w-[clamp(5rem,10vw,9rem)] h-[clamp(5rem,10vw,9rem)] object-contain"
                    />
                  {:else}
                    <div class="w-[clamp(5rem,10vw,9rem)] h-[clamp(5rem,10vw,9rem)] rounded-2xl bg-surface-elevated flex items-center justify-center">
                      <Tv class="w-12 h-12 text-text-secondary" />
                    </div>
                  {/if}
                </div>

                <!-- Channel Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="flex items-center gap-1.5 bg-live/90 rounded-full px-2.5 py-1">
                      <span class="text-white text-[10px] font-bold uppercase tracking-wider">
                        En vivo
                      </span>
                    </div>
                    <button
                      type="button"
                      tabindex={-1}
                      onclick={(e) => {
                        e.stopPropagation();
                        liveTvFavoritesStore.getState().toggleFavorite(featuredChannel.id);
                      }}
                      class="p-1"
                    >
                      <Star
                        class="w-5 h-5 {favorites.has(featuredChannel.id) ? 'fill-accent text-accent' : 'text-white/40'}"
                      />
                    </button>
                  </div>

                  <h2 class="text-white text-[clamp(1.5rem,3vw,2.5rem)] font-bold leading-tight mb-1">
                    {featuredChannel.name}
                  </h2>

                  {#if featuredChannel.current_program}
                    <div class="mb-4">
                      <p class="text-white text-[clamp(1rem,1.8vw,1.35rem)] font-medium">
                        {featuredChannel.current_program.title}
                      </p>
                      <div class="flex items-center gap-2 mt-1">
                        <Clock class="w-3.5 h-3.5 text-accent-light" />
                        <p class="text-accent-light text-[clamp(0.75rem,1vw,0.9rem)]">
                          {formatTime(featuredChannel.current_program.start_time)} – {formatTime(featuredChannel.current_program.end_time)}
                        </p>
                      </div>
                      {#if featuredChannel.current_program.description}
                        <p class="text-text-secondary text-[clamp(0.75rem,1vw,0.9rem)] mt-2 line-clamp-2 max-w-[500px]">
                          {featuredChannel.current_program.description}
                        </p>
                      {/if}
                    </div>
                  {/if}

                  <Focusable
                    focusKey="live-hero-play"
                    onEnterPress={() => handlePlayChannel(featuredChannel)}
                    onArrowPress={(direction) => {
                      if (direction === 'left') {
                        focusSidebar();
                        return false;
                      }
                      if (direction === 'down') {
                        const firstChannel = filteredChannels.find((c) => c.id !== featuredChannel?.id);
                        if (firstChannel && doesFocusableExist('live-ch-' + firstChannel.id)) {
                          setFocus('live-ch-' + firstChannel.id);
                          return false;
                        }
                      }
                      return true;
                    }}
                    focusedClass="!bg-white !text-black"
                    class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 text-white text-[clamp(0.875rem,1.2vw,1rem)] font-semibold border border-white/20 cursor-pointer"
                    playSound={true}
                  >
                    {#snippet children()}
                      <Play class="w-5 h-5" />
                      Ver ahora
                    {/snippet}
                  </Focusable>
                </div>
              </div>

              {#if featuredChannel.upcoming_programs && featuredChannel.upcoming_programs.length > 0}
                <div class="absolute bottom-0 left-0 right-0 px-[clamp(2rem,5vw,4rem)] pb-4">
                  <p class="text-text-secondary text-[10px] uppercase tracking-widest mb-2 font-semibold">
                    Siguiente
                  </p>
                  <div class="flex gap-3">
                    {#each featuredChannel.upcoming_programs.slice(0, 3) as prog (prog.id)}
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="text-accent-light text-[clamp(0.65rem,0.8vw,0.75rem)] shrink-0">
                          {formatTime(prog.start_time)}
                        </span>
                        <span class="text-text-secondary text-[clamp(0.65rem,0.8vw,0.75rem)] truncate">
                          {prog.title}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Favorites rail -->
        {#if favoriteChannels.length > 1}
          <FocusableRow
            title="Favoritos"
            focusKey="live-favorites"
            preferredChildFocusKey={favoriteChannels[1] ? `live-ch-${favoriteChannels[1].id}` : undefined}
          >
            {#each favoriteChannels.slice(1) as ch, idx (ch.id)}
              <Focusable
                focusKey="live-ch-{ch.id}"
                onEnterPress={() => handlePlayChannel(ch)}
                onArrowPress={(direction) => {
                  if (direction === 'left' && idx === 0) {
                    focusSidebar();
                    return false;
                  }
                  if (direction === 'up') {
                    handleHeroFocus();
                    return false;
                  }
                  return true;
                }}
                focusedClass="!border-white/40"
                class="shrink-0 w-[clamp(160px,14vw,200px)] h-[clamp(200px,22vh,260px)] rounded-2xl overflow-hidden snap-start flex flex-col items-center justify-center gap-3 p-4 relative bg-surface border-2 border-transparent cursor-pointer"
                playSound={true}
              >
                {#snippet children()}
                  <button
                    type="button"
                    tabindex={-1}
                    onclick={(e) => {
                      e.stopPropagation();
                      liveTvFavoritesStore.getState().toggleFavorite(ch.id);
                    }}
                    class="absolute top-3 right-3 p-1 z-10"
                  >
                    <Star class="w-5 h-5 fill-accent text-accent" />
                  </button>

                  {#if ch.logo_url}
                    <img
                      src={ch.logo_url}
                      alt={ch.name}
                      class="w-[clamp(3.5rem,5vw,4.5rem)] h-[clamp(3.5rem,5vw,4.5rem)] object-contain shrink-0"
                      loading="lazy"
                    />
                  {:else}
                    <div class="w-[clamp(3.5rem,5vw,4.5rem)] h-[clamp(3.5rem,5vw,4.5rem)] rounded-xl bg-surface-elevated flex items-center justify-center shrink-0">
                      <Tv class="w-6 h-6 text-text-secondary" />
                    </div>
                  {/if}

                  <p class="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold text-center leading-tight line-clamp-2">
                    {ch.name}
                  </p>

                  {#if ch.current_program}
                    <div class="text-center">
                      <p class="text-accent-light text-[clamp(0.65rem,0.8vw,0.75rem)] font-medium">
                        {formatTime(ch.current_program.start_time)} – {formatTime(ch.current_program.end_time)}
                      </p>
                      <p class="text-text-secondary text-[clamp(0.65rem,0.8vw,0.75rem)] mt-0.5 line-clamp-2 max-w-[140px]">
                        {ch.current_program.title}
                      </p>
                    </div>
                  {/if}

                  <div class="absolute top-3 left-3 flex items-center gap-1.5 bg-live/90 rounded-full px-2 py-0.5">
                    <span class="text-white text-[9px] font-bold uppercase tracking-wider">
                      Live
                    </span>
                  </div>
                {/snippet}
              </Focusable>
            {/each}
          </FocusableRow>
        {/if}

        <!-- Category rails -->
        {#each channelsByCategory as [category, cats] (category)}
          <FocusableRow
            title={category}
            focusKey="live-cat-{category}"
            preferredChildFocusKey="live-ch-{cats[0].id}"
          >
            {#each cats as ch, idx (ch.id)}
              <Focusable
                focusKey="live-ch-{ch.id}"
                onEnterPress={() => handlePlayChannel(ch)}
                onArrowPress={(direction) => {
                  if (direction === 'left' && idx === 0) {
                    focusSidebar();
                    return false;
                  }
                  if (direction === 'up') {
                    handleHeroFocus();
                    return false;
                  }
                  return true;
                }}
                focusedClass="!border-white/40"
                class="shrink-0 w-[clamp(160px,14vw,200px)] h-[clamp(200px,22vh,260px)] rounded-2xl overflow-hidden snap-start flex flex-col items-center justify-center gap-3 p-4 relative bg-surface border-2 border-transparent cursor-pointer"
                playSound={true}
              >
                {#snippet children()}
                  <button
                    type="button"
                    tabindex={-1}
                    onclick={(e) => {
                      e.stopPropagation();
                      liveTvFavoritesStore.getState().toggleFavorite(ch.id);
                    }}
                    class="absolute top-3 right-3 p-1 z-10"
                  >
                    <Star class="w-5 h-5 {favorites.has(ch.id) ? 'fill-accent text-accent' : 'text-white/40'}" />
                  </button>

                  {#if ch.logo_url}
                    <img
                      src={ch.logo_url}
                      alt={ch.name}
                      class="w-[clamp(3.5rem,5vw,4.5rem)] h-[clamp(3.5rem,5vw,4.5rem)] object-contain shrink-0"
                      loading="lazy"
                    />
                  {:else}
                    <div class="w-[clamp(3.5rem,5vw,4.5rem)] h-[clamp(3.5rem,5vw,4.5rem)] rounded-xl bg-surface-elevated flex items-center justify-center shrink-0">
                      <Tv class="w-6 h-6 text-text-secondary" />
                    </div>
                  {/if}

                  <p class="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold text-center leading-tight line-clamp-2">
                    {ch.name}
                  </p>

                  {#if ch.current_program}
                    <div class="text-center">
                      <p class="text-accent-light text-[clamp(0.65rem,0.8vw,0.75rem)] font-medium">
                        {formatTime(ch.current_program.start_time)} – {formatTime(ch.current_program.end_time)}
                      </p>
                      <p class="text-text-secondary text-[clamp(0.65rem,0.8vw,0.75rem)] mt-0.5 line-clamp-2 max-w-[140px]">
                        {ch.current_program.title}
                      </p>
                    </div>
                  {/if}

                  <div class="absolute top-3 left-3 flex items-center gap-1.5 bg-live/90 rounded-full px-2 py-0.5">
                    <span class="text-white text-[9px] font-bold uppercase tracking-wider">
                      Live
                    </span>
                  </div>
                {/snippet}
              </Focusable>
            {/each}
          </FocusableRow>
        {/each}
      </div>
    {/if}
  {/if}
</FocusContainer>
