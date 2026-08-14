import { create } from 'zustand';
import { zustandToSvelte } from '@/lib/zustandToSvelte';

interface AmbientState {
  backdropUrl: string | null;
  setBackdropUrl: (url: string | null) => void;
}

export const useAmbientStore = create<AmbientState>((set) => ({
  backdropUrl: null,
  setBackdropUrl: (url) => set({ backdropUrl: url }),
}));

export const ambientStore = useAmbientStore;
export const svelteAmbientStore = zustandToSvelte(useAmbientStore);
