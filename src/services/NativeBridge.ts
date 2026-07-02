interface CinelarNative {
  getPlatform?: () => string;
  getAppVersion?: () => string;
  getDeviceModel?: () => string;
  exitApp?: () => void;
  openUrl?: (url: string) => void;
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
