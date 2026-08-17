// ── Base event envelope ───────────────────────────────────────────────────────
export interface AnalyticsEvent {
  event: string;
  params?: Record<string, unknown>;
}

// ── Context (auto-attached to every event) ───────────────────────────────────
export interface AnalyticsContext {
  // Platform
  platform: string;
  platform_version: string;
  device_model: string;
  app_version: string;

  // Account (pseudonymized)
  account_id?: string;
  installation_id?: string;
  profile_id?: string;

  // Session
  session_id: string;
}

// ── P0: Activation ───────────────────────────────────────────────────────────
export interface AppLaunchEvent {
  event: 'app_launch';
  params?: {
    boot_duration_ms?: number;
  };
}

export interface PlatformConnectedEvent {
  event: 'platform_connected';
  params?: {
    bridge_version?: string;
  };
}

export interface AuthStartedEvent {
  event: 'authentication_started';
}

export interface AuthCompletedEvent {
  event: 'authentication_completed';
  params?: {
    method: 'device_code' | 'session_restored' | 'guest';
    duration_ms?: number;
  };
}

export interface HomeLoadedEvent {
  event: 'home_loaded';
  params?: {
    load_duration_ms?: number;
    content_rows?: number;
    has_banner?: boolean;
  };
}

// ── P0: Playback (core) ─────────────────────────────────────────────────────
export interface PlayIntentEvent {
  event: 'play_intent';
  params: {
    content_id: string;
    content_type: 'movie' | 'series' | 'live';
    source: 'home' | 'continue_watching' | 'search' | 'detail' | 'deep_link' | 'recommendation' | 'hero';
    episode_id?: string;
  };
}

export interface PlaybackStartEvent {
  event: 'playback_start';
  params: {
    content_id: string;
    content_type: 'movie' | 'series' | 'live';
    source: string;
    episode_id?: string;
    startup_time_ms?: number;
    quality?: string;
    audio?: string;
  };
}

export interface PlaybackErrorEvent {
  event: 'playback_error';
  params: {
    content_id: string;
    error_code?: string | number;
    error_message?: string;
    error_category: 'DRM' | 'MANIFEST' | 'MEDIA' | 'NETWORK' | 'PLAYER' | 'UNKNOWN';
    phase: 'load' | 'play' | 'running';
  };
}

export interface PlaybackCompleteEvent {
  event: 'playback_complete';
  params: {
    content_id: string;
    content_type: string;
    duration_s: number;
    watched_pct: number;
    episode_id?: string;
  };
}

// ── P1: Playback quality ────────────────────────────────────────────────────
export interface PlaybackBufferEvent {
  event: 'playback_buffer';
  params: {
    content_id: string;
    buffer_duration_ms: number;
    buffer_count: number;
  };
}

export interface PlaybackPauseEvent {
  event: 'playback_pause';
  params: {
    content_id: string;
    position_s: number;
  };
}

export interface PlaybackResumeEvent {
  event: 'playback_resume';
  params: {
    content_id: string;
    position_s: number;
  };
}

export interface PlaybackSeekEvent {
  event: 'playback_seek';
  params: {
    content_id: string;
    from_s: number;
    to_s: number;
  };
}

export interface PlaybackExitEvent {
  event: 'playback_exit';
  params: {
    content_id: string;
    position_s: number;
    duration_s: number;
    watched_pct: number;
    reason: 'back' | 'navigation' | 'error' | 'ended';
  };
}

// ── P0: Content ──────────────────────────────────────────────────────────────
export interface ContentSelectEvent {
  event: 'content_select';
  params: {
    content_id: string;
    content_type: string;
    title?: string;
    source: 'home' | 'search' | 'detail' | 'continue_watching' | 'recommendation' | 'hero' | 'live';
    row_id?: string;
    row_position?: number;
  };
}

export interface SearchSubmitEvent {
  event: 'search_submit';
  params: {
    query: string;
    results_count: number;
  };
}

export interface SearchResultSelectEvent {
  event: 'search_result_select';
  params: {
    query: string;
    content_id: string;
    position: number;
  };
}

// ── P1: Discovery ────────────────────────────────────────────────────────────
export interface ContentImpressionEvent {
  event: 'content_impression';
  params: {
    content_id: string;
    content_type: string;
    row_id: string;
    row_position: number;
    source_screen: string;
  };
}

export interface ContinueWatchingSelectEvent {
  event: 'continue_watching_select';
  params: {
    content_id: string;
    resume_position_s: number;
    total_duration_s: number;
    watched_pct: number;
  };
}

// ── P1: Navigation ───────────────────────────────────────────────────────────
export interface ScreenViewEvent {
  event: 'screen_view';
  params: {
    screen_name: string;
    previous_screen?: string;
  };
}

// ── P1: UX ───────────────────────────────────────────────────────────────────
export interface FocusDeadEndEvent {
  event: 'focus_dead_end';
  params: {
    screen: string;
    element: string;
    direction: 'up' | 'down' | 'left' | 'right';
  };
}

// ── P0: Errors ───────────────────────────────────────────────────────────────
export interface AppErrorEvent {
  event: 'app_error';
  params: {
    error_type: 'unhandled_rejection' | 'uncaught_error' | 'api_error' | 'auth_error';
    error_message: string;
    error_stack?: string;
    screen?: string;
  };
}

// ── P2: Feature flags ────────────────────────────────────────────────────────
export interface FeatureFlagEvent {
  event: 'feature_flag';
  params: {
    flag_name: string;
    variant: string;
  };
}

// ── Union type ───────────────────────────────────────────────────────────────
export type CinelarEvent =
  | AppLaunchEvent
  | PlatformConnectedEvent
  | AuthStartedEvent
  | AuthCompletedEvent
  | HomeLoadedEvent
  | PlayIntentEvent
  | PlaybackStartEvent
  | PlaybackErrorEvent
  | PlaybackCompleteEvent
  | PlaybackBufferEvent
  | PlaybackPauseEvent
  | PlaybackResumeEvent
  | PlaybackSeekEvent
  | PlaybackExitEvent
  | ContentSelectEvent
  | SearchSubmitEvent
  | SearchResultSelectEvent
  | ContentImpressionEvent
  | ContinueWatchingSelectEvent
  | ScreenViewEvent
  | FocusDeadEndEvent
  | AppErrorEvent
  | FeatureFlagEvent;
