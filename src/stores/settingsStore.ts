import { create } from 'zustand';
import { zustandToSvelte } from '@/lib/zustandToSvelte';

const MODERN_PLAYBACK_KEY = 'cinelar_prefers_modern_playback';
const NAV_SOUND_KEY = 'cinelar_navigation_sound';
const DEBUG_MODE_KEY = 'cinelar_debug_mode';

function loadPrefersModern(): boolean {
  try {
    const stored = localStorage.getItem(MODERN_PLAYBACK_KEY);
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
}

function savePrefersModern(value: boolean) {
  try {
    localStorage.setItem(MODERN_PLAYBACK_KEY, value ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function loadNavigationSound(): boolean {
  try {
    return localStorage.getItem(NAV_SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

function saveNavigationSound(value: boolean) {
  try {
    localStorage.setItem(NAV_SOUND_KEY, value ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function loadDebugMode(): boolean {
  try {
    return localStorage.getItem(DEBUG_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveDebugMode(value: boolean) {
  try {
    localStorage.setItem(DEBUG_MODE_KEY, value ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

interface SettingsState {
  prefersModernPlayback: boolean;
  setPrefersModernPlayback: (value: boolean) => void;
  navigationSoundEnabled: boolean;
  setNavigationSoundEnabled: (value: boolean) => void;
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  prefersModernPlayback: loadPrefersModern(),
  setPrefersModernPlayback: (value: boolean) => {
    savePrefersModern(value);
    set({ prefersModernPlayback: value });
  },
  navigationSoundEnabled: loadNavigationSound(),
  setNavigationSoundEnabled: (value: boolean) => {
    saveNavigationSound(value);
    set({ navigationSoundEnabled: value });
  },
  debugMode: loadDebugMode(),
  setDebugMode: (value: boolean) => {
    saveDebugMode(value);
    set({ debugMode: value });
  },
}));

export const settingsStore = useSettingsStore;
export const svelteSettingsStore = zustandToSvelte(useSettingsStore);

