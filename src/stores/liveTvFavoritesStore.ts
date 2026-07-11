// stores/liveTvFavoritesStore.ts
import { create } from 'zustand';

const STORAGE_KEY = 'livetv-favorites';

function loadFavorites(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function persist(favorites: Set<string>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
        // localStorage puede fallar en algunos devices/TVs con storage lleno o deshabilitado
    }
}

interface LiveTvFavoritesState {
    favorites: Set<string>;
    toggleFavorite: (channelId: string) => void;
    isFavorite: (channelId: string) => boolean;
}

export const useLiveTvFavoritesStore = create<LiveTvFavoritesState>((set, get) => ({
    favorites: loadFavorites(),
    toggleFavorite: (channelId) => {
        const next = new Set(get().favorites);
        if (next.has(channelId)) {
            next.delete(channelId);
        } else {
            next.add(channelId);
        }
        persist(next);
        set({ favorites: next });
    },
    isFavorite: (channelId) => get().favorites.has(channelId),
}));