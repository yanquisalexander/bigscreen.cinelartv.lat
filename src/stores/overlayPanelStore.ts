import { create } from 'zustand';

export interface PanelItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  icon?: string;
  onSelect?: () => void;
  closeOnSelect?: boolean;
  readOnly?: boolean;
}

export interface PanelConfig {
  id: string;
  title: string;
  subtitle?: string;
  headerImageUrl?: string;
  items: PanelItem[];
}

interface OverlayPanelState {
  panel: PanelConfig | null;
  history: PanelConfig[];
  open: (config: PanelConfig) => void;
  navigate: (config: PanelConfig) => void;
  back: () => void;
  update: (config: PanelConfig) => void;
  close: () => void;
}

export const useOverlayPanelStore = create<OverlayPanelState>((set, get) => ({
  panel: null,
  history: [],

  open: (config) => {
    set({ panel: config, history: [] });
  },

  navigate: (config) => {
    const current = get().panel;
    if (current) {
      set((s) => ({ panel: config, history: [...s.history, current] }));
    } else {
      set({ panel: config, history: [] });
    }
  },

  back: () => {
    const { history } = get();
    if (history.length === 0) return false;
    const previous = history[history.length - 1];
    set((s) => ({ panel: previous, history: s.history.slice(0, -1) }));
    return true;
  },

  update: (config) => {
    const current = get().panel;
    if (current && current.id === config.id) {
      set({ panel: config });
    }
  },

  close: () => {
    set({ panel: null, history: [] });
  },
}));
