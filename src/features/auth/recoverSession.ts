import { useAuthStore } from '@/stores/authStore';
import { getCurrentSession } from '@/features/auth/session';
import { isTokenExpiringSoon } from '@/features/auth/tokenScheduler';

/**
 * Startup recovery: if tokens were persisted but the session fetch failed
 * on the previous run, refresh the access token if needed and re-fetch the
 * current session so the user is not left authenticated-but-orphaned.
 */
export async function recoverAuthSession(): Promise<void> {
  const state = useAuthStore.getState();
  if (!state.isAuthenticated || state.isGuest || !state.tokens?.accessToken) {
    return;
  }

  let accessToken = state.tokens.accessToken;

  if (isTokenExpiringSoon(state.tokens.expiresAt) && state.tokens.refreshToken) {
    const result = await useAuthStore.getState().refreshNow();
    if (result.ok) {
      accessToken = result.accessToken;
    } else if (result.tokenInvalid) {
      useAuthStore.getState().logout();
      return;
    }
  }

  try {
    const session = await getCurrentSession(accessToken);
    useAuthStore.getState().setSession(session);
  } catch {
    // Non-fatal: ProfileSelectScreen and apiRequest will retry on demand
  }
}
