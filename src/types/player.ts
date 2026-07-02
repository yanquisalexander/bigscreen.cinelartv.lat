export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  isBuffering: boolean;
  isSeeking: boolean;
  volume: number;
  isMuted: boolean;
}

export interface SkipSegment {
  type: 'intro' | 'resume';
  start: number;
  end: number;
}
