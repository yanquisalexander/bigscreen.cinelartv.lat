import { buildContext } from './context';
import type { AnalyticsEvent } from './types';

// ── GA4 gtag.js integration ──────────────────────────────────────────────────
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const FLUSH_INTERVAL_MS = 2000;
const MAX_QUEUE_SIZE = 20;

let _queue: AnalyticsEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _enabled = false;

// ── GA4 script loader ────────────────────────────────────────────────────────
function loadGA4(measurementId: string): void {
  if (typeof document === 'undefined') return;

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  }
  window.gtag = gtag;

  // gtag.js snippet
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', measurementId, {
    send_page_view: false, // SPA — we control page views manually
    app_name: 'CinelarTV',
    app_version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  });

  _enabled = true;
  if (import.meta.env.DEV) {
    console.log(`[analytics] GA4 initialized — ID: ${measurementId}`);
  }
}

// ── Flush queue to GA4 ──────────────────────────────────────────────────────
function flush(): void {
  if (!_enabled || !window.gtag || _queue.length === 0) return;

  let ctx: Record<string, unknown> = {};
  try {
    ctx = buildContext();
  } catch {
    // Context unavailable — still send events with minimal data
  }

  const events = _queue.splice(0, MAX_QUEUE_SIZE);

  for (const evt of events) {
    try {
      const params: Record<string, unknown> = {
        ...ctx,
        ...evt.params,
      };
      window.gtag('event', evt.event, params);
    } catch {
      // Individual event failed — continue with rest
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export function initProvider(measurementId: string): void {
  loadGA4(measurementId);

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

  // Flush immediately if queue is getting large
  if (_queue.length >= MAX_QUEUE_SIZE) flush();
}

export function flushProvider(): void {
  flush();
}

export function isProviderEnabled(): boolean {
  return _enabled;
}
