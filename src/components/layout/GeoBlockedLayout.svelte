<script lang="ts">
  import type { Snippet } from 'svelte';
  import { push, router } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import ExitDialog from '@/components/ui/ExitDialog.svelte';
  import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation-core';
  import { checkGeoBlock, clearGeoCache } from '@/services/geoblocking';
  import { toastStore } from '@/stores/toastStore';
  import { exitApp } from '@/services/NativeBridge';
  import { isBackKey } from '@/utils/helpers';
  import { Tv, RefreshCw, MapPinOff } from '@lucide/svelte';
  import { SIDEBAR_FOCUS_KEY } from './geoblockedConstants';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  let sidebarFocused = $state(false);
  let retrying = $state(false);
  let showExitDialog = $state(false);

  function isSidebarFocused(): boolean {
    const key = getCurrentFocusKey();
    return Boolean(key && (key === SIDEBAR_FOCUS_KEY || key.startsWith('nav-')));
  }

  $effect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      const focused = isSidebarFocused();
      if (!showExitDialog && !focused) return;
      e.preventDefault();
      if (showExitDialog) {
        showExitDialog = false;
      } else {
        showExitDialog = true;
      }
    };

    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  });

  function focusContent(direction: string) {
    if (direction !== 'right') return true;
    setFocus('livetv-root');
    return false;
  }

  async function handleRetry() {
    if (retrying) return;
    toastStore.getState().show('Intentando verificar tu ubicación nuevamente', 'info', 3000, 'Verificando ubicación');
    retrying = true;
    try {
      await clearGeoCache();
      const geo = await checkGeoBlock();
      if (!geo.blocked) {
        window.location.href = '/';
        return;
      }
    } catch {
      // ignore
    } finally {
      retrying = false;
    }
  }

  const collapsed = $derived(!sidebarFocused);
  const isActive = $derived(router.location === '/live');
  const itemBaseClasses = 'flex h-11 items-center gap-3 rounded-md text-sm font-medium';
</script>

<div
  class="grid h-dvh overflow-hidden bg-bg"
  style="grid-template-columns: {sidebarFocused ? 'var(--sidebar-w, 200px) 1fr' : 'var(--sidebar-w-collapsed, 72px) 1fr'}; grid-template-areas: 'sidebar main';"
>
  <FocusContainer
    focusKey={SIDEBAR_FOCUS_KEY}
    preferredChildFocusKey="nav-live"
    trackChildren={true}
    saveLastFocusedChild={true}
    onUpdateHasFocusedChild={(f) => { sidebarFocused = f; }}
    class="relative h-full w-full flex flex-col py-4 bg-bg {collapsed ? 'px-0' : 'px-2'}"
  >
    <aside style="grid-area: sidebar;" class="h-full w-full flex flex-col">
      <nav class="flex-1 flex flex-col gap-1 justify-center">
        <Focusable
          focusKey="nav-live"
          onEnterPress={() => push('/live')}
          onArrowPress={focusContent}
          focusedClass="!bg-white !text-black border-transparent"
          class="{itemBaseClasses} {collapsed ? 'justify-center px-0' : 'justify-start px-3'} {isActive ? 'text-white border-l-2 border-accent' : 'text-white/55 border-l-2 border-transparent'}"
          playSound={true}
        >
          {#snippet children()}
            <span class="w-6 flex items-center justify-center flex-shrink-0">
              <Tv class="w-5 h-5" />
            </span>
            <span
              class="truncate whitespace-nowrap"
              style="display: {sidebarFocused ? 'block' : 'none'};"
            >
              TV en Vivo
            </span>
          {/snippet}
        </Focusable>
      </nav>

      <div class="flex flex-col gap-1 pt-2 mt-2 border-t border-white/10">
        <Focusable
          focusKey="nav-retry"
          onEnterPress={handleRetry}
          onArrowPress={focusContent}
          focusedClass="!bg-white !text-black border-transparent"
          class="{itemBaseClasses} {collapsed ? 'justify-center px-0' : 'justify-start px-3'} text-white/55 border-l-2 border-transparent"
          playSound={true}
        >
          {#snippet children()}
            <span class="w-6 flex items-center justify-center flex-shrink-0">
              {#if retrying}
                <RefreshCw class="w-5 h-5 animate-spin" />
              {:else}
                <MapPinOff class="w-5 h-5" />
              {/if}
            </span>
            <span
              class="truncate whitespace-nowrap"
              style="display: {sidebarFocused ? 'block' : 'none'};"
            >
              Verificar ubicación
            </span>
          {/snippet}
        </Focusable>
      </div>
    </aside>
  </FocusContainer>

  <main class="h-full w-full overflow-hidden" style="grid-area: main;">
    {@render children?.()}
  </main>
</div>

{#if showExitDialog}
  <ExitDialog
    onConfirm={() => exitApp()}
    onCancel={() => { showExitDialog = false; }}
  />
{/if}
