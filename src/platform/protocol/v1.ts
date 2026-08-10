export interface BridgeMessage<T = unknown> {
  version: 1;
  type: string;
  requestId?: string;
  payload?: T;
}

export type BridgeResponse<T = unknown> =
  | { version: 1; requestId?: string; ok: true; value?: T }
  | { version: 1; requestId?: string; ok: false; code: string; message?: string };

export interface V1Bridge {
  send(message: BridgeMessage): void;
  onRequest(handler: (message: BridgeMessage) => void): void;
}

export const V1_MESSAGE_TYPES = {
  MEDIA_PLAY: 'media.play',
  MEDIA_PLAY_LIVE: 'media.playLive',
  MEDIA_PREFERS_NATIVE: 'media.prefersNative',
  MEDIA_SUPPORTS_LIVE_TV: 'media.supportsLiveTV',

  TV_SYNC_CONTINUE_WATCHING: 'tv.continueWatching.sync',
  TV_ADD_CONTINUE_WATCHING: 'tv.continueWatching.add',
  TV_CLEAR_CONTINUE_WATCHING: 'tv.continueWatching.clear',
  TV_SYNC_RECOMMENDATIONS: 'tv.recommendations.sync',
  TV_SYNC_GENERIC_RECOMMENDATIONS: 'tv.recommendations.syncGeneric',

  ACCOUNT_PROFILE_CHANGED: 'account.profileChanged',
  ACCOUNT_LOGOUT: 'account.logout',

  DEVICE_GET_INFO: 'device.info',
  DEVICE_GET_PLATFORM: 'device.platform',

  NAVIGATION_OPEN_URL: 'navigation.openUrl',
  NAVIGATION_EXIT_APP: 'navigation.exitApp',

  UPDATES_HAS_UPDATES: 'updates.has',
  UPDATES_PERFORM: 'updates.perform',
} as const;
