import { create } from 'zustand';
import type { TokenPair } from '@/types/auth';
import type { CurrentSessionResponse, Profile } from '@/types/api';

const TOKEN_KEY = 'cinelar_access_token';
const REFRESH_KEY = 'cinelar_refresh_token';
const SESSION_KEY = 'cinelar_session';
const PROFILE_KEY = 'cinelar_profile_id';

function loadTokens(): TokenPair | null {
  try {
    const access = localStorage.getItem(TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!access) return null;
    return { accessToken: access, refreshToken: refresh ?? undefined };
  } catch {
    return null;
  }
}

function saveTokens(tokens: TokenPair) {
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROFILE_KEY);
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
  isReady: boolean;

  login: (tokens: TokenPair) => void;
  logout: () => void;
  setSession: (session: CurrentSessionResponse) => void;
  setProfile: (profile: Profile) => void;
  updateTokens: (tokens: TokenPair) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  tokens: null,
  session: null,
  selectedProfile: null,
  isAuthenticated: false,
  isReady: false,

  initialize: () => {
    const tokens = loadTokens();
    const session = loadSession();
    const profileId = loadProfileId();

    if (tokens && session) {
      const profiles = session.current_user?.profiles ?? [];
      const profile = profiles.find((p) => p.id === profileId) ?? null;
      set({
        tokens,
        session,
        selectedProfile: profile ?? session.current_user?.current_profile ?? null,
        isAuthenticated: true,
        isReady: true,
      });
    } else {
      set({ isReady: true });
    }
  },

  login: (tokens: TokenPair) => {
    saveTokens(tokens);
    set({ tokens, isAuthenticated: true });
  },

  logout: () => {
    clearTokens();
    set({
      tokens: null,
      session: null,
      selectedProfile: null,
      isAuthenticated: false,
    });
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
      if (updated) profile = updated;
    }
    set({ session, selectedProfile: profile });
  },

  setProfile: (profile: Profile) => {
    saveProfileId(profile.id);
    set({ selectedProfile: profile });
  },

  updateTokens: (tokens: TokenPair) => {
    saveTokens(tokens);
    set({ tokens });
  },
}));
