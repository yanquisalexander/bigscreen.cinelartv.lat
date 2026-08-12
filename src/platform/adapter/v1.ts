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
import type { V1Bridge, BridgeMessage, BridgeResponse } from '../protocol/v1';
import { V1_MESSAGE_TYPES } from '../protocol/v1';
import { platformEvents } from '../events';

const REQUEST_TIMEOUT_MS = 5000;

let requestIdCounter = 0;
function nextRequestId(): string {
  return `r-${Date.now().toString(36)}-${(++requestIdCounter).toString(36)}`;
}

type IncomingMessage = BridgeMessage | BridgeResponse;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

function createRequestRegistry() {
  const pending = new Map<string, PendingRequest>();

  function send<T>(bridge: V1Bridge, message: Omit<BridgeMessage, 'version' | 'requestId'>): Promise<T> {
    const requestId = nextRequestId();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Bridge request timed out: ${message.type}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      bridge.send({ ...message, version: 1, requestId });
    });
  }

  function route(message: IncomingMessage): boolean {
    if (typeof message !== 'object' || message === null) return false;
    if (!('ok' in message) || message.requestId == null) return false;

    const entry = pending.get(message.requestId);
    if (!entry) return true;

    clearTimeout(entry.timer);
    pending.delete(message.requestId);
    if (message.ok) {
      entry.resolve(message.value);
    } else {
      entry.reject(new Error(message.code + (message.message ? `: ${message.message}` : '')));
    }
    return true;
  }

  return { send, route };
}

type RequestRegistry = ReturnType<typeof createRequestRegistry>;

function normalizeDeviceInfo(raw: Partial<DeviceInfo> & Record<string, unknown> | undefined): DeviceInfo {
  return {
    platform: (raw?.platform as string) ?? 'android-tv',
    appVersion: (raw?.appVersion as string) ?? '0.0.0',
    deviceModel: (raw?.deviceModel as string) ?? (raw?.device as string) ?? (raw?.model as string) ?? 'unknown',
    deviceName:
      typeof raw?.deviceName === 'string'
        ? raw.deviceName
        : raw?.device
          ? String(raw.device)
          : undefined,
    model: (raw?.model as string) ?? (raw?.device as string) ?? 'unknown',
    nativeVersion: (raw?.nativeVersion as string) ?? '0',
    nativeVersionName: (raw?.nativeVersionName as string) ?? '0.0.0',
  };
}

function createV1Device(bridge: V1Bridge, registry: RequestRegistry): PlatformDevice {
  return {
    getPlatform: () => 'android-tv',
    getInfo: (): Promise<DeviceInfo> =>
      registry
        .send<Partial<DeviceInfo> & Record<string, unknown>>(bridge, {
          type: V1_MESSAGE_TYPES.DEVICE_GET_INFO,
        })
        .then(normalizeDeviceInfo),
    isAndroidTV: () => true,
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

function createV1Media(bridge: V1Bridge, capabilities: PlatformCapabilities): PlatformMedia {
  return {
    getCapabilities: (): MediaCapabilities => capabilities.media,
    prefersNative: (): boolean => capabilities.media.prefersNative,
    supportsLiveTV: (): boolean => capabilities.media.liveTV,
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
  const registry = createRequestRegistry();

  bridge.onRequest((message: IncomingMessage) => {
    if (registry.route(message)) return;
    if (isEvent(message) && message.type === 'media.finished') {
      platformEvents.emit('media.finished', undefined);
    }
  });

  return {
    version: 1,
    capabilities,
    device: createV1Device(bridge, registry),
    navigation: createV1Navigation(bridge),
    media: createV1Media(bridge, capabilities),
    tv: createV1TV(bridge),
    account: createV1Account(bridge),
    updates: createV1Updates(bridge),
  };
}

function isEvent(message: IncomingMessage): message is BridgeMessage {
  return 'type' in message && typeof (message as BridgeMessage).type === 'string';
}
