interface CinelarNative {
  getPlatform?: () => string;
  getAppVersion?: () => string;
  getDeviceModel?: () => string;
  getDeviceName?: () => string;
  getModel?: () => string;
  getNativeVersion?: () => string;
  getNativeVersionName?: () => string;
  exitApp?: () => void;
  openUrl?: (url: string) => void;
  syncContinueWatching?: (itemsJson: string) => boolean;
  addContinueWatching?: (itemJson: string) => boolean;
  clearContinueWatching?: () => boolean;
  syncRecommendations?: (itemsJson: string) => boolean;
  syncGenericRecommendations?: () => boolean;
  onProfileChanged?: () => boolean;
  onLogout?: () => boolean;
  supportsLiveTV?: () => boolean;
  playLiveChannel?: (channelJson: string) => boolean;
  prefersNative?: () => boolean;
  launchNativePlayer?: (json: string) => void;
  onNativePlayerFinished?: () => void;
}

declare global {
  interface Window {
    CinelarNative?: CinelarNative;
  }
}

const native: CinelarNative = typeof window !== 'undefined' ? (window.CinelarNative ?? {}) : {};

export const getPlatform = (): string => native.getPlatform?.() ?? 'web';
export const getAppVersion = (): string => native.getAppVersion?.() ?? '0.0.0';
export const getDeviceModel = (): string => native.getDeviceModel?.() ?? 'unknown';
export const getDeviceName = (): string | undefined => native.getDeviceName?.();
export const getModel = (): string => native.getModel?.() ?? 'unknown';
export const getNativeVersion = (): string => native.getNativeVersion?.() ?? '0';
export const getNativeVersionName = (): string => native.getNativeVersionName?.() ?? '0.0.0';
export const exitApp = (): void => {
  if (native.exitApp) {
    native.exitApp();
  } else {
    window.history.back();
  }
};

export const isAndroidTV = (): boolean => getPlatform() === 'android-tv';
export const isSmartTV = (): boolean => /SmartTV|Tizen|WebOS/i.test(navigator.userAgent);

export const PLAY_STORE_WEBVIEW_URL = 'https://play.google.com/store/apps/details?id=com.google.android.webview';

export const openUrl = (url: string): void => {
  if (native.openUrl) {
    native.openUrl(url);
  } else {
    window.location.href = url;
  }
};

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
  progress?: number;
  duration?: number;
  last_watched_at?: string;
  url?: string;
  path?: string;
  year?: number | null;
  season_title?: string;
  episode_title?: string;
}

export const syncContinueWatching = (items: AndroidTvHomeItem[]): boolean =>
  native.syncContinueWatching?.(JSON.stringify(items)) ?? false;

export const addContinueWatching = (item: AndroidTvHomeItem): boolean =>
  native.addContinueWatching?.(JSON.stringify(item)) ?? false;

export const clearContinueWatching = (): boolean =>
  native.clearContinueWatching?.() ?? false;

export const syncRecommendations = (items: AndroidTvHomeItem[]): boolean =>
  native.syncRecommendations?.(JSON.stringify(items)) ?? false;

export const syncGenericRecommendations = (): boolean =>
  native.syncGenericRecommendations?.() ?? false;

export const notifyNativeProfileChanged = (): boolean =>
  native.onProfileChanged?.() ?? false;

export const notifyNativeLogout = (): boolean =>
  native.onLogout?.() ?? false;

export interface LiveChannelInfo {
  id: string;
  name: string;
  url: string;
  logo?: string;
}

export const supportsLiveTV = (): boolean =>
  (typeof window !== 'undefined' ? window.CinelarNative?.supportsLiveTV?.() : undefined) ?? false;

export const playLiveChannel = (channel: LiveChannelInfo): boolean =>
  (typeof window !== 'undefined' ? window.CinelarNative?.playLiveChannel?.(JSON.stringify(channel)) : undefined) ?? false;

export const prefersNative = (): boolean =>
  (typeof window !== 'undefined' ? window.CinelarNative?.prefersNative?.() : undefined) ?? false;

interface NativePlayerData {
  contentId: string;
  episodeId?: string;
  accessToken: string;
  clientEndpoint: string;
}

export const launchNativePlayer = (data: NativePlayerData): void => {
  window.CinelarNative?.launchNativePlayer?.(JSON.stringify(data));
};

let nativePlayerFinishedCallback: (() => void) | null = null;

export const setOnNativePlayerFinished = (callback: (() => void) | null): void => {
  nativePlayerFinishedCallback = callback;
  if (typeof window !== 'undefined') {
    window.CinelarNative = {
      ...window.CinelarNative,
      onNativePlayerFinished: () => {
        nativePlayerFinishedCallback?.();
      },
    };
  }
};
