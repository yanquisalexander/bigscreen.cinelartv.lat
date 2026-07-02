import type { CurrentSessionResponse, Profile } from '@/types/api';
import { apiRequest } from '@/api/client';

export async function getCurrentSession(accessToken: string): Promise<CurrentSessionResponse> {
  return apiRequest<CurrentSessionResponse>('/session/current.json', {}, accessToken);
}

export async function selectProfile(
  accessToken: string,
  profileId: string,
): Promise<{ success: boolean }> {
  return apiRequest('/session/select-profile.json', {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId }),
  }, accessToken);
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token?: string }> {
  return apiRequest('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export type { Profile };
