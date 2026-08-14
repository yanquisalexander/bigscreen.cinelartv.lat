import type { RuntimeConfig, RuntimeBootstrapOptions } from './types';
import { detectDevice } from './detectDevice';
import { detectCapabilities } from './detectCapabilities';
import { resolveRuntimePolicy, RUNTIME_CONFIG_VERSION } from './resolveRuntimePolicy';

let config: RuntimeConfig | null = null;

export function initRuntime(options?: RuntimeBootstrapOptions): RuntimeConfig {
  if (config) return config;

  const device = detectDevice();
  const capabilities = detectCapabilities();
  config = resolveRuntimePolicy({ device, capabilities }, options?.overrides);
  return config;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!config) {
    return initRuntime();
  }
  return config;
}

export function getRuntimeVersion(): number {
  return RUNTIME_CONFIG_VERSION;
}

export type {
  RuntimeConfig,
  AppQuality,
  UIRenderer,
  PlayerRenderer,
  DeviceInfo,
  Capabilities,
  RendererConfig,
  OverrideMap,
  DeviceOverride,
  RuntimeBootstrapOptions,
} from './types';

export { detectDevice } from './detectDevice';
export { detectCapabilities } from './detectCapabilities';
export { resolveRuntimePolicy, RUNTIME_CONFIG_VERSION } from './resolveRuntimePolicy';
