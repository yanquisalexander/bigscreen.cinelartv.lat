import type { ExploreResponse } from '@/types/content';
import { apiRequest } from '@/api/client';

export async function getExplore(
  accessToken?: string,
  queryParams?: Record<string, unknown>
): Promise<ExploreResponse> {
  const searchParams = queryParams
    ? new URLSearchParams(
      Object.entries(queryParams).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value);
          }
          return acc;
        },
        {}
      )
    ).toString()
    : '';

  return apiRequest<ExploreResponse>(
    `/explore.json${searchParams ? `?${searchParams}` : ''}`,
    {
      method: 'GET',
    },
    accessToken
  );
}