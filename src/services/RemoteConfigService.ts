import type { RemoteConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/types/config';

const REMOTE_CONFIG_URL = 'http://appboot.cinelartv.lat/remote_config.json';
const STORAGE_KEY = 'cinelar_remote_config';

class RemoteConfigService {
  private config: RemoteConfig = { ...DEFAULT_CONFIG };
  private loaded = false;

  async load(): Promise<RemoteConfig> {
    try {
      const response = await fetch(REMOTE_CONFIG_URL, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: Partial<RemoteConfig> = await response.json();
      this.config = { ...DEFAULT_CONFIG, ...data };
      this.loaded = true;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch { /* ignore storage errors */ }

      return this.config;
    } catch {
      const cached = this.getCached();
      if (cached) {
        this.config = cached;
        this.loaded = true;
        return this.config;
      }
      this.config = { ...DEFAULT_CONFIG };
      this.loaded = true;
      return this.config;
    }
  }

  private getCached(): RemoteConfig | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as RemoteConfig;
    } catch {
      return null;
    }
  }

  get(): RemoteConfig {
    return this.config;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export const remoteConfig = new RemoteConfigService();
