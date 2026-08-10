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
import type { V1Bridge, BridgeMessage } from '../protocol/v1';
import { V1_MESSAGE_TYPES } from '../protocol/v1';
import { platformEvents } from '../events';

let requestIdCounter = 0;
function nextRequestId(): string {
  return `r-${Date.now().toString(36)}-${(++requestIdCounter).toString(36)}`;
}

function createV1Device(_bridge: V1Bridge): PlatformDevice {
  return {
    getPlatform: () => 'web',
    getInfo: (): DeviceInfo => ({
      platform: 'web',
      appVersion: '0.0.0',
      deviceModel: 'unknown',
      deviceName: undefined,
      model: 'unknown',
      nativeVersion: '0',
      nativeVersionName: '0.0.0',
    }),
    isAndroidTV: () => false,
    isSmartTV: () => /SmartTV|Tizen|WebOS/i.test(navigator.userAgent),
  };
}

function createV1Navigation(bridge: V1Bridge): PlatformNavigation {
  return {
    openUrl: (url: string): void => {
      bridge.send({
        version: 1,
        type: V1_MESSAGE_TYPES.NAVIGATION_OPEN_URL,
        payload: { url },
      });
    },
    exitApp: (): void => {
      bridge.send({
        version: 1,
        type: V1_MESSAGE_TYPES.NAVIGATION_EXIT_APP,
      });
    },
  };
}

function createV1Media(bridge: V1Bridge): PlatformMedia {
  return {
    getCapabilities: (): MediaCapabilities => ({
      nativePlayer: true,
      liveTV: true,
      prefersNative: true,
    }),
    prefersNative: (): boolean => false,
    supportsLiveTV: (): boolean => true,
    playContent: (data: NativePlayerData): void => {
      bridge.send({
        version: 1,
        type: V1_MESSAGE_TYPES.MEDIA_PLAY,
        requestId: nextRequestId(),
        payload: data,
      });
    },
    playLive: (channel: LiveChannelInfo): boolean => {
      bridge.send({
        version: 1,
        type: V1_MESSAGE_TYPES.MEDIA_PLAY_LIVE,
        requestId: nextRequestId(),
        payload: channel,
      });
      return true;
    },
    onFinished: (callback: (() => void) | null): void => {
      if (callback) {
        platformEvents.on('media.finished', callback);
      }
    },
  };
}

function createV1TV(bridge: V1Bridge): PlatformTV {
  return {
    continueWatching: {
      sync: (items: AndroidTvHomeItem[]): boolean => {
        bridge.send({
          version: 1,
          type: V1_MESSAGE_TYPES.TV_SYNC_CONTINUE_WATCHING,
          payload: { items },
        });
        return true;
      },
      add: (item: AndroidTvHomeItem): boolean => {
        bridge.send({
          version: 1,
          type: V1_MESSAGE_TYPES.TV_ADD_CONTINUE_WATCHING,
          payload: { item },
        });
        return true;
      },
      clear: (): boolean => {
        bridge.send({
          version: 1,
          type: V1_MESSAGE_TYPES.TV_CLEAR_CONTINUE_WATCHING,
        });
        return true;
      },
    },
    recommendations: {
      sync: (items: AndroidTvHomeItem[]): boolean => {
        bridge.send({
          version: 1,
          type: V1_MESSAGE_TYPES.TV_SYNC_RECOMMENDATIONS,
          payload: { items },
        });
        return true;
      },
      syncGeneric: (): boolean => {
        bridge.send({
          version: 1,
          type: V1_MESSAGE_TYPES.TV_SYNC_GENERIC_RECOMMENDATIONS,
        });
        return true;
      },
    },
  };
}

function createV1Account(bridge: V1Bridge): PlatformAccount {
  return {
    notifyProfileChanged: (): boolean => {
      bridge.send({
        version: 1,
        type: V1_MESSAGE_TYPES.ACCOUNT_PROFILE_CHANGED,
      });
      return true;
    },
    notifyLogout: (): boolean => {
      bridge.send({
        version: 1,
        type: V1_MESSAGE_TYPES.ACCOUNT_LOGOUT,
      });
      return true;
    },
  };
}

function createV1Updates(bridge: V1Bridge): PlatformUpdates {
  return {
    hasUpdates: (): boolean => false,
    performUpdate: (): void => {
      bridge.send({
        version: 1,
        type: V1_MESSAGE_TYPES.UPDATES_PERFORM,
      });
    },
  };
}

function detectV1Capabilities(_bridge: V1Bridge): PlatformCapabilities {
  return {
    version: 1,
    platform: 'v1',
    device: { info: true, model: true, nativeVersion: true },
    navigation: { openUrl: true, exitApp: true },
    media: { nativePlayer: true, liveTV: true, prefersNative: true },
    tv: { continueWatching: true, recommendations: true },
    account: { profileChanged: true, logout: true },
    updates: { hasUpdates: true, performUpdate: true },
  };
}

export function createV1Adapter(bridge: V1Bridge): Platform {
  const capabilities = detectV1Capabilities(bridge);

  bridge.onRequest((message: BridgeMessage) => {
    if (message.type === 'media.finished') {
      platformEvents.emit('media.finished', undefined);
    }
  });

  return {
    version: 1,
    capabilities,
    device: createV1Device(bridge),
    navigation: createV1Navigation(bridge),
    media: createV1Media(bridge),
    tv: createV1TV(bridge),
    account: createV1Account(bridge),
    updates: createV1Updates(bridge),
  };
}
