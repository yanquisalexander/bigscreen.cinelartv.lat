/**
 * Video pre-buffer: creates a hidden <video> element to warm up the browser's
 * HTTP cache and media pipeline before the user enters the player.
 *
 * The hidden element loads the manifest + initial segments but never plays.
 * When WatchScreen mounts and sets the same `src`, the browser serves from
 * its internal cache, eliminating the buffering spinner.
 */

const PREBUFFER_TTL_MS = 60_000; // discard if unused after 60s
const DATA_ATTR = 'data-prebuffer';

let activeElement: HTMLVideoElement | null = null;
let activeKey: string | null = null;
let discardTimer: ReturnType<typeof setTimeout> | null = null;

function isAdaptiveManifest(url: string): boolean {
  const pathname = url.split('?')[0].toLowerCase();
  return pathname.endsWith('.m3u8') || pathname.endsWith('.mpd');
}

function cleanup() {
  if (discardTimer) {
    clearTimeout(discardTimer);
    discardTimer = null;
  }
  if (activeElement) {
    activeElement.removeAttribute('src');
    activeElement.load(); // aborts any in-flight network requests
    activeElement.remove();
    activeElement = null;
  }
  activeKey = null;
}

/**
 * Removes any orphaned prebuffer elements left behind by HMR or bugs.
 */
export function cleanupOrphanedPrebuffers(): void {
  document.querySelectorAll<HTMLVideoElement>(`video[${DATA_ATTR}]`).forEach((el) => {
    if (el !== activeElement) {
      el.removeAttribute('src');
      el.load();
      el.remove();
    }
  });
}

// Clean up orphans from previous HMR reloads
cleanupOrphanedPrebuffers();

function scheduleDiscard() {
  if (discardTimer) clearTimeout(discardTimer);
  discardTimer = setTimeout(() => {
    cleanup();
  }, PREBUFFER_TTL_MS);
}

/**
 * Start pre-buffering a stream URL. No-ops if the same URL is already active.
 * Call this as soon as the stream URL is known (after prefetchWatchData resolves).
 */
export function prebufferStream(
  streamUrl: string,
  contentId: string | number,
  episodeId?: string | number,
): void {
  // Shaka owns MediaSource buffering for adaptive manifests. A second video
  // competes for network, memory and decoder resources on constrained TVs, but
  // cannot transfer its MSE buffer to the real player.
  if (isAdaptiveManifest(streamUrl)) {
    cleanup();
    return;
  }

  const key = episodeId ? `${contentId}:${episodeId}` : `${contentId}:`;
  if (activeKey === key && activeElement) {
    // Already pre-buffering this exact stream — just extend TTL
    scheduleDiscard();
    return;
  }

  // If there's a different stream active, abort it first
  cleanup();

  const video = document.createElement('video');
  video.setAttribute(DATA_ATTR, '');
  video.preload = 'auto';
  video.muted = true;
  video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px';
  video.src = streamUrl;

  document.body.appendChild(video);

  activeElement = video;
  activeKey = key;

  // When the browser has enough data to play without stalling, we're done.
  // We don't need to wait for the full download — just enough for canplay.
  const onCanPlay = () => {
    video.removeEventListener('canplay', onCanPlay);
    // Keep the element alive in the DOM so the browser keeps the cache warm.
    // WatchScreen will set the same src and the browser should hit cache.
    scheduleDiscard();
  };

  const onError = () => {
    video.removeEventListener('canplay', onCanPlay);
    video.removeEventListener('error', onError);
    cleanup();
  };

  video.addEventListener('canplay', onCanPlay);
  video.addEventListener('error', onError);

  // Safety: if canplay never fires within 15s, discard to free resources
  setTimeout(() => {
    if (activeElement === video && !video.readyState) {
      cleanup();
    }
  }, 15_000);
}

/**
 * Discard any active pre-buffer. Call on logout or route change away from detail.
 */
export function cancelPrebuffer(): void {
  cleanup();
}
