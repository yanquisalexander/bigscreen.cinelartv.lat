import type { TokenPair } from '@/types/auth';
import type { StoreApi } from 'zustand';

export type TokenSchedulerState = {
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  refreshNow: () => Promise<
    | { ok: true; accessToken: string }
    | { ok: false; tokenInvalid: boolean }
  >;
};

const EXPIRES_KEY = 'cinelar_token_expires_at';
const TOKEN_MARGIN_MS = 60_000;
const FALLBACK_INTERVAL_MS = 30 * 60 * 1000;
const MIN_DELAY_MS = 30_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let started = false;
let rearmGuard = false;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleDelay(expiresAt?: number): number {
  if (!expiresAt || !Number.isFinite(expiresAt)) return FALLBACK_INTERVAL_MS;
  const msUntilExpiry = expiresAt - Date.now();
  if (msUntilExpiry <= 0) return FALLBACK_INTERVAL_MS;
  return Math.max(MIN_DELAY_MS, msUntilExpiry - TOKEN_MARGIN_MS);
}

export function startTokenScheduler(store: StoreApi<TokenSchedulerState>): void {
  if (started) return;
  started = true;

  const arm = () => {
    clearTimer();
    const state = store.getState();

    // No armar si no está autenticado o no hay refresh token
    if (!state.isAuthenticated || state.isGuest || !state.tokens?.refreshToken) {
      return;
    }

    const delay = scheduleDelay(state.tokens.expiresAt);
    timer = setTimeout(async () => {
      // Re-leer el estado en el momento de ejecutar
      const currentState = store.getState();

      // Doble verificación antes de intentar refresh
      if (!currentState.isAuthenticated || currentState.isGuest || !currentState.tokens?.refreshToken) {
        return;
      }

      try {
        const result = await currentState.refreshNow();

        // Solo re-armar si el refresh fue exitoso
        if (!result.ok) {
          // Si el token es inválido, NO re-armar. El logout del store
          // actualizará el estado y el subscribe detendrá el scheduler.
          return;
        }

        // Re-armar solo si no hay una guardia activa
        if (rearmGuard) return;
        rearmGuard = true;
        arm();
        rearmGuard = false;
      } catch {
        // Si hay un error, no re-armar
      }
    }, delay);
  };

  unsubscribe = store.subscribe((state, prev) => {
    // Detener el scheduler si el usuario se desloguea o pierde autenticación
    if (!state.isAuthenticated || state.isGuest || !state.tokens?.refreshToken) {
      clearTimer();
      return;
    }

    // Re-armar solo si los tokens o el estado de autenticación cambiaron
    if (state.tokens !== prev.tokens || state.isAuthenticated !== prev.isAuthenticated) {
      arm();
    }
  });

  arm();
}

export function stopTokenScheduler(): void {
  clearTimer();
  unsubscribe?.();
  unsubscribe = null;
  started = false;
}

export function persistTokenExpiry(expiresAt?: number): void {
  try {
    if (expiresAt && Number.isFinite(expiresAt)) {
      localStorage.setItem(EXPIRES_KEY, String(expiresAt));
    } else {
      localStorage.removeItem(EXPIRES_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadTokenExpiry(): number | undefined {
  try {
    const raw = localStorage.getItem(EXPIRES_KEY);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function clearTokenExpiry(): void {
  try {
    localStorage.removeItem(EXPIRES_KEY);
  } catch {
    /* ignore */
  }
}

export function isTokenExpiringSoon(expiresAt?: number, marginMs = TOKEN_MARGIN_MS): boolean {
  if (!expiresAt || !Number.isFinite(expiresAt)) return false;
  return expiresAt - Date.now() < marginMs;
}