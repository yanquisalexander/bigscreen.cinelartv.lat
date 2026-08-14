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
  webgl: boolean;
  webgl2: boolean;
  hardwareVideo: boolean;
  videoTexture: boolean;
  animations: boolean;
  hdr: boolean;
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
