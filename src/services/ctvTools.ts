import { getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useToastStore, type ToastType } from '@/stores/toastStore';
import { checkGeoBlock, clearGeoCache, getGeoblockConfig } from '@/services/geoblocking';
import { showPanel, navigatePanel, backPanel, updatePanel, closePanel, type PanelConfig, type PanelItem } from '@/services/overlayPanel';
import { useOverlayPanelStore } from '@/stores/overlayPanelStore';
import * as native from '@/services/NativeBridge';

export interface CtvTools {
  showToast: (message: string, type?: ToastType, duration?: number, title?: string) => void;
  hideToast: () => void;
  getToastState: () => { visible: boolean; message: string; title?: string; type: ToastType };
  getGeoStatus: () => Promise<{
    blocked: boolean;
    countryCode: string;
    countryName: string;
    message: string;
    config: { enabled: boolean; mode: 'blacklist' | 'whitelist'; countries: string[]; message: string };
  }>;
  clearGeoCache: () => Promise<void>;
  getAppInfo: () => {
    platform: string;
    appVersion: string;
    deviceModel: string;
    deviceName: string | undefined;
    nativeVersion: string;
    isAndroidTV: boolean;
    isSmartTV: boolean;
  };
  getConfig: () => Record<string, unknown>;
  getAuthState: () => {
    isAuthenticated: boolean;
    isGuest: boolean;
    isReady: boolean;
    profileName: string | null;
    profileId: string | null;
  };
  logout: () => void;
  getCurrentFocusKey: () => string | null;
  setFocus: (key: string) => void;
  navigate: (path: string) => void;
  reload: () => void;
  exitApp: () => void;
  getNative: () => Record<string, unknown>;
  showPanel: (config: Omit<PanelConfig, 'id'> & { id?: string }) => void;
  navigatePanel: (config: Omit<PanelConfig, 'id'> & { id?: string }) => void;
  backPanel: () => void;
  updatePanel: (config: Omit<PanelConfig, 'id'> & { id: string }) => void;
  closePanel: () => void;
  getPanelState: () => PanelConfig | null;
  getPanelHistory: () => PanelConfig[];
  makePanelItem: (item: { title: string; subtitle?: string; imageUrl?: string; icon?: string }, onSelect?: () => void) => PanelItem;
}

export function initCtvTools(): void {
  if ((window as Record<string, unknown>)._ctv_tools) return;

  const tools: CtvTools = {
    showToast: (message, type = 'info', duration = 4000, title) => {
      useToastStore.getState().show(message, type, duration, title);
    },

    hideToast: () => {
      useToastStore.getState().hide();
    },

    getToastState: () => {
      const { visible, message, title, type } = useToastStore.getState();
      return { visible, message, title, type };
    },

    getGeoStatus: async () => {
      const geo = await checkGeoBlock();
      const config = getGeoblockConfig();
      return {
        blocked: geo.blocked,
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        message: geo.message,
        config,
      };
    },

    clearGeoCache: () => clearGeoCache(),

    getAppInfo: () => ({
      platform: native.getPlatform(),
      appVersion: native.getAppVersion(),
      deviceModel: native.getDeviceModel(),
      deviceName: native.getDeviceName(),
      nativeVersion: native.getNativeVersion(),
      isAndroidTV: native.isAndroidTV(),
      isSmartTV: native.isSmartTV(),
    }),

    getConfig: () => ({ ...useConfigStore.getState().config }) as Record<string, unknown>,

    getAuthState: () => {
      const s = useAuthStore.getState();
      return {
        isAuthenticated: s.isAuthenticated,
        isGuest: s.isGuest,
        isReady: s.isReady,
        profileName: s.selectedProfile?.name ?? null,
        profileId: s.selectedProfile?.id ?? null,
      };
    },

    logout: () => {
      useAuthStore.getState().logout();
      window.location.href = '/';
    },

    getCurrentFocusKey: () => getCurrentFocusKey() ?? null,

    setFocus: (key) => setFocus(key),

    navigate: (path) => {
      try {
        router.navigate(path);
      } catch {
        window.location.href = path;
      }
    },

    reload: () => window.location.reload(),

    exitApp: () => native.exitApp(),

    showPanel: (config) => showPanel(config),

    navigatePanel: (config) => navigatePanel(config),

    backPanel: () => backPanel(),

    updatePanel: (config) => updatePanel(config),

    closePanel: () => closePanel(),

    getPanelState: () => useOverlayPanelStore.getState().panel,

    getPanelHistory: () => useOverlayPanelStore.getState().history,

    makePanelItem: (item, onSelect) => {
      return { id: item.title, ...item, onSelect };
    },

    getNative: () =>
      (window as Record<string, unknown>).CinelarNative as Record<string, unknown> | undefined ?? {},
  };

  (window as Record<string, unknown>)._ctv_tools = tools;
}
