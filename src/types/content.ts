export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  banner?: string;
  cover?: string;
  banner_resized?: string;
  cover_resized?: string;
  content_type?: string;
  year?: number | null;
  liked?: boolean;
  progress?: number;
  trailer_url?: string | null;
  available?: boolean;
  premium?: boolean;
  tmdb_id?: string | null;
  collection?: boolean;
  seasons_count?: number;
  episodes_count?: number;
  segments?: Segment[];
  [key: string]: unknown;
}

export interface Segment {
  type?: string;
  segment_type?: string;
  start: number;
  end: number;
  start_time?: number;
  end_time?: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface ContentCategory {
  title: string;
  content?: ContentItem[];
}

export interface ExploreResponse {
  banner_content?: ContentItem[];
  content?: ContentCategory[];
}

export interface EpisodeContinueWatching {
  progress: number;
  duration: number;
}

export interface Episode {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  thumbnail_resized?: string;
  position: number | null;
  premium?: boolean;
  continue_watching?: EpisodeContinueWatching;
}

export interface Season {
  id: string;
  title: string;
  description?: string;
  episodes: Episode[];
}

export interface ContentContinueWatching {
  episode_id?: string;
  progress: number;
  duration: number;
}

export interface ContentDetail extends ContentItem {
  seasons?: Season[];
  related_content?: ContentItem[];
  categories?: Category[];
  continue_watching?: ContentContinueWatching;
}

export interface ContentSource {
  id: number;
  url: string;
  quality?: string;
}

export interface ContinueWatching {
  progress: number;
  duration: number;
  last_watched_at?: string;
  finished?: boolean;
}

export interface WatchContent {
  id: string;
  title: string;
  description?: string;
  content_type?: string;
  banner?: string;
  cover?: string;
  segments?: Segment[];
}

export interface WatchEpisode {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  thumbnail_resized?: string;
  position: number | null;
  premium?: boolean;
  season_id?: string;
  segments?: Segment[];
}

export interface WatchSeason {
  id: string;
  title: string;
  description?: string;
  content_id?: string;
  position: number | null;
  episodes: WatchEpisode[];
}

export interface WatchData {
  content: WatchContent;
  episode?: WatchEpisode;
  season?: WatchSeason;
  seasons?: WatchSeason[];
  continue_watching?: ContinueWatching;
  sources: ContentSource[];
}
