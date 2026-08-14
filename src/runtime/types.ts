export type AppQuality = 'LITE' | 'STANDARD' | 'FULL_ANIMATION';

export type UIRenderer = 'legacy' | 'standard' | 'modern';
export type PlayerRenderer = 'legacy' | 'modern';

export interface DeviceInfo {
  family: string;
  model?: string;
  os: string;
  browser: string;
  native: boolean;
}
export interface Capabilities {
  // Aceleración Gráfica
  webgl: boolean;
  webgl2: boolean;
  cssTransform3d: boolean;
  hardwareVideo: boolean;
  videoTexture: boolean;

  // Experiencia Visual & Pantalla
  animations: boolean;
  hdr: boolean;
  devicePixelRatio?: number;

  // Métricas Cuantitativas de Hardware (Estilo Cobalt / Native Runtime)
  memoryGb?: number;         // Memoria RAM detectada (p. ej. navigator.deviceMemory o Starboard)
  logicalCores?: number;     // Cores lógicos de CPU (navigator.hardwareConcurrency)
  maxTextureSize?: number;   // Tamaño máximo de textura (GL_MAX_TEXTURE_SIZE)
  targetFrameRate?: number;  // FPS objetivo soportados (30 vs 60/120)
}

export interface RendererConfig {
  ui: UIRenderer;
  player: PlayerRenderer;
}

export interface RuntimeConfig {
  appQuality: AppQuality;
  device: DeviceInfo;
  capabilities: Capabilities;
  renderer: RendererConfig;
  flags: Record<string, boolean>;
  version: number;
}

export interface RuntimePolicyInput {
  device: DeviceInfo;
  capabilities: Capabilities;
}

export type DeviceOverride = Partial<{
  appQuality: AppQuality;
  renderer: Partial<RendererConfig>;
  flags: Record<string, boolean>;
}>;

export type OverrideMap = Record<string, DeviceOverride>;

export interface RuntimeBootstrapOptions {
  overrides?: OverrideMap;
}
