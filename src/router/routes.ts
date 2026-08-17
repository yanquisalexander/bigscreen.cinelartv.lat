import wrap from 'svelte-spa-router/wrap';

import { authStore } from '@/stores/authStore';
import type { RouteDetail } from 'svelte-spa-router';

// Eager: lightweight screens always needed
import BootScreen from '@/pages/BootScreen.svelte';
import AuthScreen from '@/pages/AuthScreen.svelte';
import BlockedScreen from '@/pages/BlockedScreen.svelte';
import FallbackScreen from '@/pages/FallbackScreen.svelte';
import ProfileSelectScreen from '@/pages/ProfileSelectScreen.svelte';
import HomeScreen from '@/pages/HomeScreen.svelte';
import SearchScreen from '@/pages/SearchScreen.svelte';
import SettingsScreen from '@/pages/SettingsScreen.svelte';

const GUEST_ALLOWED_PATHS = ['/home', '/search', '/live'];
const GUEST_BLOCKED_PREFIXES = ['/watch', '/select-profile'];

function isGuestAllowed(pathname: string): boolean {
  if (GUEST_ALLOWED_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/content/')) return true;
  return !GUEST_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));
}

function requireAuth(_detail: RouteDetail): boolean {
  const state = authStore.getState();
  if (!state.isReady) return false;
  if (state.isGuest) return false;
  return state.isAuthenticated && !!state.selectedProfile;
}

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
    component: HomeScreen,
    conditions: [requireAuthOrGuest],
  }),

  '/search': wrap({
    component: SearchScreen,
    conditions: [requireAuthOrGuest],
  }),

  '/live': wrap({
    asyncComponent: () => import('@/pages/LiveTVScreen.svelte'),
    conditions: [requireAuthOrGuest],
  }),

  '/settings': wrap({
    component: SettingsScreen,
    conditions: [requireAuth],
  }),

  '/content/:contentId': wrap({
    asyncComponent: () => import('@/pages/ContentDetailScreen.svelte'),
    conditions: [requireAuthOrGuest],
  }),

  '/watch/:contentId': wrap({
    asyncComponent: () => import('@/pages/WatchScreen.svelte'),
    conditions: [requireAuth],
  }),

  '/watch/:contentId/:episodeId': wrap({
    asyncComponent: () => import('@/pages/WatchScreen.svelte'),
    conditions: [requireAuth],
  }),

  '*': FallbackScreen,
};

export const geoBlockedRoutes = {
  '/live': () => import('@/pages/LiveTVScreen.svelte'),
  '*': () => import('@/pages/LiveTVScreen.svelte'),
};
