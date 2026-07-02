import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { useAuthStore } from '@/stores/authStore';
import { getWatchData, updateProgress } from '@/features/content/api';
import { useKeyHandler } from '@/hooks/useKeyHandler';
import { formatTime, classNames } from '@/utils/helpers';
import {
  LucideArrowLeft,
  LucidePlay,
  LucidePause,
  LucideRotateCcw,
  LucideRotateCw,
  LucideChevronsRight,
  LucideLoader2,
} from 'lucide-react';
import type { WatchData, Segment } from '@/types/content';
import type { PlayerState } from '@/types/player';

// Acento de marca — usado con moderación: fill de progreso, focus rings, pulso de skip.
const ACCENT = '#7C5CFF';

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

  const { ref, focusKey } = useFocusable({
    focusKey: 'watch-root',
    trackChildren: true,
    preferredChildFocusKey: 'watch-playpause',
  });

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
    const onWaiting = () => setPlayerState((s) => ({ ...s, isBuffering: true }));
    const onCanPlay = () => setPlayerState((s) => ({ ...s, isBuffering: false }));
    const onEnded = () => navigate(-1);

    const segments = watchData?.content?.segments ?? [];
    let lastTimeUpdate = 0;

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdate < 250) return;
      lastTimeUpdate = now;

      const ct = video.currentTime;
      const dur = video.duration || 0;

      setPlayerState((s) => ({
        ...s,
        currentTime: ct,
        duration: dur,
      }));

      const active = segments.find((s) => ct >= s.start && ct <= s.end);
      setSkipSegment(active ?? null);
    };

    const onProgress = () => {
      if (video.buffered.length > 0) {
        setPlayerState((s) => ({
          ...s,
          buffered: video.buffered.end(video.buffered.length - 1),
        }));
      }
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
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKeyDown, showControlsTemporarily]);

  // El foco entra siempre en play/pause cuando aparecen los controles.
  useEffect(() => {
    if (showControls) setFocus('watch-playpause');
  }, [showControls]);

  // Cuando aparece un segmento de skip, el foco salta ahí para que "OK" lo omita al toque.
  useEffect(() => {
    if (skipSegment) setFocus('watch-skip');
  }, [skipSegment]);

  const handleProgressArrow = (direction: string) => {
    if (direction === 'left') {
      seek(-10);
      showControlsTemporarily();
      return false;
    }
    if (direction === 'right') {
      seek(10);
      showControlsTemporarily();
      return false;
    }
    return true;
  };

  if (!watchData || !streamUrl) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-5">
        <LucideLoader2 size={48} className="animate-spin" style={{ color: ACCENT }} />
        <p className="text-white/50 text-base tracking-wide">Preparando la reproducción…</p>
      </div>
    );
  }

  const duration = playerState.duration || 0;
  const progress = duration > 0 ? (playerState.currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (playerState.buffered / duration) * 100 : 0;

  const segments = watchData.content.segments ?? [];
  const chapterMarks = duration > 0
    ? segments.map((s) => ((s.start / duration) * 100)).filter((p) => p > 0.5 && p < 99.5)
    : [];

  const skipLabel = skipSegment?.type === 'intro' ? 'intro' : 'resumen';

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-full bg-black relative overflow-hidden select-none"
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
        />

        {/* Viñeta persistente para que el texto nunca quede sobre video crudo */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-60" />

        {playerState.isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <LucideLoader2 size={56} className="animate-spin" style={{ color: ACCENT }} />
          </div>
        )}

        <div
          className={classNames(
            'absolute inset-0 flex flex-col justify-between transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          {/* Scrim superior + navegación */}
          <div className="bg-gradient-to-b from-black/85 via-black/40 to-transparent pt-8 pb-16 px-12 pointer-events-auto">
            <Focusable
              onEnterPress={() => navigate(-1)}
              focusKey="watch-back"
              focusedClassName="bg-white !text-black scale-105"
              className="inline-flex items-center gap-2 text-white/90 rounded-full pl-3 pr-5 py-2.5 -ml-3 transition-transform duration-150"
            >
              <LucideArrowLeft size={22} strokeWidth={2.3} />
              <span className="text-sm font-semibold tracking-wide">Volver</span>
            </Focusable>

            <div className="mt-7 max-w-3xl">
              <h1 className="text-white font-bold leading-tight" style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)' }}>
                {watchData.content.title}
              </h1>
            </div>
          </div>

          {/* Transporte central */}
          <div className="flex-1 flex items-center justify-center pointer-events-auto">
            <div className="flex items-center gap-8">
              <Focusable
                onEnterPress={() => { seek(-10); showControlsTemporarily(); }}
                focusKey="watch-rewind"
                focusedClassName="bg-white/15 ring-4 scale-110"
                className="w-16 h-16 rounded-full flex items-center justify-center text-white/85 transition-transform duration-150"
                style={{ ['--tw-ring-color' as any]: ACCENT }}
              >
                <LucideRotateCcw size={30} strokeWidth={1.9} />
              </Focusable>

              <Focusable
                onEnterPress={togglePlay}
                focusKey="watch-playpause"
                focusedClassName="scale-110 ring-4"
                className="w-24 h-24 rounded-full flex items-center justify-center text-black transition-transform duration-150"
                style={{ backgroundColor: '#fff', ['--tw-ring-color' as any]: ACCENT }}
              >
                {playerState.isPlaying ? (
                  <LucidePause size={34} fill="currentColor" strokeWidth={0} />
                ) : (
                  <LucidePlay size={34} fill="currentColor" strokeWidth={0} className="ml-1" />
                )}
              </Focusable>

              <Focusable
                onEnterPress={() => { seek(10); showControlsTemporarily(); }}
                focusKey="watch-forward"
                focusedClassName="bg-white/15 ring-4 scale-110"
                className="w-16 h-16 rounded-full flex items-center justify-center text-white/85 transition-transform duration-150"
                style={{ ['--tw-ring-color' as any]: ACCENT }}
              >
                <LucideRotateCw size={30} strokeWidth={1.9} />
              </Focusable>
            </div>
          </div>

          {/* Scrim inferior + scrubber */}
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-20 pb-9 px-12 pointer-events-auto">
            {skipSegment && (
              <div className="flex justify-end mb-6">
                <Focusable
                  onEnterPress={handleSkip}
                  focusKey="watch-skip"
                  focusedClassName="scale-105 ring-4"
                  className="flex items-center gap-2 rounded-full pl-6 pr-5 py-3.5 text-black text-base font-semibold transition-transform duration-150"
                  style={{ backgroundColor: '#fff', ['--tw-ring-color' as any]: ACCENT }}
                >
                  Omitir {skipLabel}
                  <LucideChevronsRight size={20} strokeWidth={2.5} />
                </Focusable>
              </div>
            )}

            <Focusable
              onArrowPress={handleProgressArrow}
              focusKey="watch-progress"
              focusedClassName="scale-101"
              className="flex items-center gap-5 py-3 transition-transform duration-150"
            >
              <span className="text-white text-sm font-mono w-14 text-right tabular-nums">
                {formatTime(playerState.currentTime)}
              </span>

              <div className="relative flex-1 h-2 rounded-full">
                <div className="absolute inset-0 bg-white/20 rounded-full" />
                <div
                  className="absolute inset-y-0 left-0 bg-white/35 rounded-full transition-all"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: ACCENT }}
                />

                {chapterMarks.map((pct, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-black/50 rounded-full"
                    style={{ left: `${pct}%` }}
                  />
                ))}

                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
                  style={{
                    left: `calc(${progress}% - 8px)`,
                    backgroundColor: '#fff',
                    boxShadow: `0 0 0 5px ${ACCENT}55`,
                  }}
                />
              </div>

              <span className="text-white/50 text-sm font-mono w-14 tabular-nums">
                {formatTime(duration)}
              </span>
            </Focusable>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}