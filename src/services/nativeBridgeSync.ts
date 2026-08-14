import { authStore } from '@/stores/authStore';
import {
  clearContinueWatching,
  syncGenericRecommendations,
  notifyNativeLogout,
  notifyNativeProfileChanged,
} from '@/services/NativeBridge';

export function initNativeBridgeSync() {
  return authStore.subscribe((state, prev) => {
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
}
