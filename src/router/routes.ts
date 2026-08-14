import wrap from 'svelte-spa-router/wrap';

// Pages
import BootScreen from '@/pages/BootScreen.svelte';
import AuthScreen from '@/pages/AuthScreen.svelte';
import BlockedScreen from '@/pages/BlockedScreen.svelte';
import ProfileSelectScreen from '@/pages/ProfileSelectScreen.svelte';
import HomeScreen from '@/pages/HomeScreen.svelte';
import SearchScreen from '@/pages/SearchScreen.svelte';
import LiveTVScreen from '@/pages/LiveTVScreen.svelte';
import SettingsScreen from '@/pages/SettingsScreen.svelte';
import ContentDetailScreen from '@/pages/ContentDetailScreen.svelte';
import WatchScreen from '@/pages/WatchScreen.svelte';
import FallbackScreen from '@/pages/FallbackScreen.svelte';

// Layout wrappers
import ShellWrapper from '@/components/layout/ShellWrapper.svelte';

import { authStore } from '@/stores/authStore';
import type { RouteDetail } from 'svelte-spa-router';

const GUEST_ALLOWED_PATHS = ['/home', '/search', '/live'];
const GUEST_BLOCKED_PREFIXES = ['/watch', '/select-profile'];

function isGuestAllowed(pathname: string): boolean {
  if (GUEST_ALLOWED_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/content/')) return true;
  return !GUEST_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Returns true if the user is authenticated (or guest on allowed paths). */
function requireAuth(_detail: RouteDetail): boolean {
  const state = authStore.getState();
  if (!state.isReady) return false;
  if (state.isGuest) return false; // guests can't access protected routes
  return state.isAuthenticated && !!state.selectedProfile;
}

/** Returns true if the user is authenticated or a guest on an allowed path. */
function requireAuthOrGuest(detail: RouteDetail): boolean {
  const state = authStore.getState();
  if (!state.isReady) return false;
  if (state.isGuest) return isGuestAllowed(detail.location);
  return state.isAuthenticated;
}

function requireAuthenticated(_detail: RouteDetail): boolean {
  const state = authStore.getState();
  if (!state.isReady) return false;
  return state.isAuthenticated || state.isGuest;
}

export const routes = {
  '/': BootScreen,
  '/auth': AuthScreen,
  '/blocked': BlockedScreen,

  '/select-profile': wrap({
    component: ProfileSelectScreen,
    conditions: [requireAuthenticated],
  }),

  '/home': wrap({
    component: ShellWrapper,
    props: { component: HomeScreen },
    conditions: [requireAuthOrGuest],
  }),

  '/search': wrap({
    component: ShellWrapper,
    props: { component: SearchScreen },
    conditions: [requireAuthOrGuest],
  }),

  '/live': wrap({
    component: ShellWrapper,
    props: { component: LiveTVScreen },
    conditions: [requireAuthOrGuest],
  }),

  '/settings': wrap({
    component: ShellWrapper,
    props: { component: SettingsScreen },
    conditions: [requireAuth],
  }),

  '/content/:contentId': wrap({
    component: ShellWrapper,
    props: { component: ContentDetailScreen },
    conditions: [requireAuthOrGuest],
  }),

  '/watch/:contentId': wrap({
    component: WatchScreen,
    conditions: [requireAuth],
  }),

  '/watch/:contentId/:episodeId': wrap({
    component: WatchScreen,
    conditions: [requireAuth],
  }),

  '*': FallbackScreen,
};

export const geoBlockedRoutes = {
  '/live': LiveTVScreen,
  '*': LiveTVScreen,
};
