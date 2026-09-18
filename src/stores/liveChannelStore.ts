import { create } from 'zustand';
import type { LiveChannelInfo } from '@/platform/types';

interface LiveChannelState {
  channel: LiveChannelInfo | null;
  setChannel: (channel: LiveChannelInfo | null) => void;
}

export const liveChannelStore = create<LiveChannelState>((set) => ({
  channel: null,
  setChannel: (channel) => set({ channel }),
}));

export function consumeLiveChannel(): LiveChannelInfo | null {
  const ch = liveChannelStore.getState().channel;
  liveChannelStore.getState().setChannel(null);
  return ch;
}
