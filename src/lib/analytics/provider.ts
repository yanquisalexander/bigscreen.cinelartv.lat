import { buildContext } from './context';
import type { AnalyticsEvent } from './types';

// ── Minimal GA4 — Measurement Protocol (no gtag.js, no GTM) ──────────────────
// Sends events directly to google-analytics.com/mp/collect
// ~1.5kB vs 73kB for the full gtag.js library

const ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const FLUSH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 20;
const CLIENT_ID_KEY = 'cinelar_ga_cid';

let _measurementId = '';
let _queue: AnalyticsEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _enabled = false;
let _debugMode = false;

// ── Client ID (persistent per device) ────────────────────────────────────────
function getClientId(): string {
  try {
    let cid = localStorage.getItem(CLIENT_ID_KEY);
    if (cid) return cid;
    cid = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(CLIENT_ID_KEY, cid);
    return cid;
  } catch {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

// ── Send to GA4 Measurement Protocol ─────────────────────────────────────────
function send(event: AnalyticsEvent): void {
  if (!_measurementId) return;

  const ctx = buildContext();
  const params: Record<string, unknown> = {
    ...ctx,
    ...event.params,
  };

  const payload = {
    client_id: getClientId(),
    events: [{
      name: event.event,
      params,
    }],
  };

  const secret = _debugMode ? import.meta.env.VITE_GA_DEBUG_SECRET : '';
  const url = `${ENDPOINT}?measurement_id=${_measurementId}${secret ? `&debug_secret=${secret}` : ''}`;

  try {
    if (_debugMode) {
      fetch(url, { method: 'POST', body: JSON.stringify(payload), keepalive: true });
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(url, JSON.stringify(payload));
    } else {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.send(JSON.stringify(payload));
    }
  } catch {
    // Silently fail — TV networks can be unreliable
  }
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

  if (batch.length === 1) {
    // Single event — send directly
    send(batch[0]);
    return;
  }

  // Multiple events — batch into single request
  const events = batch.map(evt => ({
    name: evt.event,
    params: {
      ...ctx,
      ...evt.params,
    },
  }));

  const payload = {
    client_id: getClientId(),
    events,
  };

  const secret = _debugMode ? import.meta.env.VITE_GA_DEBUG_SECRET : '';
  const url = `${ENDPOINT}?measurement_id=${_measurementId}${secret ? `&debug_secret=${secret}` : ''}`;

  try {
    if (_debugMode) {
      fetch(url, { method: 'POST', body: JSON.stringify(payload), keepalive: true });
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(url, JSON.stringify(payload));
    } else {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.send(JSON.stringify(payload));
    }
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
  _flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

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

  if (_queue.length >= MAX_BATCH_SIZE) flush();
}

export function flushProvider(): void {
  flush();
}

export function isProviderEnabled(): boolean {
  return _enabled;
}
