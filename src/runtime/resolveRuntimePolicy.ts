import type {
  RuntimeConfig,
  RuntimePolicyInput,
  AppQuality,
  UIRenderer,
  PlayerRenderer,
  OverrideMap,
} from './types';

export const RUNTIME_CONFIG_VERSION = 2;

function isSmartTV(family: string): boolean {
  return (
    family === 'samsung-tizen' ||
    family === 'lg-webos' ||
    family === 'android-tv' ||
    family === 'fire-tv' ||
    family === 'smart-tv-generic' ||
    family === 'cobalt'
  );
}

function resolveAppQuality(input: RuntimePolicyInput): AppQuality {
  const { device, capabilities } = input;

  // 1. Fallback crítico a LITE si el hardware no soporta ni decodificación por HW ni animaciones básicas
  if (!capabilities.animations || !capabilities.hardwareVideo) {
    return 'LITE';
  }

  // 2. Comprobación de aceleración de renderizado (CSS 3D o WebGL)
  const hasGpuAccel = capabilities.cssTransform3d || capabilities.webgl;
  if (!hasGpuAccel) {
    return 'LITE';
  }

  // Extraemos métricas con fallbacks seguros
  const ramGb = capabilities.memoryGb ?? 1.5; // Por defecto asumimos gama media si no se detecta
  const cores = capabilities.logicalCores ?? 2;
  const maxTexture = capabilities.maxTextureSize ?? 2048;

  // 3. Si la memoria RAM es menor a 1 GB (común en dongles HDMI / TVs baratas),
  // forzamos LITE para prevenir Out-Of-Memory (OOM) en Cobalt/WebView.
  if (ramGb < 1.0) {
    return 'LITE';
  }

  // 4. Evaluación específica para Smart TVs / Leanback
  if (isSmartTV(device.family)) {
    // Perfil Gama Alta (High-End TV / OTT like Shield TV, Apple TV, Fire Cube, SoCs de gama alta):
    // Requiere >= 3GB RAM, al menos 4 cores y aceleración WebGL o texturas de 4K.
    const isHighEndHardware =
      ramGb >= 3.0 &&
      cores >= 4 &&
      maxTexture >= 4096 &&
      (capabilities.webgl || capabilities.videoTexture);

    if (isHighEndHardware) {
      return 'FULL_ANIMATION';
    }

    // Perfil Estándar (Gama Media, la mayoría de TVs Tizen/webOS/Android TV recientes):
    // RAM >= 1.5GB y al menos 2 cores con GPU CSS 3D.
    const isStandardHardware = ramGb >= 1.2 && cores >= 2;

    if (isStandardHardware) {
      return 'STANDARD';
    }

    return 'LITE';
  }

  // 5. Desktop u otros clientes (PC, Laptop)
  if (device.family === 'desktop') {
    return ramGb >= 4.0 ? 'FULL_ANIMATION' : 'STANDARD';
  }

  return 'STANDARD';
}

function resolveRenderer(
  quality: AppQuality,
  capabilities: RuntimePolicyInput['capabilities'],
): { ui: UIRenderer; player: PlayerRenderer } {
  let ui: UIRenderer;

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

  const player: PlayerRenderer = capabilities.hardwareVideo ? 'modern' : 'legacy';

  return { ui, player };
}

function resolveFlags(
  quality: AppQuality,
  capabilities: RuntimePolicyInput['capabilities'],
  device: RuntimePolicyInput['device'],
): Record<string, boolean> {
  const isTV = isSmartTV(device.family);
  const isHighEnd = quality === 'FULL_ANIMATION';
  const ramGb = capabilities.memoryGb ?? 2;

  return {
    enable_transitions: quality !== 'LITE' && capabilities.animations,
    enable_parallax: isHighEnd,
    // Partículas solo activas si hay WebGL y suficiente RAM (>=2GB) para no ahogar la GPU
    enable_particles: isHighEnd && Boolean(capabilities.webgl) && ramGb >= 2.0,
    enable_hdr_tone_mapping: Boolean(capabilities.hdr),
    enable_hardware_decoding: Boolean(capabilities.hardwareVideo),
    enable_webgl: Boolean(capabilities.webgl),
    enable_video_texture: Boolean(capabilities.videoTexture),
    // Habilitar caché de imágenes agresiva en UI si hay más de 2GB de RAM
    enable_image_caching: ramGb >= 2.0,
    force_simplified_ui: quality === 'LITE',
    enable_reduced_motion_fallback: !capabilities.animations || quality === 'LITE',
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

  return {
    ...config,
    appQuality: match.appQuality ?? config.appQuality,
    renderer: { ...config.renderer, ...match.renderer },
    flags: { ...config.flags, ...match.flags },
  };
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