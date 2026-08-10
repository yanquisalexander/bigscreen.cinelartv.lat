import type { Platform } from './types';
import type { V1Bridge } from './protocol/v1';
import { createV0Adapter } from './adapter/v0';
import { createV1Adapter } from './adapter/v1';
import { createWebAdapter } from './adapter/web';
import { platformEvents } from './events';

declare global {
  interface Window {
    CinelarNative?: {
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
      hasNativeUpdates?: () => boolean;
      performNativeUpdate?: () => void;
    };
    __CINELAR_V1_BRIDGE__?: V1Bridge;
  }
}

function detectBridgeVersion(): 'v1' | 'v0' | 'none' {
  if (typeof window === 'undefined') return 'none';

  if (window.__CINELAR_V1_BRIDGE__) return 'v1';
  if (window.CinelarNative) return 'v0';

  return 'none';
}

function createPlatform(): Platform {
  const bridgeVersion = detectBridgeVersion();

  switch (bridgeVersion) {
    case 'v1': {
      const adapter = createV1Adapter(window.__CINELAR_V1_BRIDGE__!);
      platformEvents.emit('bridge.connected', { version: 1 });
      return adapter;
    }
    case 'v0': {
      const adapter = createV0Adapter();
      platformEvents.emit('bridge.connected', { version: 0 });
      return adapter;
    }
    case 'none':
    default: {
      const adapter = createWebAdapter();
      return adapter;
    }
  }
}

let platformInstance: Platform | null = null;

export function getPlatformInstance(): Platform {
  if (!platformInstance) {
    platformInstance = createPlatform();
  }
  return platformInstance;
}

export function resetPlatform(): void {
  platformInstance = null;
  platformEvents.removeAllListeners();
}

export type {
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
  BridgeResult,
  BridgeErrorCode,
} from './types';

export { platformEvents } from './events';
export { PLAY_STORE_WEBVIEW_URL } from './types';
