import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getWatchData, updateProgress } from '@/features/content/api';
import { useKeyHandler } from '@/hooks/useKeyHandler';
import { formatTime } from '@/utils/helpers';
import type { WatchData, Segment } from '@/types/content';
import type { PlayerState } from '@/types/player';

export function WatchScreen() {
  const { contentId, episodeId } = useParams<{ contentId: string; episodeId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [watchData, setWatchData] = useState<WatchData | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    isBuffering: false,
    isSeeking: false,
    volume: 1,
    isMuted: false,
  });
  const [showControls, setShowControls] = useState(true);
  const [skipSegment, setSkipSegment] = useState<Segment | null>(null);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const streamUrl = watchData?.sources?.[0]?.url;

  useEffect(() => {
    if (!tokens || !contentId) return;
    getWatchData(tokens.accessToken, contentId, episodeId)
      .then((data) => setWatchData(data))
      .catch(() => navigate('/home', { replace: true }));
  }, [tokens, contentId, episodeId, navigate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    video.src = streamUrl;

    if (watchData?.continue_watching?.progress) {
      video.currentTime = watchData.continue_watching.progress;
    }

    const onPlay = () => setPlayerState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setPlayerState((s) => ({ ...s, isPlaying: false }));
    const onTimeUpdate = () => {
      setPlayerState((s) => ({
        ...s,
        currentTime: video.currentTime,
        duration: video.duration || 0,
      }));
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setPlayerState((s) => ({
          ...s,
          buffered: video.buffered.end(video.buffered.length - 1),
        }));
      }
    };
    const onWaiting = () => setPlayerState((s) => ({ ...s, isBuffering: true }));
    const onCanPlay = () => setPlayerState((s) => ({ ...s, isBuffering: false }));
    const onEnded = () => {
      navigate(-1);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onEnded);

    video.play().catch(() => { });

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onEnded);
    };
  }, [streamUrl, watchData, navigate]);

  useEffect(() => {
    if (!tokens || !contentId || !watchData) return;

    progressTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && video.duration) {
        updateProgress(
          tokens.accessToken,
          contentId,
          video.currentTime,
          video.duration,
        ).catch(() => { });
      }
    }, 10000);

    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, [tokens, contentId, watchData]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !watchData) return;

    const segments = watchData.content?.segments ?? [];

    const checkSkip = () => {
      const t = video.currentTime;
      const active = segments.find((s) => t >= s.start && t <= s.end);
      setSkipSegment(active ?? null);
    };

    video.addEventListener('timeupdate', checkSkip);
    return () => video.removeEventListener('timeupdate', checkSkip);
  }, [watchData]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const seek = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration));
  }, []);

  const handleSkip = useCallback(() => {
    if (!skipSegment || !videoRef.current) return;
    videoRef.current.currentTime = skipSegment.end;
    setSkipSegment(null);
  }, [skipSegment]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 4000);
  }, []);

  const { handleKeyDown } = useKeyHandler({
    onBack: () => navigate(-1),
    onPlayPause: togglePlay,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      handleKeyDown(e);
      showControlsTemporarily();

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(10);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(-10);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKeyDown, seek, showControlsTemporarily, togglePlay]);

  if (!watchData || !streamUrl) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-text-secondary text-xl">Cargando player...</div>
      </div>
    );
  }

  const progress = playerState.duration > 0
    ? (playerState.currentTime / playerState.duration) * 100
    : 0;

  const skipLabel = skipSegment?.type
    ? skipSegment.type === 'intro' ? 'intro' : 'resumen'
    : 'intro';

  return (
    <div className="w-full h-full bg-black relative" onClick={showControlsTemporarily}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
      />

      {playerState.isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {showControls && (
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          <div className="flex items-center justify-between p-8 pointer-events-auto">
            <button
              onClick={() => navigate(-1)}
              className="glass rounded-full px-4 py-2 text-white flex items-center gap-2 hover:bg-white/10"
            >
              <span className="text-xl">&larr;</span>
              <span>Volver</span>
            </button>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">
                {watchData.content.title}
              </p>
            </div>
            <div className="w-24" />
          </div>

          <div className="flex-1 flex items-center justify-center pointer-events-auto">
            <div className="flex items-center gap-8">
              <button
                onClick={() => seek(-10)}
                className="glass rounded-full w-16 h-16 flex items-center justify-center text-white hover:bg-white/10"
              >
                <span className="text-2xl">&laquo; 10</span>
              </button>
              <button
                onClick={togglePlay}
                className="glass rounded-full w-20 h-20 flex items-center justify-center text-white hover:bg-white/10"
              >
                <span className="text-4xl">{playerState.isPlaying ? '⏸' : '▶'}</span>
              </button>
              <button
                onClick={() => seek(10)}
                className="glass rounded-full w-16 h-16 flex items-center justify-center text-white hover:bg-white/10"
              >
                <span className="text-2xl">10 &raquo;</span>
              </button>
            </div>
          </div>

          <div className="p-8 pointer-events-auto">
            {skipSegment && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleSkip}
                  className="glass rounded-full px-6 py-3 text-white font-medium hover:bg-white/10"
                >
                  Omitir {skipLabel}
                </button>
              </div>
            )}

            <div className="flex items-center gap-4">
              <span className="text-white text-sm font-mono w-16 text-right">
                {formatTime(playerState.currentTime)}
              </span>
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-white/60 text-sm font-mono w-16">
                {formatTime(playerState.duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
