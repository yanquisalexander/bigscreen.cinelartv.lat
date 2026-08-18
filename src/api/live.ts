import { apiRequest } from '@/api/client';

export interface LiveTvProgram {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  icon_url: string | null;
  category: string | null;
  currently_playing?: boolean;
}

export interface LiveTvChannel {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  stream_url: string;
  stream_format: string;
  is_active: boolean;
  xmltv_channel_id: string;
  current_program: LiveTvProgram | null;
  upcoming_programs: LiveTvProgram[];
}

interface LiveTvResponse {
  live_tv_channels: LiveTvChannel[];
}

export interface EpgGuideResponse {
  live_tv_channel_id: number;
  channel_name: string;
  start_time: string;
  end_time: string;
  programs: LiveTvProgram[];
}

export const getLiveTvChannels = async (accessToken?: string): Promise<LiveTvChannel[]> => {
  const data = await apiRequest<LiveTvResponse>('/live_tv.json', {}, accessToken);
  return data.live_tv_channels.filter((c) => c.is_active);
};

export const getChannelGuide = async (
  channelId: string,
  startTime?: string,
  endTime?: string,
  accessToken?: string,
): Promise<EpgGuideResponse> => {
  const params = new URLSearchParams();
  if (startTime) params.set('start_time', startTime);
  if (endTime) params.set('end_time', endTime);
  const qs = params.toString();
  const endpoint = `/live_tv/${channelId}/guide.json${qs ? `?${qs}` : ''}`;
  return apiRequest<EpgGuideResponse>(endpoint, {}, accessToken);
};
