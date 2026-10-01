import type { TokenPair } from '@/types/auth';
import { create } from 'zustand';
import type { CurrentSessionResponse, Profile } from '@/types/api';
import { zustandToSvelte } from '@/lib/zustandToSvelte';
import { getApiConfig } from '@/api/config';
import { requestTokenRefresh } from '@/features/auth/tokenRefresh';
import {
  loadTokenExpiry,
  loadTokenIssuedAt,
  persistTokenExpiry,
  clearTokenExpiry,
  isTokenExpiringSoon,
} from '@/features/auth/tokenScheduler';
import { getCurrentSession } from '@/features/auth/session';

const TOKEN_KEY = 'cinelar_access_token';
const REFRESH_KEY = 'cinelar_refresh_token';
const SESSION_KEY = 'cinelar_session';
const PROFILE_KEY = 'cinelar_profile_id';
const GUEST_KEY = 'cinelar_guest';

const REFRESH_COOLDOWN_MS = 30_000;

let refreshInFlight: Promise<RefreshNowResult> | null = null;
let lastRefreshAt = 0;

export type RefreshNowResult =
  | { ok: true; accessToken: string }
  | { ok: false; tokenInvalid: boolean };

function loadTokens(): TokenPair | null {
  try {
    const access = localStorage.getItem(TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!access) return null;
    return {
      accessToken: access,
      refreshToken: refresh ?? undefined,
      expiresAt: loadTokenExpiry(),
      issuedAt: loadTokenIssuedAt(),
    };
  } catch {
    return null;
  }
}

function saveTokens(tokens: TokenPair) {
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } else if (tokens.refreshToken === undefined) {
    localStorage.removeItem(REFRESH_KEY);
  }
  persistTokenExpiry(tokens.expiresAt, tokens.issuedAt);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(GUEST_KEY);
  clearTokenExpiry();
}

function loadSession(): CurrentSessionResponse | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurrentSessionResponse;
  } catch {
    return null;
  }
}

function saveSession(session: CurrentSessionResponse) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadProfileId(): string | null {
  return localStorage.getItem(PROFILE_KEY);
}

function saveProfileId(id: string) {
  localStorage.setItem(PROFILE_KEY, id);
}

interface AuthState {
  tokens: TokenPair | null;
  session: CurrentSessionResponse | null;
  selectedProfile: Profile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isReady: boolean;

  login: (tokens: TokenPair) => void;
  logout: () => void;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  setSession: (session: CurrentSessionResponse) => void;
  setProfile: (profile: Profile) => void;
  updateTokens: (tokens: TokenPair) => void;
  initialize: () => void;
  getRefreshToken: () => string | null;
  getAccessToken: () => string | null;
  refreshNow: () => Promise<RefreshNowResult>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  tokens: null,
  session: null,
  selectedProfile: null,
  isAuthenticated: false,
  isGuest: false,
  isReady: false,

  initialize: async () => {
    const tokens = loadTokens();
    const isGuest = localStorage.getItem(GUEST_KEY) === '1';

    if (tokens) {
      let session = loadSession();
      let accessToken = tokens.accessToken;

      if (isTokenExpiringSoon(tokens.expiresAt) && tokens.refreshToken) {
        const result = await get().refreshNow();
        if (result.ok) {
          accessToken = result.accessToken;
        } else if (result.tokenInvalid) {
          get().logout();
          set({ isReady: true });
          return;
        }
      }

      try {
        const freshSession = await getCurrentSession(accessToken);
        saveSession(freshSession);
        session = freshSession;
      } catch {
        // Fallback to cached session if offline
      }

      const profileId = loadProfileId();
      const profiles = session?.current_user?.profiles ?? [];
      let profile =
        profiles.find((p) => p.id === profileId) ??
        session?.current_user?.current_profile ??
        null;
      if (profileId && !profiles.find((p) => p.id === profileId)) {
        localStorage.removeItem(PROFILE_KEY);
        profile = null;
      }

      set({
        tokens,
        session,
        selectedProfile: profile,
        isAuthenticated: true,
        isGuest: false,
        isReady: true,
      });
    } else {
      set({ isGuest, isReady: true });
    }
  },

