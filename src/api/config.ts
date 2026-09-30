import type { RemoteConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/types/config';

let configRef: RemoteConfig = { ...DEFAULT_CONFIG };

export function setApiConfig(config: RemoteConfig) {
  configRef = config;
}

export function getApiConfig(): RemoteConfig {
  return configRef;
}
