import type { ContentDetail, WatchData } from '@/types/content';
import { apiRequest } from '@/api/client';

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
