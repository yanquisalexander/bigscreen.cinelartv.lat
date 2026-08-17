import { initProvider, enqueue, flushProvider } from './provider';
import { initSession } from './context';

// ── Initialization ───────────────────────────────────────────────────────────
export function initAnalytics(): void {
  const id = import.meta.env.VITE_GA_ID;
  if (!id) {
    console.warn('[analytics] VITE_GA_ID not set — analytics disabled');
    return;
  }
  initSession();
  initProvider(id);
}

// ── P0: Activation ───────────────────────────────────────────────────────────
export function trackAppLaunch(): void {
  enqueue({
    event: 'app_launch',
    params: {
      boot_duration_ms: Math.round(performance.now()),
    },
  });
}

export function trackPlatformConnected(bridgeVersion?: string): void {
  enqueue({
    event: 'platform_connected',
    params: { bridge_version: bridgeVersion },
  });
}

export function trackAuthStarted(): void {
  enqueue({ event: 'authentication_started' });
}

export function trackAuthCompleted(
  method: 'device_code' | 'session_restored' | 'guest',
  durationMs?: number,
): void {
  enqueue({
    event: 'authentication_completed',
    params: { method, duration_ms: durationMs },
  });
}

export function trackHomeLoaded(loadDurationMs?: number, contentRows?: number, hasBanner?: boolean): void {
  enqueue({
    event: 'home_loaded',
    params: {
      load_duration_ms: loadDurationMs,
      content_rows: contentRows,
      has_banner: hasBanner,
    },
  });
}

// ── P0: Playback (core) ─────────────────────────────────────────────────────
export function trackPlayIntent(
  contentId: string,
  contentType: 'movie' | 'series' | 'live',
  source: 'home' | 'continue_watching' | 'search' | 'detail' | 'deep_link' | 'recommendation' | 'hero',
  episodeId?: string,
): void {
  enqueue({
    event: 'play_intent',
    params: { content_id: contentId, content_type: contentType, source, episode_id: episodeId },
  });
}

export function trackPlaybackStart(
  contentId: string,
  contentType: 'movie' | 'series' | 'live',
  source: string,
  startupTimeMs?: number,
  quality?: string,
  audio?: string,
  episodeId?: string,
): void {
  enqueue({
    event: 'playback_start',
    params: {
      content_id: contentId,
      content_type: contentType,
      source,
      episode_id: episodeId,
      startup_time_ms: startupTimeMs,
      quality,
      audio,
    },
  });
}

export function trackPlaybackError(
  contentId: string,
  errorCode: string | number | undefined,
  errorMessage: string | undefined,
  errorCategory: 'DRM' | 'MANIFEST' | 'MEDIA' | 'NETWORK' | 'PLAYER' | 'UNKNOWN',
  phase: 'load' | 'play' | 'running',
): void {
  enqueue({
    event: 'playback_error',
    params: {
      content_id: contentId,
      error_code: errorCode,
      error_message: errorMessage,
      error_category: errorCategory,
      phase,
    },
  });
}

export function trackPlaybackComplete(
  contentId: string,
  contentType: string,
  durationS: number,
  watchedPct: number,
  episodeId?: string,
): void {
  enqueue({
    event: 'playback_complete',
    params: {
      content_id: contentId,
      content_type: contentType,
      duration_s: Math.round(durationS),
      watched_pct: Math.round(watchedPct),
      episode_id: episodeId,
    },
  });
}

// ── P1: Playback quality ────────────────────────────────────────────────────
export function trackPlaybackBuffer(
  contentId: string,
  bufferDurationMs: number,
  bufferCount: number,
): void {
  enqueue({
    event: 'playback_buffer',
    params: {
      content_id: contentId,
      buffer_duration_ms: Math.round(bufferDurationMs),
      buffer_count: bufferCount,
    },
  });
}

export function trackPlaybackPause(contentId: string, positionS: number): void {
  enqueue({
    event: 'playback_pause',
    params: { content_id: contentId, position_s: Math.round(positionS) },
  });
}

