import type { ContentItem } from '@/types/content';
import { apiRequest } from '@/api/client';

export interface SearchResponse {
  data?: ContentItem[];
}

export async function searchContent(
  accessToken: string,
  query: string,
): Promise<SearchResponse> {
  if (!query.trim()) return {};
  return apiRequest<SearchResponse>(`/search.json?q=${encodeURIComponent(query.trim())}`, {}, accessToken);
}
