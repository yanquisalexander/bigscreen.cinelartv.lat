<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import FocusableCard from '@/components/tv/FocusableCard.svelte';
  import { svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { searchContent } from '@/features/content/search';
  import { resolvePoster } from '@/utils/helpers';
  import { Search, X } from '@lucide/svelte';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import type { ContentItem } from '@/types/content';
  import { isTVShow } from '@/types/content';
  import { trackSearchSubmit, trackSearchResultSelect, trackContentSelect } from '@/lib/analytics';

  const KEYBOARD_ROWS = [
    ['A', 'B', 'C', 'D', 'E', 'F'],
    ['G', 'H', 'I', 'J', 'K', 'L'],
    ['M', 'N', 'O', 'P', 'Q', 'R'],
    ['S', 'T', 'U', 'V', 'W', 'X'],
    ['Y', 'Z', '0', '1', '2', '3'],
    ['4', '5', '6', '7', '8', '9'],
  ];

  const DEBOUNCE_MS = 300;

  let query = $state('');
  let results = $state<ContentItem[]>([]);
  let loading = $state(false);
  let hasSearched = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let gridScrollEl = $state<HTMLDivElement | null>(null);
  let rafId = 0;

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

  function jumpToResults() {
    if (results.length > 0 && doesFocusableExist('search-result-0')) {
      setFocus('search-result-0');
    }
  }

  function handleKeyArrow(direction: string, rowIdx: number, row: string[], charIdx: number): boolean {
    if (direction === 'up') {
      if (rowIdx > 0) return true;
      setFocus('topnav');
      return false;
    }
    if (direction === 'right') {
      if (charIdx < row.length - 1) return true;
      jumpToResults();
      return false;
    }
    // down / left: let spatial navigation handle the rest
    return true;
  }

  function handleResultArrow(item: ContentItem, direction: string): boolean {
    if (direction === 'up') {
      // volver a la navegación de la app desde la primera fila de resultados
      const idx = results.findIndex(r => r.id === item.id);
      const cols = Math.max(2, Math.floor((window.innerWidth * 0.62) / 192));
      if (idx < cols && doesFocusableExist('topnav')) {
        setFocus('topnav');
        return false;
      }
    }
    return true;
  }

  function handleAuxArrow(direction: string): boolean {
    if (direction === 'up') {
      // volver a la última fila de letras
      return true;
    }
    if (direction === 'down') {
      jumpToResults();
      return false;
    }
    // left / right: spatial navigation hacia las letras o el grid de resultados
    return true;
  }

  // Auto-scroll the focused card into view as the user moves around the grid
  $effect(() => {
    const el = gridScrollEl;
    if (!el) return;

    const handleFocusMove = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focused = el.querySelector<HTMLElement>('[data-focused="true"]');
        if (focused) {
          focused.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      });
    };

    const observer = new MutationObserver(handleFocusMove);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  });

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
  class="w-full h-dvh overflow-hidden bg-bg px-[clamp(2rem,4vw,4rem)] pt-[calc(var(--topnav-h)+1.5rem)] pb-[clamp(1.5rem,3vh,2.5rem)]"
