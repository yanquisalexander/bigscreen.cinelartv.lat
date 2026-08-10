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
  open: (config: PanelConfig) => void;
  update: (config: PanelConfig) => void;
  close: () => void;
}

export const useOverlayPanelStore = create<OverlayPanelState>((set, get) => ({
  panel: null,

  open: (config) => {
    set({ panel: config });
  },

  update: (config) => {
    const current = get().panel;
    if (current && current.id === config.id) {
      set({ panel: config });
    }
  },

  close: () => {
    set({ panel: null });
  },
}));
