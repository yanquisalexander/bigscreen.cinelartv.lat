<script lang="ts">
  import { onMount } from 'svelte';
  import Router, { push, router } from 'svelte-spa-router';
  import type { RouteDetail } from 'svelte-spa-router';
  import { routes, geoBlockedRoutes } from '@/router/routes';
  import { authStore } from '@/stores/authStore';
  import { configStore } from '@/stores/configStore';
  import { siteSettingsStore } from '@/stores/siteSettingsStore';
  import { toastStore } from '@/stores/toastStore';
  import { checkCompat } from '@/services/compat';
  import { checkGeoBlock } from '@/services/geoblocking';
  import { initNativeBridgeSync } from '@/services/nativeBridgeSync';
  import { initSpatialNavigation } from '@/lib/spatial/init';
  import { trackScreenView } from '@/lib/analytics';
  import TVToast from '@/components/ui/TVToast.svelte';
  import OverlayPanelHost from '@/components/overlay/OverlayPanelHost.svelte';
  import IncompatibleBrowserScreen from '@/components/ui/IncompatibleBrowserScreen.svelte';
  import CinelarLogo from '@/components/ui/CinelarLogo.svelte';
  import GeoBlockedLayout from '@/components/layout/GeoBlockedLayout.svelte';
  import AppShell from '@/components/layout/AppShell.svelte';

  // ── Compat check (sync, before anything renders) ────────────────────────────
  const compatResult = checkCompat();

  // ── State ────────────────────────────────────────────────────────────────────
  let geoBlocked = $state(false);
  let geoCheckDone = $state(false);
  let betaToastShown = false;
  let currentPath = $state(window.location.hash.slice(1) || '/');

  // Standalone routes that don't show AppShell sidebar
  const STANDALONE_PREFIXES = ['/auth', '/blocked', '/select-profile', '/watch'];
  const isStandaloneRoute = $derived(
    currentPath === '/' || currentPath === '/auth' ||
    STANDALONE_PREFIXES.some(p => currentPath.startsWith(p))
  );

  // ── Derived from stores ──────────────────────────────────────────────────────
  const authState = $derived(authStore.getState());
  let isReady = $state(authStore.getState().isReady);
  let configLoaded = $state(configStore.getState().isLoaded);

  onMount(() => {
    // Subscribe to store changes
    const unsubAuth = authStore.subscribe((s) => {
      isReady = s.isReady;
    });

    const unsubConfig = configStore.subscribe((s) => {
      configLoaded = s.isLoaded;
    });

    // Native bridge sync
    const unsubBridge = initNativeBridgeSync();

    // Spatial navigation
    initSpatialNavigation();

    // Track screen views on route changes (hash-based)
    const handleHashChange = () => {
      const path = window.location.hash.slice(1) || '/';
      currentPath = path;
      trackScreenView(path);
    };
    window.addEventListener('hashchange', handleHashChange);
    // Track initial route
    handleHashChange();

    return () => {
      unsubAuth();
      unsubConfig();
      unsubBridge();
      window.removeEventListener('hashchange', handleHashChange);
    };
  });

  // ── Geo-block check (runs once config is loaded) ────────────────────────────
  $effect(() => {
    if (!configLoaded) return;

    let mounted = true;
    (async () => {
      try {
        const geo = await checkGeoBlock();
        if (mounted) geoBlocked = geo.blocked;
      } catch (err) {
        console.warn('checkGeoBlock failed', err);
      } finally {
        if (mounted) geoCheckDone = true;
      }
    })();

    return () => { mounted = false; };
  });

  // ── Site settings (non-blocking) ─────────────────────────────────────────────
  $effect(() => {
    if (!configLoaded) return;
    siteSettingsStore.getState().loadSettings();
  });

  // ── Beta toast ───────────────────────────────────────────────────────────────
  $effect(() => {
    if (!isReady || betaToastShown) return;
    betaToastShown = true;
    toastStore.getState().show('Gracias por probar la beta', 'info', 5000);
  });

  // ── Route guard: redirect on conditionsFailed ─────────────────────────────
  function conditionsFailed(detail: RouteDetail) {
    const path: string = detail?.location ?? '/';
    const state = authStore.getState();
    if (!state.isAuthenticated && !state.isGuest) {
      push('/auth');
    } else if (state.isAuthenticated && !state.selectedProfile) {
      push('/select-profile');
    } else {
      push('/home');
    }
  }
</script>

{#if !compatResult.compatible}
  <IncompatibleBrowserScreen result={compatResult} />
{:else if geoBlocked}
  <GeoBlockedLayout>
    <Router routes={geoBlockedRoutes} onConditionsFailed={conditionsFailed} />
  </GeoBlockedLayout>
  <OverlayPanelHost />
  <TVToast />
{:else if !isReady || !geoCheckDone}
  <div class="splash">
    <CinelarLogo class="logo" />
  </div>
{:else}
  <AppShell hideSidebar={isStandaloneRoute}>
    <Router {routes} onConditionsFailed={conditionsFailed} />
  </AppShell>
  <OverlayPanelHost />
  <TVToast />
{/if}

<style>
  .splash {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg, #0a0a0f);
  }

  .splash :global(.logo) {
    width: clamp(180px, 32vw, 280px);
    height: auto;
  }
</style>