>
  <div class="flex gap-[clamp(2rem,4vw,4rem)] items-start h-full">
    <!-- Left: query bar + compact keyboard -->
    <div class="w-[clamp(20rem,28vw,24rem)] flex-shrink-0">
      <!-- Query bar -->
      <div class="flex items-center gap-3 mb-[clamp(1rem,2vh,1.5rem)]">
        <Search size={24} class="text-white/50 flex-shrink-0" />
        <div class="flex-1 text-white text-[clamp(1.15rem,1.6vw,1.5rem)] font-semibold tracking-wide min-h-[1.8em] border-b border-white/20 pb-1.5 break-all">
          {#if query}
            {query}
          {:else}
            <span class="text-white/25 font-normal">Buscar películas y series…</span>
          {/if}
          <span class="inline-block w-[2px] h-[1em] bg-accent ml-0.5 animate-pulse align-middle"></span>
        </div>
      </div>

      <!-- On-screen keyboard (compact) -->
      <div>
        {#each KEYBOARD_ROWS as row, rowIdx (rowIdx)}
          <div class="flex justify-center gap-[clamp(0.2rem,0.4vw,0.35rem)] mb-[clamp(0.2rem,0.4vw,0.35rem)]">
            {#each row as char, charIdx (charIdx)}
              <Focusable
                focusKey="sk-{char}"
                onEnterPress={() => handleKeyPress(char)}
                onArrowPress={(direction) => handleKeyArrow(direction, rowIdx, row, charIdx)}
                focusedClass="!bg-white !text-black scale-115"
                class="w-[clamp(1.9rem,2.8vw,2.5rem)] h-[clamp(1.9rem,2.8vw,2.5rem)] rounded-lg flex items-center justify-center text-[clamp(0.85rem,1.15vw,1.05rem)] font-semibold bg-white/15 text-white cursor-pointer select-none"
                playSound={true}
              >
                {#snippet children()}
                  {char}
                {/snippet}
              </Focusable>
            {/each}
          </div>
        {/each}

        <div class="flex justify-center">
          <div class="grid grid-cols-6 gap-[clamp(0.2rem,0.4vw,0.35rem)] w-[calc(clamp(1.9rem,2.8vw,2.5rem)*6+clamp(0.2rem,0.4vw,0.35rem)*5)]">
            <Focusable
              focusKey="sk-space"
              onEnterPress={handleSpace}
              onArrowPress={(direction) => handleAuxArrow(direction)}
              focusedClass="!bg-white !text-black scale-105"
              class="col-span-4 h-[clamp(1.9rem,2.8vw,2.5rem)] rounded-lg flex items-center justify-center text-[clamp(0.75rem,0.95vw,0.9rem)] font-medium bg-white/15 text-white/70 cursor-pointer select-none"
              playSound={true}
            >
              {#snippet children()}
                Espacio
              {/snippet}
            </Focusable>

            <Focusable
              focusKey="sk-bs"
              onEnterPress={handleBackspace}
              onArrowPress={(direction) => handleAuxArrow(direction)}
              focusedClass="!bg-white !text-black scale-105"
              class="col-span-1 h-[clamp(1.9rem,2.8vw,2.5rem)] rounded-lg flex items-center justify-center text-[clamp(0.85rem,1.15vw,1.05rem)] font-semibold bg-white/15 text-white cursor-pointer select-none"
              playSound={true}
            >
              {#snippet children()}
                ⌫
              {/snippet}
            </Focusable>

            <Focusable
              focusKey="sk-clear"
              onEnterPress={handleClear}
              onArrowPress={(direction) => handleAuxArrow(direction)}
              focusedClass="!bg-white/30 !text-white scale-105"
              class="col-span-1 h-[clamp(1.9rem,2.8vw,2.5rem)] rounded-lg flex items-center justify-center text-white/50 cursor-pointer select-none"
              playSound={true}
            >
              {#snippet children()}
                <X size={16} />
              {/snippet}
            </Focusable>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: results -->
    <div class="flex-1 min-w-0 h-full flex flex-col">
      {#if loading && hasSearched}
        <div class="flex items-center justify-center py-16 flex-1">
          <div class="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
        </div>
      {:else if !hasSearched}
        <div class="flex flex-col items-center justify-center py-16 text-center flex-1">
          <Search class="w-10 h-10 text-text-tertiary mb-4" />
          <p class="text-text-secondary text-[clamp(0.9rem,1.2vw,1.05rem)]">
            Escribe con el teclado en pantalla o las teclas del control
          </p>
          <p class="text-white/30 text-[clamp(0.7rem,0.9vw,0.8rem)] mt-1">
            Navega con las flechas y selecciona con OK
          </p>
        </div>
      {:else if results.length === 0 && query.trim()}
        <div class="text-center py-16 flex-1">
          <p class="text-white/40 text-lg">Sin resultados para "{query}"</p>
        </div>
      {:else if results.length > 0}
        <div class="flex items-baseline justify-between mb-[clamp(0.75rem,1.2vh,1rem)]">
          <h2 class="text-white text-[clamp(1rem,1.4vw,1.25rem)] font-semibold">Resultados</h2>
          <span class="text-text-secondary text-[clamp(0.7rem,1vw,0.85rem)] font-medium">
            {results.length} {results.length === 1 ? 'título' : 'títulos'}
          </span>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar px-[clamp(0.75rem,1.5vh,1.25rem)] py-[clamp(0.75rem,1.5vh,1.25rem)]">
          <FocusContainer
            focusKey="search-results"
            focusable={false}
            trackChildren={true}
            saveLastFocusedChild={true}
          >
            <div
              bind:this={gridScrollEl}
              class="flex flex-wrap justify-start gap-[clamp(0.75rem,1.2vh,1rem)] pb-2 pt-1"
            >
              {#each results as item, index (item.id)}
                <FocusableCard
                  variant="grid"
                  title={item.title}
                  image={resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint)}
                  subtitle={isTVShow(item) ? 'Serie' : undefined}
                  onEnterPress={() => handleInfo(item)}
                  onArrowPress={(direction) => handleResultArrow(item, direction)}
                  focusKey="search-result-{index}"
                  playSound={true}
                />
              {/each}
            </div>
          </FocusContainer>
        </div>
      {/if}
    </div>
  </div>
</FocusContainer>