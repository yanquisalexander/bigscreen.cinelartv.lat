import { getPlatformInstance } from '@/platform';
import type {
  AndroidTvHomeItem,
  DeviceInfo,
  LiveChannelInfo,
  NativePlayerData,
} from '@/platform';

export type { AndroidTvHomeItem, LiveChannelInfo, NativePlayerData } from '@/platform';
export { PLAY_STORE_WEBVIEW_URL } from '@/platform';

export const getPlatform = (): string => getPlatformInstance().device.getPlatform();
export const getDeviceInfo = async (): Promise<DeviceInfo> => getPlatformInstance().device.getInfo();
export const getAppVersion = async (): Promise<string> => (await getDeviceInfo()).appVersion;
export const getDeviceModel = async (): Promise<string> => (await getDeviceInfo()).deviceModel;
export const getDeviceName = async (): Promise<string | undefined> => (await getDeviceInfo()).deviceName;
export const getModel = async (): Promise<string> => (await getDeviceInfo()).model;
export const getNativeVersion = async (): Promise<string> => (await getDeviceInfo()).nativeVersion;
export const getNativeVersionName = async (): Promise<string> => (await getDeviceInfo()).nativeVersionName;

export const exitApp = (): void => getPlatformInstance().navigation.exitApp();
export const isAndroidTV = (): boolean => getPlatformInstance().device.isAndroidTV();
export const isSmartTV = (): boolean => getPlatformInstance().device.isSmartTV();

export const openUrl = (url: string): void => getPlatformInstance().navigation.openUrl(url);

export const syncContinueWatching = (items: AndroidTvHomeItem[]): boolean =>
  getPlatformInstance().tv.continueWatching.sync(items);
export const addContinueWatching = (item: AndroidTvHomeItem): boolean =>
  getPlatformInstance().tv.continueWatching.add(item);
export const clearContinueWatching = (): boolean =>
  getPlatformInstance().tv.continueWatching.clear();

export const syncRecommendations = (items: AndroidTvHomeItem[]): boolean =>
  getPlatformInstance().tv.recommendations.sync(items);
export const syncGenericRecommendations = (): boolean =>
  getPlatformInstance().tv.recommendations.syncGeneric();

export const notifyNativeProfileChanged = (): boolean =>
  getPlatformInstance().account.notifyProfileChanged();
export const notifyNativeLogout = (): boolean =>
  getPlatformInstance().account.notifyLogout();

export const supportsLiveTV = (): boolean =>
  getPlatformInstance().media.supportsLiveTV();
export const playLiveChannel = (channel: LiveChannelInfo): boolean =>
  getPlatformInstance().media.playLive(channel);
export const prefersNative = (): boolean =>
  getPlatformInstance().media.prefersNative();

export const launchNativePlayer = (data: NativePlayerData): void =>
  getPlatformInstance().media.playContent(data);

export const setOnNativePlayerFinished = (callback: (() => void) | null): void => {
  getPlatformInstance().media.onFinished(callback);
};

export const hasNativeUpdates = (): boolean =>
  getPlatformInstance().updates.hasUpdates();
export const performNativeUpdate = (): void =>
  getPlatformInstance().updates.performUpdate();
