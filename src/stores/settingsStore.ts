import { create } from 'zustand';

const MODERN_PLAYBACK_KEY = 'cinelar_prefers_modern_playback';
const NAV_SOUND_KEY = 'cinelar_navigation_sound';

function loadPrefersModern(): boolean {
  try {
    return localStorage.getItem(MODERN_PLAYBACK_KEY) === '1';
  } catch {
    return false;
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

interface SettingsState {
  prefersModernPlayback: boolean;
  setPrefersModernPlayback: (value: boolean) => void;
  navigationSoundEnabled: boolean;
  setNavigationSoundEnabled: (value: boolean) => void;
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
}));
