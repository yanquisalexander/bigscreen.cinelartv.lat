import type { ExploreResponse } from '@/types/content';
import { apiRequest } from '@/api/client';

export async function getExplore(accessToken: string): Promise<ExploreResponse> {
  return apiRequest<ExploreResponse>('/explore.json', {}, accessToken);
}
