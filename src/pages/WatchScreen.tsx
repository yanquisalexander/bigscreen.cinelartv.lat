import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getWatchData, updateProgress } from '@/features/content/api';
import { useKeyHandler } from '@/hooks/useKeyHandler';
import { formatTime, classNames, resolveImageUrl } from '@/utils/helpers';
import {
  LucideArrowLeft,
  LucidePlay,
  LucidePause,
  LucideRotateCcw,
  LucideRotateCw,
  LucideChevronsRight,
  LucideLoader2,
  LucideX,
  LucideList,
} from 'lucide-react';
import type { WatchData, Segment, WatchEpisode } from '@/types/content';
import type { PlayerState } from '@/types/player';

const ACCENT = '#7C5CFF';

type FlatEpisode = WatchEpisode & { seasonNumber: number };

export function WatchScreen() {
  const { contentId, episodeId } = useParams<{ contentId: string; episodeId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);

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
  const [episodesPanelOpen, setEpisodesPanelOpen] = useState(false);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Next episode state ---
  const [nextEpisode, setNextEpisode] = useState<FlatEpisode | null>(null);
  const [showNextCard, setShowNextCard] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(10);
  const nextTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextShowingRef = useRef(false);

  const streamUrl = watchData?.sources?.[0]?.url;

  // --- Flatten episodes from seasons ---
  const allEpisodes = useMemo<FlatEpisode[]>(() => {
    if (!watchData?.seasons) return [];
    const result: FlatEpisode[] = [];
    for (const season of watchData.seasons) {
      const seasonNum = season.position ?? 1;
      for (const ep of season.episodes ?? []) {
        result.push({ ...ep, seasonNumber: seasonNum });
      }
    }
    return result;
  }, [watchData?.seasons]);

  const currentEpisodeIndex = useMemo(() => {
    if (!episodeId || allEpisodes.length === 0) return -1;
    return allEpisodes.findIndex((ep) => String(ep.id) === String(episodeId));
  }, [allEpisodes, episodeId]);

  // Season number for the current episode (from season_id lookup)
  const currentSeasonNumber = useMemo(() => {
    if (!watchData?.episode?.season_id || !watchData?.seasons) return null;
    const idx = watchData.seasons.findIndex((s) => s.id === watchData.episode!.season_id);
    return idx >= 0 ? (watchData.seasons[idx].position ?? idx + 1) : null;
  }, [watchData]);

  // --- Find next episode ---
  useEffect(() => {
    if (currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1) {
      setNextEpisode(allEpisodes[currentEpisodeIndex + 1]);
    } else {
      setNextEpisode(null);
    }
  }, [currentEpisodeIndex, allEpisodes]);

  // --- Collect all segments (episode + content) ---
  const allSegments = useMemo(() => {
    const epSegs = watchData?.episode?.segments ?? [];
    const contentSegs = watchData?.content?.segments ?? [];
    return [...epSegs, ...contentSegs];
  }, [watchData]);

  const { ref, focusKey } = useFocusable({
    focusKey: 'watch-root',
    trackChildren: true,
    preferredChildFocusKey: 'watch-playpause',
  });

  // --- Load watch data ---
  useEffect(() => {
    if (!tokens || !contentId) return;
    getWatchData(tokens.accessToken, contentId, episodeId)
      .then((data) => setWatchData(data))
      .catch(() => navigate('/home', { replace: true }));
  }, [tokens, contentId, episodeId, navigate]);

  // --- Setup video ---
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
    const onEnded = () => {
      // Auto-play next episode if available
      if (nextEpisode) {
        navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
      } else {
        navigate(-1);
      }
    };

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

      // Detect skip segments
      const active = allSegments.find((s) => {
        const start = s.start ?? s.start_time ?? 0;
        const end = s.end ?? s.end_time ?? 0;
        return ct >= start && ct <= end && (s.type === 'intro' || s.segment_type === 'skip_intro' || s.type === 'resume' || s.segment_type === 'skip_resume');
      });
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
  }, [streamUrl, watchData, navigate, contentId, nextEpisode, allSegments]);

  // Auto-hide controls when video starts playing
  useEffect(() => {
    if (playerState.isPlaying && showControls) {
      showControlsTemporarily();
    }
  }, [playerState.isPlaying, showControls, showControlsTemporarily]);

  // --- Progress reporting ---
  useEffect(() => {
    if (!tokens || !contentId || !watchData) return;

    progressTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && video.duration) {
        updateProgress(
          tokens.accessToken,
          contentId,
          episodeId,
          video.currentTime,
          video.duration,
        ).catch(() => { });
      }
    }, 10000);

    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, [tokens, contentId, watchData]);

  // --- Next episode detection (near end or next_episode segment) ---
  useEffect(() => {
    if (!nextEpisode) {
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
      nextShowingRef.current = false;
      setShowNextCard(false);
      return;
    }

    const ct = playerState.currentTime;
    const dur = playerState.duration;

    const nextEpSegment = allSegments.find(
      (seg) => (seg.segment_type === 'next_episode') && seg.start_time !== null && ct >= (seg.start_time ?? 0),
    );
    const nearEnd = dur > 0 && (dur - ct) <= 30;
    const shouldShow = !!(nextEpSegment || nearEnd) && nextEpisode;

    if (shouldShow && !nextShowingRef.current) {
      nextShowingRef.current = true;
      setShowNextCard(true);
      setNextCountdown(10);
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
      nextTimerRef.current = setInterval(() => {
        setNextCountdown((prev) => {
          if (prev <= 1) {
            if (nextTimerRef.current) clearInterval(nextTimerRef.current);
            nextShowingRef.current = false;
            navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (!shouldShow && nextShowingRef.current) {
      nextShowingRef.current = false;
      setShowNextCard(false);
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
    }

    return () => {
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
    };
  }, [playerState.currentTime, playerState.duration, nextEpisode, allSegments, contentId, navigate]);

  // --- Cleanup next timer on unmount ---
  useEffect(() => {
    return () => {
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
    };
  }, []);

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
    const end = skipSegment.end ?? skipSegment.end_time ?? 0;
    videoRef.current.currentTime = end;
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

  const cancelNextEpisode = useCallback(() => {
    nextShowingRef.current = false;
    setShowNextCard(false);
    if (nextTimerRef.current) clearInterval(nextTimerRef.current);
  }, []);

  const playNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    cancelNextEpisode();
    navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
  }, [nextEpisode, contentId, navigate, cancelNextEpisode]);

  const navigateToEpisode = useCallback(
    (epId: string | number) => {
      setEpisodesPanelOpen(false);
      if (String(epId) === String(episodeId)) return;
      navigate(`/watch/${contentId}/${epId}`, { replace: true });
    },
    [episodeId, contentId, navigate],
  );

  const { handleKeyDown } = useKeyHandler({
    onBack: () => {
      if (episodesPanelOpen) {
        setEpisodesPanelOpen(false);
        return;
      }
      navigate(-1);
    },
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

  useEffect(() => {
    if (showControls) setFocus('watch-playpause');
  }, [showControls]);

  useEffect(() => {
    if (skipSegment) setFocus('watch-skip');
  }, [skipSegment]);

  // Auto-focus skip button when it appears and controls are hidden
  useEffect(() => {
    if (skipSegment && !showControls) {
      setFocus('watch-skip');
    }
  }, [skipSegment, showControls]);

  // Auto-focus next episode card when it appears and controls are hidden
  useEffect(() => {
    if (showNextCard && !showControls) {
      setFocus('watch-next-play');
    }
  }, [showNextCard, showControls]);

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
        <p className="text-white/50 text-base tracking-wide">Preparando la reproduccion…</p>
      </div>
    );
  }

  const duration = playerState.duration || 0;
  const progress = duration > 0 ? (playerState.currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (playerState.buffered / duration) * 100 : 0;

  const segments = allSegments;
  const chapterMarks = duration > 0
    ? segments
      .map((s) => (((s.start ?? s.start_time ?? 0) / duration) * 100))
      .filter((p) => p > 0.5 && p < 99.5)
    : [];

  const skipLabel = (skipSegment?.type === 'intro' || skipSegment?.segment_type === 'skip_intro')
    ? 'intro'
    : 'resumen';

  const isTVShow = watchData.content.content_type === 'TVSHOW';

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

        {/* Viñeta persistente */}
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
              {watchData.episode && (
                <p className="text-white/50 text-sm mt-1">
                  {isTVShow && currentSeasonNumber
                    ? `T${currentSeasonNumber} · `
                    : ''}
                  {watchData.episode.title}
                </p>
              )}
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
              >
                <LucideRotateCcw size={30} strokeWidth={1.9} />
              </Focusable>

              <Focusable
                onEnterPress={togglePlay}
                focusKey="watch-playpause"
                focusedClassName="scale-110 ring-4"
                className="w-24 h-24 rounded-full flex items-center justify-center text-black transition-transform duration-150 bg-white"
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
              >
                <LucideRotateCw size={30} strokeWidth={1.9} />
              </Focusable>
            </div>
          </div>

          {/* Scrim inferior + scrubber */}
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-20 pb-9 px-12 pointer-events-auto">
            {/* Botón lista de episodios (solo series) */}
            {isTVShow && allEpisodes.length > 0 && (
              <div className="flex justify-end mb-6">
                <Focusable
                  onEnterPress={() => setEpisodesPanelOpen(true)}
                  focusKey="watch-episodes-btn"
                  focusedClassName="scale-105 ring-4"
                  className="flex items-center gap-2 rounded-full pl-5 pr-4 py-2.5 text-white/80 text-sm font-medium transition-transform duration-150 bg-white/10"
                >
                  <LucideList size={16} />
                  <span>Episodios</span>
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
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white"
                  style={{
                    left: `calc(${progress}% - 8px)`,
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

        {/* --- SKIP INTRO/RESUME (siempre visible cuando hay segmento activo) --- */}
        {skipSegment && (
          <div className="absolute bottom-28 right-12 z-25 pointer-events-auto">
            <Focusable
              onEnterPress={handleSkip}
              focusKey="watch-skip"
              focusedClassName="scale-105 ring-4"
              className="flex items-center gap-2 rounded-full pl-6 pr-5 py-3.5 text-black text-base font-semibold transition-transform duration-150 bg-white"
            >
              Omitir {skipLabel}
              <LucideChevronsRight size={20} strokeWidth={2.5} />
            </Focusable>
          </div>
        )}

        {/* --- NEXT EPISODE CARD --- */}
        {showNextCard && nextEpisode && (
          <div className="absolute bottom-28 right-12 z-25 pointer-events-auto">
            <div className="bg-black/80 backdrop-blur-sm border border-white/10 rounded-2xl flex items-center gap-3 p-2.5 min-w-[280px]">
              {nextEpisode.thumbnail ? (
                <img
                  src={resolveImageUrl(nextEpisode.thumbnail, clientEndpoint) ?? undefined}
                  alt={nextEpisode.title}
                  className="w-[70px] h-[44px] rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                />
              ) : (
                <div className="w-[70px] h-[44px] rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
                  <LucidePlay size={18} className="text-neutral-500" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-xs font-medium">Siguiente en {nextCountdown}s</p>
                <p className="text-white text-sm font-semibold truncate">{nextEpisode.title}</p>
              </div>

              <div className="flex items-center gap-2.5 ml-2">
                <Focusable
                  onEnterPress={playNextEpisode}
                  focusKey="watch-next-play"
                  focusedClassName="scale-110 ring-4"
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black transition-transform"
                >
                  <LucidePlay size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
                </Focusable>
                <Focusable
                  onEnterPress={cancelNextEpisode}
                  focusKey="watch-next-cancel"
                  focusedClassName="scale-110 ring-4"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 transition-transform"
                >
                  <LucideX size={16} />
                </Focusable>
              </div>
            </div>
          </div>
        )}

        {/* --- EPISODES PANEL --- */}
        {episodesPanelOpen && (
          <EpisodesPanel
            episodes={allEpisodes}
            currentIndex={currentEpisodeIndex}
            onSelect={navigateToEpisode}
            onClose={() => setEpisodesPanelOpen(false)}
            clientEndpoint={clientEndpoint}
          />
        )}
      </div>
    </FocusContext.Provider>
  );
}

/* ─── Episodes Panel (overlay lateral derecho) ─── */

/* ─── Episodes Panel (overlay lateral derecho, estilo Google TV) ─── */

/* ─── Episodes Panel (overlay lateral derecho, estilo Google TV) ─── */

function EpisodesPanel({
  episodes,
  currentIndex,
  onSelect,
  onClose,
  clientEndpoint,
}: {
  episodes: FlatEpisode[];
  currentIndex: number;
  onSelect: (epId: string | number) => void;
  onClose: () => void;
  clientEndpoint: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const { ref: panelRef, focusKey } = useFocusable({
    focusKey: 'episodes-panel',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: currentIndex >= 0 ? `ep-item-${episodes[currentIndex]?.id}` : 'ep-close',
  });

  useEffect(() => {
    if (currentIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[currentIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentIndex]);

  const seasonCount = new Set(episodes.map((e) => e.seasonNumber)).size;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={(node) => {
          (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node?.querySelector('[data-ep-list]') ?? null;
        }}
        className="absolute inset-y-0 right-0 w-[480px] z-50 bg-[#0d0d0d]/97 backdrop-blur-md rounded-l-[32px] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-9 pb-5">
          <h2 className="text-white text-2xl font-bold tracking-tight">Episodios</h2>
          <Focusable
            onEnterPress={onClose}
            focusKey="ep-close"
            focusedClassName="bg-white text-black ring-4"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 transition-transform duration-150"
          >
            <LucideX size={19} />
          </Focusable>
        </div>

        {/* Episode list — tarjetas grandes tipo Google TV */}
        <div
          ref={listRef}
          data-ep-list
          className="flex-1 overflow-y-auto px-4 pb-6 hide-scrollbar"
        >
          {episodes.map((ep, index) => {
            const isActive = index === currentIndex;
            const thumbUrl = resolveImageUrl(ep.thumbnail, clientEndpoint);
            const showSeasonEyebrow = seasonCount > 1;

            return (
              <Focusable
                key={ep.id}
                focusKey={`ep-item-${ep.id}`}
                onEnterPress={() => onSelect(ep.id)}
                focusedClassName="bg-white/10 scale-[1.02]"
                className={classNames(
                  'flex gap-4 px-3 py-3 mb-1 rounded-3xl transition-transform duration-150 cursor-pointer',
                  isActive && 'bg-white/[0.04]',
                )}
              >
                {/* Miniatura 16:9 */}
                <div className="relative w-[168px] h-[94px] rounded-2xl overflow-hidden bg-neutral-800 flex-shrink-0">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <LucidePlay size={22} className="text-neutral-600" />
                    </div>
                  )}

                  {isActive && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                      <div className="flex items-end gap-[3px] h-4">
                        <div className="w-[3px] h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
                        <div className="w-[3px] h-4 rounded-full animate-pulse [animation-delay:0.15s]" style={{ backgroundColor: ACCENT }} />
                        <div className="w-[3px] h-3 rounded-full animate-pulse [animation-delay:0.3s]" style={{ backgroundColor: ACCENT }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-white/45 mb-1 uppercase tracking-wide">
                    {showSeasonEyebrow && <span>T{ep.seasonNumber}</span>}
                    {showSeasonEyebrow && <span className="text-white/25">·</span>}
                    <span>Ep {index + 1}</span>
                    {isActive && (
                      <>
                        <span className="text-white/25">·</span>
                        <span style={{ color: ACCENT }}>Reproduciendo</span>
                      </>
                    )}
                  </div>

                  <p className={classNames(
                    'text-[15px] font-semibold leading-snug truncate',
                    isActive ? 'text-white' : 'text-white/85',
                  )}>
                    {ep.title}
                  </p>

                  {ep.description && (
                    <p className="text-white/45 text-[13px] leading-snug mt-1 line-clamp-2">
                      {ep.description}
                    </p>
                  )}
                </div>
              </Focusable>
            );
          })}
        </div>
      </div>
    </FocusContext.Provider>
  );
}