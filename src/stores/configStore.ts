import { create } from 'zustand';
import type { RemoteConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/types/config';
import { remoteConfig } from '@/services/RemoteConfigService';
import { setApiConfig } from '@/api/client';

interface ConfigState {
  config: RemoteConfig;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: { ...DEFAULT_CONFIG },
  isLoaded: false,
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await remoteConfig.load();
      setApiConfig(config);
      set({ config, isLoaded: true, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar configuración';
      set({ error: message, isLoading: false });
    }
  },
}));

export const IS_DEV = import.meta.env.DEV;
