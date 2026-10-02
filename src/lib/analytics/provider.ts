import { buildContext } from './context';
import type { AnalyticsEvent } from './types';
import { authStore } from '@/stores/authStore';

// ── Minimal GA4 — Measurement Protocol (no gtag.js, no GTM) ──────────────────
// Sends events directly to google-analytics.com/mp/collect

const ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const FLUSH_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30000; // Keep-alive for active user realtime tracking
const MAX_BATCH_SIZE = 20;
const CLIENT_ID_KEY = 'cinelar_ga_cid';

let _measurementId = '';
let _queue: AnalyticsEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _enabled = false;
let _debugMode = false;

// ── Client ID (persistent per device, GA4 standard format: <random>.<timestamp>) ────
function getClientId(): string {
  try {
    let cid = localStorage.getItem(CLIENT_ID_KEY);
    if (cid && /^\d+\.\d+$/.test(cid)) return cid;
    cid = `${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}`;
    localStorage.setItem(CLIENT_ID_KEY, cid);
    return cid;
  } catch {
    return `${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}`;
  }
}

// ── Build URL with api_secret (always) + debug_secret (only in debug) ────────
// NOTE: /mp/collect rejects CORS preflights (OPTIONS → 405), so callers must
// send a CORS-simple request (see PLAIN_CONTENT_TYPE) to avoid preflight.
function buildUrl(debug = false): string {
  const base = debug ? DEBUG_ENDPOINT : ENDPOINT;
  const apiSecret = import.meta.env.VITE_GA_API_SECRET ?? '';
  const debugSecret = _debugMode ? (import.meta.env.VITE_GA_DEBUG_SECRET ?? '') : '';
  return `${base}?measurement_id=${_measurementId}&api_secret=${apiSecret}${debugSecret ? `&debug_secret=${debugSecret}` : ''}`;
}

// GA4 MP does NOT answer OPTIONS preflights (405). `application/json` forces a
// preflight on fetch/XHR, so we send as text/plain (CORS-safelisted, no
// preflight). GA parses the JSON body regardless of the content type.
const PLAIN_CONTENT_TYPE = 'text/plain;charset=UTF-8';

// ── Wrap events payload with top-level attributes ──────────────────────────
function buildPayload(events: Array<{ name: string; params: Record<string, unknown> }>): object {
  const auth = authStore.getState();
  const userId = auth.session?.current_user?.id ? String(auth.session.current_user.id) : undefined;

  return {
    client_id: getClientId(),
    ...(userId ? { user_id: userId } : {}),
    events,
  };
}

// ── Send payload ─────────────────────────────────────────────────────────────
function post(payload: object): void {
  const body = JSON.stringify(payload);
  try {
    if (_debugMode) {
      // Validation server: verifies events without recording them.
      fetch(buildUrl(true), {
        method: 'POST',
        headers: { 'Content-Type': PLAIN_CONTENT_TYPE },
        body,
        keepalive: true,
      })
        .then(async (res) => {
          try {
            const data = await res.json();
            const messages = (data as { validationMessages?: unknown[] })?.validationMessages;
            if (messages?.length) {
              console.warn('[analytics] MP validation', JSON.stringify(messages));
            }
          } catch { /* non-JSON response, ignore */ }
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: PLAIN_CONTENT_TYPE });
      navigator.sendBeacon(buildUrl(), blob);
    } else {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildUrl(), true);
      xhr.setRequestHeader('Content-Type', PLAIN_CONTENT_TYPE);
      xhr.send(body);
    }
  } catch {
    // Silently fail — TV networks can be unreliable
  }
}

// ── Send single event to GA4 Measurement Protocol ───────────────────────────
function send(event: AnalyticsEvent): void {
  if (!_measurementId) return;

  const ctx = buildContext();
  const params: Record<string, unknown> = {
    ...ctx,
    ...event.params,
  };

  post(buildPayload([{ name: event.event, params }]));
}

// ── Flush queue ──────────────────────────────────────────────────────────────
function flush(): void {
  if (!_enabled || _queue.length === 0) return;

  let ctx: Record<string, unknown> = {};
  try {
    ctx = buildContext();
  } catch {
    // Context unavailable
  }

  const batch = _queue.splice(0, MAX_BATCH_SIZE);

  try {
    if (batch.length === 1) {
      send(batch[0]);
      return;
    }

    const events = batch.map(evt => ({
      name: evt.event,
      params: { ...ctx, ...evt.params },
    }));

    post(buildPayload(events));
  } catch {
    // Silently fail
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export function initProvider(measurementId: string): void {
  _measurementId = measurementId;
  _debugMode = import.meta.env.DEV ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

  _enabled = true;

  // Periodic flush
  if (!_flushTimer) {
    _flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  }

  // Periodic user_engagement heartbeat (keeps active user status live in GA4 Realtime)
  if (!_heartbeatTimer) {
    _heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        enqueue({ event: 'user_engagement' });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  // Flush on page hide (TV apps may background)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', () => flush());
  }
}

export function enqueue(event: AnalyticsEvent): void {
  if (!_enabled) return;
  _queue.push(event);

  if (_queue.length >= MAX_BATCH_SIZE) {
    try { flush(); } catch { /* silently fail */ }
  }
}

export function flushProvider(): void {
  try { flush(); } catch { /* silently fail */ }
}

export function isProviderEnabled(): boolean {
  return _enabled;
}