export function trackPlaybackResume(contentId: string, positionS: number): void {
  enqueue({
    event: 'playback_resume',
    params: { content_id: contentId, position_s: Math.round(positionS) },
  });
}

export function trackPlaybackSeek(contentId: string, fromS: number, toS: number): void {
  enqueue({
    event: 'playback_seek',
    params: { content_id: contentId, from_s: Math.round(fromS), to_s: Math.round(toS) },
  });
}

export function trackPlaybackExit(
  contentId: string,
  positionS: number,
  durationS: number,
  watchedPct: number,
  reason: 'back' | 'navigation' | 'error' | 'ended',
): void {
  enqueue({
    event: 'playback_exit',
    params: {
      content_id: contentId,
      position_s: Math.round(positionS),
      duration_s: Math.round(durationS),
      watched_pct: Math.round(watchedPct),
      reason,
    },
  });
}

// ── P0: Content ──────────────────────────────────────────────────────────────
export function trackContentSelect(
  contentId: string,
  contentType: string,
  source: 'home' | 'search' | 'detail' | 'continue_watching' | 'recommendation' | 'hero' | 'live',
  title?: string,
  rowId?: string,
  rowPosition?: number,
): void {
  enqueue({
    event: 'content_select',
    params: {
      content_id: contentId,
      content_type: contentType,
      title,
      source,
      row_id: rowId,
      row_position: rowPosition,
    },
  });
}

export function trackSearchSubmit(query: string, resultsCount: number): void {
  enqueue({
    event: 'search_submit',
    params: { query, results_count: resultsCount },
  });
}

export function trackSearchResultSelect(query: string, contentId: string, position: number): void {
  enqueue({
    event: 'search_result_select',
    params: { query, content_id: contentId, position },
  });
}

// ── P1: Discovery ────────────────────────────────────────────────────────────
export function trackContentImpression(
  contentId: string,
  contentType: string,
  rowId: string,
  rowPosition: number,
  sourceScreen: string,
): void {
  enqueue({
    event: 'content_impression',
    params: {
      content_id: contentId,
      content_type: contentType,
      row_id: rowId,
      row_position: rowPosition,
      source_screen: sourceScreen,
    },
  });
}

export function trackContinueWatchingSelect(
  contentId: string,
  resumePositionS: number,
  totalDurationS: number,
): void {
  const watchedPct = totalDurationS > 0 ? (resumePositionS / totalDurationS) * 100 : 0;
  enqueue({
    event: 'continue_watching_select',
    params: {
      content_id: contentId,
      resume_position_s: Math.round(resumePositionS),
      total_duration_s: Math.round(totalDurationS),
      watched_pct: Math.round(watchedPct),
    },
  });
}

// ── P1: Navigation ───────────────────────────────────────────────────────────
let _previousScreen = '';

export function trackScreenView(screenName: string): void {
  enqueue({
    event: 'screen_view',
    params: {
      screen_name: screenName,
      previous_screen: _previousScreen || undefined,
    },
  });
  _previousScreen = screenName;
}

// ── P1: UX ───────────────────────────────────────────────────────────────────
export function trackFocusDeadEnd(
  screen: string,
  element: string,
  direction: 'up' | 'down' | 'left' | 'right',
): void {
  enqueue({
    event: 'focus_dead_end',
    params: { screen, element, direction },
  });
}

// ── P0: Errors ───────────────────────────────────────────────────────────────
export function trackAppError(
  errorType: 'unhandled_rejection' | 'uncaught_error' | 'api_error' | 'auth_error',
  errorMessage: string,
  errorStack?: string,
  screen?: string,
): void {
  enqueue({
    event: 'app_error',
    params: {
      error_type: errorType,
      error_message: errorMessage.slice(0, 500),
      error_stack: errorStack?.slice(0, 500),
      screen,
    },
  });
}

// ── Utility ──────────────────────────────────────────────────────────────────
export function flushAnalytics(): void {
  flushProvider();
}