  login: (tokens: TokenPair) => {
    localStorage.removeItem(GUEST_KEY);
    const issuedAt = tokens.issuedAt ?? Date.now();
    saveTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      issuedAt,
    });
    set({
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        issuedAt,
      },
      isAuthenticated: true,
      isGuest: false,
    });
  },

  logout: () => {
    clearTokens();
    lastRefreshAt = 0;
    set({
      tokens: null,
      session: null,
      selectedProfile: null,
      isAuthenticated: false,
      isGuest: false,
    });
  },

  enterGuestMode: () => {
    localStorage.setItem(GUEST_KEY, '1');
    set({ isGuest: true, isReady: true });
  },

  exitGuestMode: () => {
    localStorage.removeItem(GUEST_KEY);
    set({ isGuest: false });
  },

  setSession: (session: CurrentSessionResponse) => {
    saveSession(session);
    const { selectedProfile } = get();
    const profiles = session.current_user?.profiles ?? [];
    let profile = selectedProfile;
    if (!profile && session.current_user?.current_profile) {
      profile = session.current_user.current_profile;
      saveProfileId(session.current_user.current_profile.id);
    } else if (profile) {
      const updated = profiles.find((p) => p.id === profile!.id);
      if (updated) {
        profile = updated;
      } else {
        profile = null;
        localStorage.removeItem(PROFILE_KEY);
      }
    }
    set({ session, selectedProfile: profile });
  },

  setProfile: (profile: Profile) => {
    saveProfileId(profile.id);
    set({ selectedProfile: profile });
  },

  updateTokens: (tokens: TokenPair) => {
    const current = get().tokens;

    // Evitar actualizaciones innecesarias que pueden disparar loops
    if (
      current &&
      current.accessToken === tokens.accessToken &&
      current.refreshToken === tokens.refreshToken &&
      current.expiresAt === tokens.expiresAt
    ) {
      return;
    }

    const merged: TokenPair = {
      accessToken: tokens.accessToken,
      refreshToken:
        tokens.refreshToken ??
        current?.refreshToken ??
        localStorage.getItem(REFRESH_KEY) ??
        undefined,
      expiresAt:
        tokens.expiresAt ??
        (current && tokens.accessToken === current.accessToken
          ? current.expiresAt
          : undefined),
      issuedAt:
        tokens.issuedAt ??
        current?.issuedAt ??
        (tokens.accessToken === current?.accessToken ? loadTokenIssuedAt() : undefined),
    };
    saveTokens(merged);
    set({ tokens: merged });
  },

  getRefreshToken: () => get().tokens?.refreshToken ?? null,

  getAccessToken: () => get().tokens?.accessToken ?? null,

  refreshNow: async (): Promise<RefreshNowResult> => {
    // Retornar inmediatamente si ya hay un refresh en vuelo
    if (refreshInFlight) return refreshInFlight;

    // Asignar la Promise inmediatamente para prevenir llamadas concurrentes
    refreshInFlight = (async (): Promise<RefreshNowResult> => {
      const state = get();
      const refreshToken = state.tokens?.refreshToken;
      const currentAccess = state.tokens?.accessToken;

      if (!refreshToken) {
        return { ok: false, tokenInvalid: state.isAuthenticated && !state.isGuest };
      }

      // Cooldown: evitar refreshes repetidos en corto plazo.
      // El check de expiresAt es una salvaguarda extra, pero el cooldown
      // debe aplicarse siempre que haya un refresh reciente, sin importar
      // si expiresAt está seteado o no.
      if (
        currentAccess &&
        lastRefreshAt > 0 &&
        Date.now() - lastRefreshAt < REFRESH_COOLDOWN_MS
      ) {
        return { ok: true, accessToken: currentAccess };
      }

      const { CLIENT_ENDPOINT } = getApiConfig();
      const outcome = await requestTokenRefresh(CLIENT_ENDPOINT, refreshToken);

      if (!outcome.ok) {
        return { ok: false, tokenInvalid: outcome.tokenInvalid };
      }

      lastRefreshAt = Date.now();
      get().updateTokens({
        accessToken: outcome.accessToken,
        refreshToken: outcome.refreshToken,
        expiresAt: outcome.expiresAt,
        issuedAt: outcome.issuedAt,
      });

      return { ok: true, accessToken: outcome.accessToken };
    })().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  },
}));

export const authStore = useAuthStore;
export const svelteAuthStore = zustandToSvelte(useAuthStore);