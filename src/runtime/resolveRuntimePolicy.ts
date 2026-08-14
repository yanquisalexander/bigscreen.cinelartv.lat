import type {
  RuntimeConfig,
  RuntimePolicyInput,
  AppQuality,
  UIRenderer,
  PlayerRenderer,
  OverrideMap,
} from './types';

export const RUNTIME_CONFIG_VERSION = 1;

function isSmartTV(family: string): boolean {
  return (
    family === 'samsung-tizen' ||
    family === 'lg-webos' ||
    family === 'android-tv' ||
    family === 'smart-tv-generic'
  );
}

function resolveAppQuality(input: RuntimePolicyInput): AppQuality {
  const { device, capabilities } = input;

  if (!capabilities.webgl) return 'LITE';

  if (device.family === 'desktop') return 'FULL_ANIMATION';

  if (isSmartTV(device.family)) {
    if (!capabilities.animations) return 'LITE';
    if (capabilities.webgl && capabilities.hardwareVideo) return 'STANDARD';
    return 'LITE';
  }

  if (capabilities.webgl && capabilities.hardwareVideo && capabilities.animations) {
    return 'STANDARD';
  }

  return 'LITE';
}

function resolveRenderer(
  quality: AppQuality,
  capabilities: RuntimePolicyInput['capabilities'],
): { ui: UIRenderer; player: PlayerRenderer } {
  let ui: UIRenderer;
  let player: PlayerRenderer;

  switch (quality) {
    case 'FULL_ANIMATION':
      ui = 'modern';
      break;
    case 'STANDARD':
      ui = 'standard';
      break;
    case 'LITE':
    default:
      ui = 'legacy';
      break;
  }

  player = capabilities.webgl && capabilities.hardwareVideo ? 'modern' : 'legacy';

  return { ui, player };
}

function resolveFlags(
  quality: AppQuality,
  capabilities: RuntimePolicyInput['capabilities'],
  device: RuntimePolicyInput['device'],
): Record<string, boolean> {
  const isTV = isSmartTV(device.family);

  return {
    enable_transitions: quality !== 'LITE' && capabilities.animations,
    enable_parallax: quality === 'FULL_ANIMATION' && !isTV,
    enable_particles: quality === 'FULL_ANIMATION' && !isTV,
    enable_hdr_tone_mapping: capabilities.hdr,
    enable_hardware_decoding: capabilities.hardwareVideo,
    enable_webgl: capabilities.webgl,
    force_simplified_ui: isTV && quality === 'LITE',
    enable_reduced_motion_fallback: !capabilities.animations,
  };
}

function applyOverrides(
  config: RuntimeConfig,
  overrides?: OverrideMap,
): RuntimeConfig {
  if (!overrides) return config;

  const key = `${config.device.family}:${config.device.os}`;
  const match =
    overrides[key] ??
    overrides[config.device.family] ??
    overrides['*'];

  if (!match) return config;

  const result = { ...config };

  if (match.appQuality) {
    result.appQuality = match.appQuality;
  }

  if (match.renderer) {
    result.renderer = { ...result.renderer, ...match.renderer };
  }

  if (match.flags) {
    result.flags = { ...result.flags, ...match.flags };
  }

  return result;
}

export function resolveRuntimePolicy(
  input: RuntimePolicyInput,
  overrides?: OverrideMap,
): RuntimeConfig {
  const quality = resolveAppQuality(input);
  const renderer = resolveRenderer(quality, input.capabilities);
  const flags = resolveFlags(quality, input.capabilities, input.device);

  const config: RuntimeConfig = {
    appQuality: quality,
    device: input.device,
    capabilities: input.capabilities,
    renderer,
    flags,
    version: RUNTIME_CONFIG_VERSION,
  };

  return applyOverrides(config, overrides);
}
