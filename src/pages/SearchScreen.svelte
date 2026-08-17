<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import FocusableRow from '@/components/tv/FocusableRow.svelte';
  import FocusableCard from '@/components/tv/FocusableCard.svelte';
  import { svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { searchContent } from '@/features/content/search';
  import { resolveBackdrop } from '@/utils/helpers';
  import { Search, X } from '@lucide/svelte';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import type { ContentItem } from '@/types/content';
  import { isTVShow } from '@/types/content';
  import { trackSearchSubmit, trackSearchResultSelect, trackContentSelect } from '@/lib/analytics';

  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  const DEBOUNCE_MS = 300;

  let query = $state('');
  let results = $state<ContentItem[]>([]);
  let loading = $state(false);
  let hasSearched = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const tokens = $derived($svelteAuthStore.tokens);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);

  async function doSearch(q: string) {
    if (!tokens || !q.trim()) {
      results = [];
      hasSearched = false;
      return;
    }
    loading = true;
    hasSearched = true;
    try {
      const data = await searchContent(tokens.accessToken, q);
      results = data.data ?? [];
      trackSearchSubmit(q, results.length);
    } catch {
      results = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const currentQ = query;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      doSearch(currentQ);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  function handleKeyPress(char: string) {
    query += char.toLowerCase();
  }

  function handleBackspace() {
    query = query.slice(0, -1);
  }

  function handleClear() {
    query = '';
    results = [];
    hasSearched = false;
  }

  function handleSpace() {
    handleKeyPress(' ');
  }

  function handleInfo(item: ContentItem) {
    const position = results.findIndex(r => r.id === item.id);
    trackSearchResultSelect(query, item.id, position >= 0 ? position : 0);
    trackContentSelect(item.id, isTVShow(item) ? 'series' : 'movie', 'search', item.title);
    push(`/content/${item.id}`);
  }

  $effect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (['XF86Back', 'GoBack', 'BrowserBack', 'Escape', 'Back'].includes(e.key) || e.keyCode === 461 || e.keyCode === 10009) {
        e.preventDefault();
        push('/home');
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (query) {
          handleBackspace();
        } else {
          push('/home');
        }
        return;
      }
      if (e.key === 'Enter') return;
      if (e.key === ' ') {
        e.preventDefault();
        handleSpace();
        return;
      }
      if (e.key.length === 1 && /^[a-zA-Z0-9ñÑáéíóúü ]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<FocusContainer
  focusKey="search-root"
  focusable={false}
  preferredChildFocusKey="sk-A"
  trackChildren={true}
  saveLastFocusedChild={true}
  class="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg px-[clamp(2rem,4vw,4rem)] py-[clamp(1.5rem,3vh,2.5rem)]"
>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <Search size={22} class="text-white/50 flex-shrink-0" />
      <div class="flex-1 text-white text-[clamp(1.125rem,1.6vw,1.5rem)] font-semibold tracking-wide min-h-[1.8em] border-b border-white/20 pb-1.5 break-all">
        {#if query}
          {query}
        {:else}
          <span class="text-white/25 font-normal">Buscar películas y series…</span>
        {/if}
        <span class="inline-block w-[2px] h-[1em] bg-accent ml-0.5 animate-pulse align-middle"></span>
      </div>
      {#if query}
        <Focusable
          focusKey="sk-clear-btn"
          onEnterPress={handleClear}
          focusedClass="bg-white/20"
          class="w-9 h-9 rounded-full flex items-center justify-center text-white/50 flex-shrink-0"
          playSound={true}
        >
          {#snippet children()}
            <X size={18} />
          {/snippet}
        </Focusable>
      {/if}
    </div>

    <!-- On-screen keyboard -->
    <div class="space-y-1.5 mb-6">
      {#each KEYBOARD_ROWS as row, rowIdx (rowIdx)}
        <div class="flex justify-center gap-[clamp(0.2rem,0.35vw,0.4rem)]">
          {#each row as char, charIdx (char)}
            <Focusable
              focusKey="sk-{char}"
              onEnterPress={() => handleKeyPress(char)}
              onArrowPress={(direction) => {
                if (direction !== 'left' || charIdx !== 0) return true;
                setFocus('sidebar');
                return false;
              }}
              focusedClass="!bg-white !text-black scale-110"
              class="w-[clamp(2rem,2.8vw,2.8rem)] h-[clamp(2rem,2.8vw,2.8rem)] rounded-lg flex items-center justify-center text-[clamp(0.875rem,1.2vw,1.125rem)] font-semibold bg-white/15 text-white cursor-pointer select-none"
              playSound={true}
            >
              {#snippet children()}
                {char}
              {/snippet}
            </Focusable>
          {/each}
        </div>
      {/each}

      <div class="flex justify-center gap-[clamp(0.2rem,0.35vw,0.4rem)]">
        <Focusable
          focusKey="sk-space"
          onEnterPress={handleSpace}
          onArrowPress={(direction) => {
            if (direction !== 'left') return true;
            setFocus('sidebar');
            return false;
          }}
          focusedClass="!bg-white !text-black scale-105"
          class="w-[clamp(6rem,10vw,8rem)] h-[clamp(2rem,2.8vw,2.8rem)] rounded-lg flex items-center justify-center text-[clamp(0.75rem,1vw,0.875rem)] font-medium bg-white/15 text-white/70 cursor-pointer select-none"
          playSound={true}
        >
          {#snippet children()}
            Espacio
          {/snippet}
        </Focusable>

        <Focusable
          focusKey="sk-bs"
          onEnterPress={handleBackspace}
          focusedClass="!bg-white !text-black scale-105"
          class="w-[clamp(2.5rem,3.5vw,3.5rem)] h-[clamp(2rem,2.8vw,2.8rem)] rounded-lg flex items-center justify-center text-[clamp(0.875rem,1.2vw,1.125rem)] font-semibold bg-white/15 text-white cursor-pointer select-none"
          playSound={true}
        >
          {#snippet children()}
            ⌫
          {/snippet}
        </Focusable>

        <Focusable
          focusKey="sk-clear"
          onEnterPress={handleClear}
          focusedClass="!bg-white/30 !text-white scale-105"
          class="w-[clamp(3rem,4.5vw,4.5rem)] h-[clamp(2rem,2.8vw,2.8rem)] rounded-lg flex items-center justify-center text-[clamp(0.65rem,0.9vw,0.8rem)] font-semibold bg-white/15 text-white/50 cursor-pointer select-none"
          playSound={true}
        >
          {#snippet children()}
            Limpiar
          {/snippet}
        </Focusable>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
    </div>
  {/if}

  {#if !loading && hasSearched && results.length === 0 && query.trim()}
    <div class="text-center py-16">
      <p class="text-white/40 text-lg">Sin resultados para "{query}"</p>
    </div>
  {/if}

  {#if !loading && results.length > 0}
    <FocusableRow title="Resultados" focusKey="search-results">
      {#each results as item (item.id)}
        {@const image = resolveBackdrop(item.images, item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover, clientEndpoint, 'medium')}
        <FocusableCard
          title={item.title}
          {image}
          subtitle={isTVShow(item) ? 'Serie' : undefined}
          onEnterPress={() => handleInfo(item)}
          focusKey="search-result-{item.id}"
          playSound={true}
        />
      {/each}
    </FocusableRow>
  {/if}
</FocusContainer>
