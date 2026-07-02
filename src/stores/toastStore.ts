import { create } from 'zustand';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  show: (message: string, type?: ToastType, duration?: number) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => {
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    visible: false,
    message: '',
    type: 'info',

    show: (message, type = 'info', duration = 4000) => {
      if (hideTimer) clearTimeout(hideTimer);
      set({ visible: true, message, type });

      if (duration > 0) {
        hideTimer = setTimeout(() => {
          set({ visible: false });
          hideTimer = null;
        }, duration);
      }
    },

    hide: () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = null;
      set({ visible: false });
    },
  };
});
