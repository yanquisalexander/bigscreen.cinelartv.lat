import { getRuntimeConfig } from '@/runtime';
import { authStore } from '@/stores/authStore';
import type { AnalyticsContext } from './types';

// ── Installation ID (persistent per device) ──────────────────────────────────
const INSTALLATION_KEY = 'cinelar_installation_id';

function getOrCreateInstallationId(): string {
  try {
    let id = localStorage.getItem(INSTALLATION_KEY);
    if (id) return id;
    id = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(INSTALLATION_KEY, id);
    return id;
  } catch {
    return 'inst_unknown';
  }
}

// ── Session ID (per app open) ────────────────────────────────────────────────
let _sessionId = '';
let _sessionStartedAt = 0;

export function initSession(): void {
  _sessionId = `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  _sessionStartedAt = Date.now();
}

export function getSessionId(): string {
  if (!_sessionId) initSession();
  return _sessionId;
}

export function getSessionStartMs(): number {
  return _sessionStartedAt;
}

// ── Context builder ──────────────────────────────────────────────────────────
export function buildContext(): AnalyticsContext {
  const runtime = getRuntimeConfig();
  const auth = authStore.getState();

  return {
    // Platform (from runtime detection)
    platform: runtime.device.family,
    platform_version: runtime.device.os,
    device_model: runtime.device.model ?? 'unknown',
    app_version: import.meta.env.VITE_APP_VERSION ?? 'dev',

    // Account (pseudonymized — no PII)
    account_id: auth.session?.current_user?.id
      ? `acc_${auth.session.current_user.id}`
      : undefined,
    installation_id: getOrCreateInstallationId(),
    profile_id: auth.selectedProfile?.id
      ? `prof_${auth.selectedProfile.id}`
      : undefined,

    // Session
    session_id: getSessionId(),
  };
}
