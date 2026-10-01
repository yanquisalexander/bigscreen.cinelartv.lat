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
const ISSUED_KEY = 'cinelar_token_issued_at';

// Refrescar cuando quede el 20% de la vida del token.
// Nunca antes de 2 minutos ni con más de 30 min de anticipación.
const TOKEN_LIFETIME_FRACTION = 0.2;
const FALLBACK_INTERVAL_MS = 30 * 60 * 1000; // 30 min si no hay expiresAt
const MIN_DELAY_MS = 2 * 60_000;             // Mínimo 2 minutos entre refreshes
const MAX_MARGIN_MS = 30 * 60_000;           // Máximo 30 min de anticipación
const COOLDOWN_DELAY_MS = 30_000;            // 30 s si ya estamos dentro del margen o expirados

// setTimeout en JS usa un entero de 32 bits con signo. Delays mayores a 2^31-1 (~24.85 días)
// causan desbordamiento (integer overflow) en los navegadores, disparando la función INMEDIATAMENTE.
const MAX_TIMEOUT_MS = 2_147_483_647;

let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let started = false;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Calcula cuántos ms esperar antes de refrescar.
 * Usa el 20% del lifetime del token como margen, con floor/ceil sensatos.
 * Garantiza un límite máximo de MAX_TIMEOUT_MS para evitar desbordamiento de entero en setTimeout.
 */
function scheduleDelay(expiresAt?: number): number {
  if (!expiresAt || !Number.isFinite(expiresAt)) return FALLBACK_INTERVAL_MS;

  const now = Date.now();
  const msUntilExpiry = expiresAt - now;
  if (msUntilExpiry <= 0) return COOLDOWN_DELAY_MS;

  // Intentar recuperar issuedAt para calcular el lifetime real
  const issuedAt = loadTokenIssuedAt();
  const lifetime = issuedAt ? expiresAt - issuedAt : msUntilExpiry;
  const margin = Math.min(Math.max(lifetime * TOKEN_LIFETIME_FRACTION, MIN_DELAY_MS), MAX_MARGIN_MS);

  const rawDelay = msUntilExpiry - margin;
  if (rawDelay <= 0) return COOLDOWN_DELAY_MS;

  // Limitar al entero máximo de 32 bits para evitar desbordamiento de setTimeout
  return Math.min(rawDelay, MAX_TIMEOUT_MS);
}

export function startTokenScheduler(store: StoreApi<TokenSchedulerState>): void {
  if (started) return;
  started = true;

  let refreshInProgress = false;
  let pendingRearm = false;

  const arm = () => {
    clearTimer();
    const state = store.getState();

    if (!state.isAuthenticated || state.isGuest || !state.tokens?.refreshToken) {
      return;
    }

    const delay = scheduleDelay(state.tokens.expiresAt);
    timer = setTimeout(async () => {
      const currentState = store.getState();

      if (!currentState.isAuthenticated || currentState.isGuest || !currentState.tokens?.refreshToken) {
        return;
      }

      refreshInProgress = true;
      pendingRearm = false;
      try {
        const result = await currentState.refreshNow();
        if (!result.ok) {
          // El subscriber detectará el logout y detendrá el scheduler
          return;
        }
        // Si los tokens cambiaron, el subscriber ya marcó pendingRearm.
        // Si no cambiaron (cooldown), re-armar manualmente.
        if (!pendingRearm) {
          arm();
        }
      } catch {
        // Error de red: no re-armar, se rearmará en el próximo cambio de estado
      } finally {
        refreshInProgress = false;
        if (pendingRearm) {
          pendingRearm = false;
          arm();
        }
      }
    }, delay);
  };

  unsubscribe = store.subscribe((state, prev) => {
    if (!state.isAuthenticated || state.isGuest || !state.tokens?.refreshToken) {
      clearTimer();
      return;
    }

    if (state.tokens !== prev.tokens || state.isAuthenticated !== prev.isAuthenticated) {
      if (refreshInProgress) {
        // El refresh está en vuelo: marcar para re-armar al terminar
        pendingRearm = true;
        return;
      }
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

export function persistTokenExpiry(expiresAt?: number, issuedAt?: number): void {
  try {
    if (expiresAt && Number.isFinite(expiresAt)) {
      localStorage.setItem(EXPIRES_KEY, String(expiresAt));
      localStorage.setItem(ISSUED_KEY, String(issuedAt ?? Date.now()));
    } else {
      localStorage.removeItem(EXPIRES_KEY);
      localStorage.removeItem(ISSUED_KEY);
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

export function loadTokenIssuedAt(): number | undefined {
  try {
    const raw = localStorage.getItem(ISSUED_KEY);
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
    localStorage.removeItem(ISSUED_KEY);
  } catch {
    /* ignore */
  }
}

export function isTokenExpiringSoon(expiresAt?: number): boolean {
  if (!expiresAt || !Number.isFinite(expiresAt)) return false;
  const now = Date.now();
  if (expiresAt <= now) return true;
  // Considera expirado si queda menos del 20% del lifetime (mínimo 2 min)
  const issuedAt = loadTokenIssuedAt();
  const lifetime = issuedAt ? expiresAt - issuedAt : 60 * 60 * 1000; // fallback 1h
  const margin = Math.min(Math.max(lifetime * TOKEN_LIFETIME_FRACTION, MIN_DELAY_MS), MAX_MARGIN_MS);
  return expiresAt - now < margin;
}
