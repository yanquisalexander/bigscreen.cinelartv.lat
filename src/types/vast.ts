export interface VastMediaFile {
  url: string;
  type: string;
  width: number;
  height: number;
  bitrate: number;
}

export interface VastAd {
  id?: string;
  system?: string;
  title?: string;
  impressionUrls: string[];
  clickThroughUrl?: string;
  mediaFiles: VastMediaFile[];
  duration: number;
  skipOffset: number;
  errorUrls: string[];
  trackingEvents: { event: string; url: string }[];
}

export type AdBreakType = 'preroll' | 'midroll' | 'postroll';

export interface AdBreak {
  type: AdBreakType;
  timeOffset?: number;
  tagUrl: string;
}

export interface AdConfig {
  prerollTag: string;
  postrollTag: string;
  midrollInterval: number;
  midrollTag: string;
  maxWrapperDepth: number;
  skipOffset: number;
}
