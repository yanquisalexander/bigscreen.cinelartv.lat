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
  AndroidTvHomeItem,
  LiveChannelInfo,
  NativePlayerData,
} from '../types';
import { platformEvents } from '../events';

const native =
  typeof window !== 'undefined'
    ? (window.CinelarNative ?? {})
    : {};

function createV0Device(): PlatformDevice {
  return {
    getPlatform: () => native.getPlatform?.() ?? 'web',
    getInfo: (): DeviceInfo => ({
      platform: native.getPlatform?.() ?? 'web',
      appVersion: native.getAppVersion?.() ?? '0.0.0',
      deviceModel: native.getDeviceModel?.() ?? 'unknown',
      deviceName: native.getDeviceName?.(),
      model: native.getModel?.() ?? 'unknown',
      nativeVersion: native.getNativeVersion?.() ?? '0',
      nativeVersionName: native.getNativeVersionName?.() ?? '0.0.0',
    }),
    isAndroidTV: () => (native.getPlatform?.() ?? 'web') === 'android-tv',
    isSmartTV: () => /SmartTV|Tizen|WebOS/i.test(navigator.userAgent),
  };
}

function createV0Navigation(): PlatformNavigation {
  return {
    openUrl: (url: string): void => {
      if (native.openUrl) {
        native.openUrl(url);
      } else {
        window.location.href = url;
      }
    },
    exitApp: (): void => {
      if (native.exitApp) {
        native.exitApp();
      } else {
        window.history.back();
      }
    },
  };
}

function createV0Media(): PlatformMedia {
  let nativePlayerFinishedCallback: (() => void) | null = null;

  return {
    getCapabilities: (): MediaCapabilities => ({
      nativePlayer: typeof native.prefersNative === 'function',
      liveTV: typeof native.supportsLiveTV === 'function' && (native.supportsLiveTV?.() ?? false),
      prefersNative: typeof native.prefersNative === 'function' && (native.prefersNative?.() ?? false),
    }),
    prefersNative: (): boolean =>
      (typeof window !== 'undefined'
        ? window.CinelarNative?.prefersNative?.()
        : undefined) ?? false,
    supportsLiveTV: (): boolean =>
      (typeof window !== 'undefined'
        ? window.CinelarNative?.supportsLiveTV?.()
        : undefined) ?? false,
    playContent: (data: NativePlayerData): void => {
      window.CinelarNative?.launchNativePlayer?.(JSON.stringify(data));
    },
    playLive: (channel: LiveChannelInfo): boolean =>
      (typeof window !== 'undefined'
        ? window.CinelarNative?.playLiveChannel?.(JSON.stringify(channel))
        : undefined) ?? false,
    onFinished: (callback: (() => void) | null): void => {
      nativePlayerFinishedCallback = callback;
      if (typeof window !== 'undefined' && window.CinelarNative) {
        window.CinelarNative.onNativePlayerFinished = () => {
          nativePlayerFinishedCallback?.();
          platformEvents.emit('media.finished', undefined);
        };
      }
    },
  };
}

function createV0TV(): PlatformTV {
  return {
    continueWatching: {
      sync: (items: AndroidTvHomeItem[]): boolean =>
        native.syncContinueWatching?.(JSON.stringify(items)) ?? false,
      add: (item: AndroidTvHomeItem): boolean =>
        native.addContinueWatching?.(JSON.stringify(item)) ?? false,
      clear: (): boolean => native.clearContinueWatching?.() ?? false,
    },
    recommendations: {
      sync: (items: AndroidTvHomeItem[]): boolean =>
        native.syncRecommendations?.(JSON.stringify(items)) ?? false,
      syncGeneric: (): boolean =>
        native.syncGenericRecommendations?.() ?? false,
    },
  };
}

function createV0Account(): PlatformAccount {
  return {
    notifyProfileChanged: (): boolean =>
      native.onProfileChanged?.() ?? false,
    notifyLogout: (): boolean => native.onLogout?.() ?? false,
  };
}

function createV0Updates(): PlatformUpdates {
  return {
    hasUpdates: (): boolean =>
      (typeof window !== 'undefined'
        ? window.CinelarNative?.hasNativeUpdates?.()
        : undefined) ?? false,
    performUpdate: (): void => {
      window.CinelarNative?.performNativeUpdate?.();
    },
  };
}

function detectV0Capabilities(): PlatformCapabilities {
  const device = createV0Device();
  const media = createV0Media();
  return {
    version: 0,
    platform: device.getPlatform(),
    device: {
      info: true,
      model: true,
      nativeVersion: typeof native.getNativeVersion === 'function',
    },
    navigation: {
      openUrl: true,
      exitApp: true,
    },
    media: media.getCapabilities(),
    tv: {
      continueWatching:
        typeof native.syncContinueWatching === 'function',
      recommendations:
        typeof native.syncRecommendations === 'function',
    },
    account: {
      profileChanged: typeof native.onProfileChanged === 'function',
      logout: typeof native.onLogout === 'function',
    },
    updates: {
      hasUpdates: typeof native.hasNativeUpdates === 'function',
      performUpdate: typeof native.performNativeUpdate === 'function',
    },
  };
}

export function createV0Adapter(): Platform {
  const capabilities = detectV0Capabilities();
  return {
    version: 0,
    capabilities,
    device: createV0Device(),
    navigation: createV0Navigation(),
    media: createV0Media(),
    tv: createV0TV(),
    account: createV0Account(),
    updates: createV0Updates(),
  };
}
