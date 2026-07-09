import { create } from 'zustand';

const MODERN_PLAYBACK_KEY = 'cinelar_prefers_modern_playback';

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

interface SettingsState {
  prefersModernPlayback: boolean;
  setPrefersModernPlayback: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  prefersModernPlayback: loadPrefersModern(),
  setPrefersModernPlayback: (value: boolean) => {
    savePrefersModern(value);
    set({ prefersModernPlayback: value });
  },
}));
