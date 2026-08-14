import { create } from 'zustand';
import { getApiConfig } from '@/api/client';
import { zustandToSvelte } from '@/lib/zustandToSvelte';

export interface SiteSettings {
  enable_stream_limit: boolean;
  max_simultaneous_streams_per_user: number;
  stream_ping_interval_seconds: number;
  stream_session_timeout_seconds: number;
  [key: string]: unknown;
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  enable_stream_limit: false,
  max_simultaneous_streams_per_user: 2,
  stream_ping_interval_seconds: 10,
  stream_session_timeout_seconds: 10,
};

interface SiteSettingsState {
  settings: SiteSettings;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
}

export const useSiteSettingsStore = create<SiteSettingsState>((set) => ({
  settings: { ...DEFAULT_SITE_SETTINGS },
  isLoaded: false,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { CLIENT_ENDPOINT } = getApiConfig();
      const response = await fetch(`${CLIENT_ENDPOINT}/site/settings.json`, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: Partial<SiteSettings> = await response.json();
      set({ settings: { ...DEFAULT_SITE_SETTINGS, ...data }, isLoaded: true, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar site settings';
      // Non-critical: keep defaults and don't block the app
      console.warn('[SiteSettings]', message);
      set({ settings: { ...DEFAULT_SITE_SETTINGS }, isLoaded: true, isLoading: false });
    }
  },
}));

export const siteSettingsStore = useSiteSettingsStore;

/** Svelte-readable store — use as `$siteSettingsStore` in Svelte templates */
export const svelteSiteSettingsStore = zustandToSvelte(useSiteSettingsStore);
