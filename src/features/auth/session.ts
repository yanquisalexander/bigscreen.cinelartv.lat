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

export async function deassignProfile(
  accessToken: string,
): Promise<{ success: boolean }> {
  return apiRequest('/session/deassign-profile.json', {
    method: 'POST',
  }, accessToken);
}

export type { Profile };
