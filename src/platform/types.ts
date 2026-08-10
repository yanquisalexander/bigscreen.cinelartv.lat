export type BridgeResult<T = void> =
  | { ok: true; value?: T }
  | { ok: false; code: BridgeErrorCode; message?: string };

export type BridgeErrorCode =
  | 'UNSUPPORTED'
  | 'NOT_AVAILABLE'
  | 'INVALID_ARGUMENT'
  | 'TIMEOUT'
  | 'NATIVE_ERROR'
  | 'PROTOCOL_ERROR';

export interface PlatformCapabilities {
  version: number;
  platform: string;
  device: DeviceCapabilities;
  navigation: NavigationCapabilities;
  media: MediaCapabilities;
  tv: TVCapabilities;
  account: AccountCapabilities;
  updates: UpdateCapabilities;
}

export interface DeviceCapabilities {
  info: boolean;
  model: boolean;
  nativeVersion: boolean;
}

export interface NavigationCapabilities {
  openUrl: boolean;
  exitApp: boolean;
}

export interface MediaCapabilities {
  nativePlayer: boolean;
  liveTV: boolean;
  prefersNative: boolean;
}

export interface TVCapabilities {
  continueWatching: boolean;
  recommendations: boolean;
}

export interface AccountCapabilities {
  profileChanged: boolean;
  logout: boolean;
}

export interface UpdateCapabilities {
  hasUpdates: boolean;
  performUpdate: boolean;
}

export interface DeviceInfo {
  platform: string;
  appVersion: string;
  deviceModel: string;
  deviceName: string | undefined;
  model: string;
  nativeVersion: string;
  nativeVersionName: string;
}

export interface AndroidTvHomeItem {
  id?: string;
  content_id?: string;
  episode_id?: string;
  title?: string;
  description?: string;
  banner?: string;
  cover?: string;
  banner_resized?: string;
  cover_resized?: string;
  thumbnail?: string;
  thumbnail_resized?: string;
  image_url?: string;
  poster_url?: string;
  logo_url?: string;
  content_type?: string;
  contentType?: string;
  progress?: number;
  duration?: number;
  last_watched_at?: string;
  url?: string;
  path?: string;
  year?: number | null;
  season_title?: string;
  episode_title?: string;
}

export interface LiveChannelInfo {
  id: string;
  name: string;
  url: string;
  logo?: string;
  accessToken?: string;
  clientEndpoint?: string;
}

export interface NativePlayerData {
  contentId: string;
  episodeId?: string;
  accessToken: string;
  clientEndpoint: string;
}

export interface PlatformMedia {
  getCapabilities(): MediaCapabilities;
  prefersNative(): boolean;
  supportsLiveTV(): boolean;
  playContent(data: NativePlayerData): void;
  playLive(channel: LiveChannelInfo): boolean;
  onFinished(callback: (() => void) | null): void;
}

export interface PlatformTV {
  continueWatching: {
    sync(items: AndroidTvHomeItem[]): boolean;
    add(item: AndroidTvHomeItem): boolean;
    clear(): boolean;
  };
  recommendations: {
    sync(items: AndroidTvHomeItem[]): boolean;
    syncGeneric(): boolean;
  };
}

export interface PlatformAccount {
  notifyProfileChanged(): boolean;
  notifyLogout(): boolean;
}

export interface PlatformUpdates {
  hasUpdates(): boolean;
  performUpdate(): void;
}

export interface PlatformNavigation {
  openUrl(url: string): void;
  exitApp(): void;
}

export interface PlatformDevice {
  getPlatform(): string;
  getInfo(): DeviceInfo;
  isAndroidTV(): boolean;
  isSmartTV(): boolean;
}

export interface Platform {
  readonly version: number;
  readonly capabilities: PlatformCapabilities;
  device: PlatformDevice;
  navigation: PlatformNavigation;
  media: PlatformMedia;
  tv: PlatformTV;
  account: PlatformAccount;
  updates: PlatformUpdates;
}

export const PLAY_STORE_WEBVIEW_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.webview';
