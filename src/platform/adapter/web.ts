import type {
  Platform,
  PlatformCapabilities,
  PlatformDevice,
  PlatformNavigation,
  PlatformMedia,
  PlatformTV,
  PlatformAccount,
  PlatformUpdates,
  DeviceInfo,
  MediaCapabilities,
  LiveChannelInfo,
  NativePlayerData,
} from '../types';

const WEB_CAPABILITIES: PlatformCapabilities = {
  version: 0,
  platform: 'web',
  device: { info: false, model: false, nativeVersion: false },
  navigation: { openUrl: true, exitApp: false },
  media: { nativePlayer: false, liveTV: false, prefersNative: false },
  tv: { continueWatching: false, recommendations: false },
  account: { profileChanged: false, logout: false },
  updates: { hasUpdates: false, performUpdate: false },
};

function createWebDevice(): PlatformDevice {
  return {
    getPlatform: () => 'web',
    getInfo: (): Promise<DeviceInfo> => Promise.resolve({
      platform: 'web',
      appVersion: '0.0.0',
      deviceModel: 'unknown',
      deviceName: navigator.userAgent,
      model: navigator.platform,
      nativeVersion: '0',
      nativeVersionName: '0.0.0',
    }),
    isAndroidTV: () => false,
    isSmartTV: () => /SmartTV|Tizen|WebOS/i.test(navigator.userAgent),
  };
}

function createWebNavigation(): PlatformNavigation {
  return {
    openUrl: (url: string): void => {
      window.location.href = url;
    },
    exitApp: (): void => {
      window.history.back();
    },
  };
}

function createWebMedia(): PlatformMedia {
  return {
    getCapabilities: (): MediaCapabilities => ({
      nativePlayer: false,
      liveTV: false,
      prefersNative: false,
    }),
    prefersNative: () => false,
    supportsLiveTV: () => false,
    playContent: (_data: NativePlayerData): void => {},
    playLive: (_channel: LiveChannelInfo): boolean => false,
    onFinished: (_callback: (() => void) | null): void => {},
  };
}

function createWebTV(): PlatformTV {
  return {
    continueWatching: {
      sync: () => false,
      add: () => false,
      clear: () => false,
    },
    recommendations: {
      sync: () => false,
      syncGeneric: () => false,
    },
  };
}

function createWebAccount(): PlatformAccount {
  return {
    notifyProfileChanged: () => false,
    notifyLogout: () => false,
  };
}

function createWebUpdates(): PlatformUpdates {
  return {
    hasUpdates: () => false,
    performUpdate: () => {},
  };
}

export function createWebAdapter(): Platform {
  return {
    version: 0,
    capabilities: WEB_CAPABILITIES,
    device: createWebDevice(),
    navigation: createWebNavigation(),
    media: createWebMedia(),
    tv: createWebTV(),
    account: createWebAccount(),
    updates: createWebUpdates(),
  };
}
