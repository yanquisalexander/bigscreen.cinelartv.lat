import type { ContentDetail, WatchData } from '@/types/content';
import { apiRequest } from '@/api/client';
import { prebufferStream, cancelPrebuffer } from './prebuffer';

// --- Prefetch cache for getWatchData ---
// Key: "contentId:episodeId" | "contentId:" (for movies)
// Value: { promise, timestamp }
const watchDataCache = new Map<string, { promise: Promise<WatchData>; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 60s

function watchDataCacheKey(contentId: string | number, episodeId?: string | number): string {
  return episodeId ? `${contentId}:${episodeId}` : `${contentId}:`;
}

function evictStaleCache() {
  const now = Date.now();
  for (const [key, entry] of watchDataCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      watchDataCache.delete(key);
    }
  }
}

export async function getContentById(
  accessToken: string,
  contentId: string | number,
): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(`/contents/${contentId}.json`, {}, accessToken);
}

export async function getWatchData(
  accessToken: string,
  contentId: string | number,
  episodeId?: string | number,
): Promise<WatchData> {
  const path = episodeId
    ? `/watch/${contentId}/${episodeId}.json`
    : `/watch/${contentId}.json`;
  const response = await apiRequest<{ data: WatchData }>(path, {}, accessToken);
  return response.data;
}

/**
 * Start a prefetch for getWatchData. Stores the in-flight promise so
 * WatchScreen can consume it without a duplicate network call.
 * Safe to call multiple times — subsequent calls for the same key are no-ops.
 */
export function prefetchWatchData(
  accessToken: string,
  contentId: string | number,
  episodeId?: string | number,
): void {
  evictStaleCache();
  const key = watchDataCacheKey(contentId, episodeId);
  if (watchDataCache.has(key)) return;

  const promise = getWatchData(accessToken, contentId, episodeId)
    .then((data) => {
      // Once we have the stream URL, start pre-buffering the video
      const streamUrl = data.sources?.[0]?.url;
      if (streamUrl) {
        prebufferStream(streamUrl, contentId, episodeId);
      }
      return data;
    })
    .catch((err) => {
    // On error, remove from cache so the next call retries
    watchDataCache.delete(key);
    throw err;
  });

  watchDataCache.set(key, { promise, timestamp: Date.now() });
}

/**
 * Consume a previously prefetched result. Returns the cached promise if
 * it exists and hasn't expired, otherwise starts a new fetch.
 */
export function consumeWatchData(
  accessToken: string,
  contentId: string | number,
  episodeId?: string | number,
): Promise<WatchData> {
  evictStaleCache();
  const key = watchDataCacheKey(contentId, episodeId);
  const cached = watchDataCache.get(key);

  if (cached) {
    watchDataCache.delete(key); // one-shot: consume once
    return cached.promise;
  }

  return getWatchData(accessToken, contentId, episodeId);
}

/** Drop any cached data (e.g. on logout). */
export function clearWatchDataCache(): void {
  watchDataCache.clear();
  cancelPrebuffer();
}

export async function updateProgress(
  accessToken: string,
  contentId: string | number,
  episodeId: string | number | undefined,
  progress: number,
  duration: number,
  deviceSessionToken?: string,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (deviceSessionToken) {
    headers['X-Device-Session-Token'] = deviceSessionToken;
  }
  await apiRequest(`/watch/${contentId}/progress.json`, {
    method: 'PUT',
    body: JSON.stringify({ progress, duration, episode_id: episodeId }),
    headers,
  }, accessToken);
}

export async function toggleLike(
  accessToken: string,
  contentId: string | number,
): Promise<{ liked: boolean }> {
  return apiRequest(`/contents/${contentId}/toggle_like.json`, {
    method: 'POST',
  }, accessToken);
}

export async function pingStream(
  accessToken: string,
  deviceSessionToken: string,
): Promise<void> {
  await apiRequest('/stream/ping', {
    method: 'POST',
    body: JSON.stringify({ device_session_token: deviceSessionToken }),
  }, accessToken);
}
