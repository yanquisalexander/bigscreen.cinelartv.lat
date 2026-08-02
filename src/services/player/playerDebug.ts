/**
 * Player debug instrumentation (TV-focused).
 *
 * Enabled via:
 *   - `?debug=1` in the URL, or
 *   - localStorage `cinelar_player_debug === '1'`
 *
 * `pdbg` emits timestamped markers so the initialization sequence can be
 * followed step by step from Chrome Remote Debugger when debugging
 * Android TV WebView playback issues.
 */

const enabled =
  typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).has('debug') ||
    (() => {
      try {
        return localStorage.getItem('cinelar_player_debug') === '1';
      } catch {
        return false;
      }
    })());

const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

export function pdbg(tag: string, ...args: unknown[]): void {
  if (!enabled) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  // eslint-disable-next-line no-console
  console.log(`[Player:${now.toFixed(1)}ms] ${tag}`, ...args);
}

export const playerDebugEnabled = enabled;

const MEDIA_EVENTS = [
  'loadedmetadata',
  'loadeddata',
  'canplay',
  'canplaythrough',
  'playing',
  'waiting',
  'stalled',
  'suspend',
  'play',
  'pause',
  'ended',
  'emptied',
  'abort',
  'durationchange',
  'readystatechange',
  'error',
  'visibilitychange',
] as const;

/** Attach logging listeners to a <video> element. Safe to call multiple times. */
export function instrumentVideo(video: HTMLVideoElement): void {
  if (!enabled) return;
  if ((video as HTMLVideoElement & { __pdbgInstrumented?: boolean }).__pdbgInstrumented) return;
  (video as HTMLVideoElement & { __pdbgInstrumented?: boolean }).__pdbgInstrumented = true;

  for (const ev of MEDIA_EVENTS) {
    video.addEventListener(ev, () => {
      if (ev === 'readystatechange') {
        pdbg(`video:${ev}`, `readyState=${video.readyState} networkState=${video.networkState}`);
      } else if (ev === 'error') {
        const detail = video.error ? `code=${video.error.code} (${video.error.message})` : 'no error detail';
        pdbg(`video:${ev}`, detail);
      } else if (ev === 'visibilitychange') {
        pdbg(`video:${ev}`, `document.visibilityState=${document.visibilityState}`);
      } else {
        pdbg(`video:${ev}`, `time=${video.currentTime.toFixed(2)} readyState=${video.readyState} paused=${video.paused}`);
      }
    });
  }
}
