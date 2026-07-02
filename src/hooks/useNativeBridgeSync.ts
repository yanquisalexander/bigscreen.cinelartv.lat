import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  clearContinueWatching,
  syncGenericRecommendations,
  notifyNativeLogout,
  notifyNativeProfileChanged,
} from '@/services/NativeBridge';

export function useNativeBridgeSync() {
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (prev.isAuthenticated && !state.isAuthenticated) {
        clearContinueWatching();
        syncGenericRecommendations();
        notifyNativeLogout();
      } else if (prev.selectedProfile?.id && prev.selectedProfile?.id !== state.selectedProfile?.id) {
        clearContinueWatching();
        syncGenericRecommendations();
        notifyNativeProfileChanged();
      }
    });
    return unsub;
  }, []);
}
