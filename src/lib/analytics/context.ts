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

// ── Session ID & Engagement (per app open) ───────────────────────────────────
let _sessionStartSec = 0;
let _lastEventTime = 0;

export function initSession(): void {
  _sessionStartSec = Math.floor(Date.now() / 1000);
  _lastEventTime = Date.now();
}

export function getSessionStartSec(): number {
  if (!_sessionStartSec) initSession();
  return _sessionStartSec;
}

// ── Context builder ──────────────────────────────────────────────────────────
export function buildContext(): AnalyticsContext {
  const runtime = getRuntimeConfig();
  const auth = authStore.getState();

  const now = Date.now();
  if (!_lastEventTime) _lastEventTime = now;
  const engagementTime = Math.max(1, now - _lastEventTime);
  _lastEventTime = now;

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

    // GA4 session & engagement parameters (required for active user tracking)
    ga_session_id: getSessionStartSec(),
    ga_session_number: 1,
    engagement_time_msec: engagementTime,
    page_location: typeof window !== 'undefined' ? window.location.href : undefined,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
  };
}
