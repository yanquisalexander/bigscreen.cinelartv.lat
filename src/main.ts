import './services/polyfills';
import { mount } from 'svelte';
import './index.css';
import App from './App.svelte';
import { initCtvTools } from './services/ctvTools';
import { initRuntime, getRuntimeConfig } from './runtime';
import { $body } from './lib/dom-selector';
import { authStore } from '@/stores/authStore';
import { configStore } from '@/stores/configStore';
import { initAnalytics, trackAppLaunch, trackAppError } from '@/lib/analytics';

// ── Initialize stores immediately ───────────────────────────────────────────
authStore.getState().initialize();
configStore.getState().loadConfig();

// ── Runtime & CTV tools ──────────────────────────────────────────────────────
initRuntime();
initCtvTools();

// ── Analytics ────────────────────────────────────────────────────────────────
initAnalytics();
trackAppLaunch();

// ── Global error tracking ────────────────────────────────────────────────────
window.addEventListener('unhandledrejection', (e) => {
  trackAppError('unhandled_rejection', String(e.reason?.message ?? e.reason ?? 'Unknown'), e.reason?.stack);
});
window.addEventListener('error', (e) => {
  trackAppError('uncaught_error', e.message ?? 'Unknown', e.error?.stack);
});


// ── Apply quality class to body ──────────────────────────────────────────────
const runtimeConfig = getRuntimeConfig();
const { appQuality } = runtimeConfig;
$body?.classList.add(`app-quality-${appQuality.toLowerCase().replaceAll('_', '-')}`);

// ── Mount Svelte app ─────────────────────────────────────────────────────────
mount(App, { target: document.getElementById('root')! });

// ── Remove static splash once the app is mounted ────────────────────────────
document.getElementById('loading-screen')?.remove();
