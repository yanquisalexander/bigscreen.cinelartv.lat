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

// ── Dev: mock CinelarNative bridge ───────────────────────────────────────────
if (import.meta.env.DEV) {
  const native = (window as Record<string, unknown>).CinelarNative as Record<string, unknown> | undefined ?? {};
  (window as Record<string, unknown>).CinelarNative = {
    ...native,
    getPlatform: (native.getPlatform as (() => string) | undefined) ?? (() => 'web'),
    getAppVersion: (native.getAppVersion as (() => string) | undefined) ?? (() => '0.0.0'),
    getDeviceModel: (native.getDeviceModel as (() => string) | undefined) ?? (() => 'Desktop'),
    getDeviceName: (native.getDeviceName as (() => string) | undefined) ?? (() => navigator.userAgent),
    getModel: (native.getModel as (() => string) | undefined) ?? (() => navigator.platform),
    getNativeVersion: (native.getNativeVersion as (() => string) | undefined) ?? (() => '1'),
    getNativeVersionName: (native.getNativeVersionName as (() => string) | undefined) ?? (() => '1.0.0'),
    supportsLiveTV: (native.supportsLiveTV as (() => boolean) | undefined) ?? (() => true),
    playLiveChannel: (native.playLiveChannel as ((json: string) => boolean) | undefined) ?? ((json: string) => {
      console.log('[Mock] playLiveChannel:', JSON.parse(json));
      const info = JSON.parse(json) as { url: string };
      window.open(info.url, '_blank');
      return true;
    }),
    prefersNative: (native.prefersNative as (() => boolean) | undefined) ?? (() => false),
    launchNativePlayer: (native.launchNativePlayer as ((json: string) => void) | undefined) ?? ((json: string) => {
      console.log('[Mock] launchNativePlayer:', JSON.parse(json));
    }),
  };
}

// ── Apply quality class to body ──────────────────────────────────────────────
const runtimeConfig = getRuntimeConfig();
const { appQuality } = runtimeConfig;
$body?.classList.add(`app-quality-${appQuality.toLowerCase().replaceAll('_', '-')}`);

// ── Mount Svelte app ─────────────────────────────────────────────────────────
mount(App, { target: document.getElementById('root')! });

// ── Remove static splash once the app is mounted ────────────────────────────
document.getElementById('loading-screen')?.remove();
