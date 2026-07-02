import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getWatchData, updateProgress } from '@/features/content/api';
import { useKeyHandler } from '@/hooks/useKeyHandler';
import { formatTime, classNames, resolveImageUrl } from '@/utils/helpers';
import { addContinueWatching } from '@/services/NativeBridge';
import type { AndroidTvHomeItem } from '@/services/NativeBridge';
import {
  LucideArrowLeft,
  LucidePlay,
  LucidePause,
  LucideRotateCcw,
  LucideRotateCw,
  LucideChevronsRight,
  LucideLoader2,
  LucideX,
} from 'lucide-react';
import type { WatchData, Segment, WatchEpisode } from '@/types/content';
import type { PlayerState } from '@/types/player';
import { M3eLoadingIndicator } from "@m3e/react/loading-indicator";
import { useToastStore } from "@/stores/toastStore";

const ACCENT = '#FFFFFF';

// Cada cuánto se re-evalúan segmentos / next-episode / progreso "lógico".
// No afecta el suavizado visual de la seekbar, que corre por rAF aparte.
const LOGIC_TICK_MS = 1000;

type FlatEpisode = WatchEpisode & { seasonNumber: number };

export function WatchScreen() {
  const { contentId, episodeId } = useParams<{ contentId: string; episodeId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const toast = useToastStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [watchData, setWatchData] = useState<WatchData | null>(null);

  // IMPORTANTE: currentTime/duration/buffered YA NO viven acá. Antes cada
  // "timeupdate" (cada 250ms) disparaba setPlayerState -> re-render de TODO
  // el árbol (incluyendo el rail de episodios completo). Ahora esos valores
  // se leen directo de videoRef en el propio DOM (Seekbar) o en el tick de
  // 1Hz que solo maneja lógica (segmentos, next episode). Esto es lo que
  // más pesa en WebViews de Android TV, donde el motor de layout/paint es
  // mucho más limitado que en un browser de escritorio.
  const [playerState, setPlayerState] = useState<Pick<PlayerState, 'isPlaying' | 'isBuffering' | 'isSeeking' | 'volume' | 'isMuted'>>({
    isPlaying: false,
    isBuffering: false,
    isSeeking: false,
    volume: 1,
    isMuted: false,
  });
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [skipSegment, setSkipSegment] = useState<Segment | null>(null);

  // Foco dentro de la fila de episodios: alterna entre la vista de seekbar
  // y la vista expandida (título + descripción del episodio resaltado)
  const [railExpanded, setRailExpanded] = useState(false);
  const [focusedRailEpisode, setFocusedRailEpisode] = useState<FlatEpisode | null>(null);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // thumbUrl por episodio calculado una sola vez cuando cambia la lista,
  // en vez de en cada render de EpisodesRow (evita recomputar resolveImageUrl
  // por cada card en cada re-render).
  const episodesWithThumb = useMemo(
    () => allEpisodes.map((ep) => ({ ep, thumbUrl: resolveImageUrl(ep.thumbnail, clientEndpoint) })),
    [allEpisodes, clientEndpoint],
  );

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
    setWatchData(null);
    setPlayerState({
      isPlaying: false,
      isBuffering: false,
      isSeeking: false,
      volume: 1,
      isMuted: false,
    });
    setDuration(0);
    setSkipSegment(null);
    getWatchData(tokens.accessToken, contentId, episodeId)
      .then((data) => setWatchData(data))
      .catch(() => {
        useToastStore.getState().show('No se pudo cargar el contenido. Intenta de nuevo más tarde.', 'error', 4000);
        navigate('/home', { replace: true })
      });
  }, [tokens, contentId, episodeId, navigate]);

  // --- Setup video (solo eventos de bajo volumen: play/pause/waiting/canplay/ended/duration) ---
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
    const onDurationChange = () => setDuration(video.duration || 0);
    const onEnded = () => {
      // Auto-play next episode if available
      if (nextEpisode) {
        navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
      } else {
        navigate(-1);
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('loadedmetadata', onDurationChange);
    video.addEventListener('ended', onEnded);

    video.play().catch(() => { });

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('loadedmetadata', onDurationChange);
      video.removeEventListener('ended', onEnded);
    };
  }, [streamUrl, watchData, navigate, contentId, nextEpisode]);

  // --- Progress reporting al backend + NativeBridge (cada 10s, sin relación con el render) ---
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

        const cwItem: AndroidTvHomeItem = {
          content_id: contentId,
          episode_id: episodeId,
          title: watchData.content.title,
          description: watchData.episode?.title ?? watchData.content.description,
          content_type: watchData.content.content_type,
          cover: resolveImageUrl(watchData.content.cover, clientEndpoint),
          cover_resized: resolveImageUrl(watchData.content.cover, clientEndpoint),
          banner: resolveImageUrl(watchData.content.banner, clientEndpoint),
          banner_resized: resolveImageUrl(watchData.content.banner, clientEndpoint),
          progress: Math.round(video.currentTime * 1000),
          duration: Math.round(video.duration * 1000),
          image_url: resolveImageUrl(watchData.content.banner ?? watchData.content.cover, clientEndpoint),
          url: `/watch/${contentId}${episodeId ? `/${episodeId}` : ''}`,
          episode_title: watchData.season?.title && watchData.episode?.title
            ? `${watchData.season.title} - ${watchData.episode.title}`
            : watchData.episode?.title,
        };
        addContinueWatching(cwItem);
      }
    }, 10000);

    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, [tokens, contentId, watchData, clientEndpoint, episodeId]);

  // --- Tick de lógica a 1Hz: detección de segmento activo + next-episode ---
  // Antes esto corría dentro de "timeupdate" (hasta 4 veces por segundo) y
  // cada corrida terminaba en un setState que re-renderizaba el árbol
  // completo. Un segundo de resolución es más que suficiente para decidir
  // si mostrar "Omitir intro" o la tarjeta de siguiente episodio.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    logicTimerRef.current = setInterval(() => {
      const ct = video.currentTime;
      const dur = video.duration || 0;

      // Segmento de skip activo
      const active = allSegments.find((s) => {
        const start = s.start ?? s.start_time ?? 0;
        const end = s.end ?? s.end_time ?? 0;
        return ct >= start && ct <= end && (s.type === 'intro' || s.segment_type === 'skip_intro' || s.type === 'resume' || s.segment_type === 'skip_resume');
      });
      setSkipSegment((prev) => {
        if (prev?.id === active?.id) return prev;
        return active ?? null;
      });

      // Next episode: por segmento explícito o cercanía al final
      if (nextEpisode) {
        const nextEpSegment = allSegments.find(
          (seg) => seg.segment_type === 'next_episode' && seg.start_time !== null && ct >= (seg.start_time ?? 0),
        );
        const nearEnd = dur > 0 && (dur - ct) <= 30;
        const shouldShow = !!(nextEpSegment || nearEnd);

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
      }
    }, LOGIC_TICK_MS);

    return () => {
      if (logicTimerRef.current) clearInterval(logicTimerRef.current);
    };
  }, [allSegments, nextEpisode, contentId, navigate]);

  // Si desaparece el next episode (cambio de contenido), limpiar estado
  useEffect(() => {
    if (!nextEpisode) {
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
      nextShowingRef.current = false;
      setShowNextCard(false);
    }
  }, [nextEpisode]);

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

  // Auto-hide controls when video starts playing
  useEffect(() => {
    if (playerState.isPlaying && showControls) {
      showControlsTemporarily();
    }
  }, [playerState.isPlaying, showControls, showControlsTemporarily]);

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
      if (String(epId) === String(episodeId)) return;
      navigate(`/watch/${contentId}/${epId}`, { replace: true });
    },
    [episodeId, contentId, navigate],
  );

  const { handleKeyDown } = useKeyHandler({
    onBack: () => {
      if (!watchData || !streamUrl) {
        navigate(-1);
        return;
      }
      if (showControls) {
        setShowControls(false);
      } else {
        navigate(-1);
      }
    },
    onPlayPause: togglePlay,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isBackKey = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'XF86Back' || e.key === 'GoBack' || e.key === 'BrowserBack';
      handleKeyDown(e);
      if (!(isBackKey && showControls)) {
        showControlsTemporarily();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKeyDown, showControlsTemporarily, showControls]);

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
        <M3eLoadingIndicator style={{ "--m3e-loading-indicator-active-indicator-color": "#ddd" } as any} />
        <p className="text-white/50 text-base tracking-wide">Preparando la reproduccion…</p>
      </div>
    );
  }

  const chapterMarks = duration > 0
    ? allSegments
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
        className="fixed inset-0 w-screen h-screen bg-black overflow-hidden select-none"
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full block"
          style={{ objectFit: 'contain', objectPosition: 'center' }}
          playsInline
        />

        {/* Viñeta persistente */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-60" />

        {playerState.isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <LucideLoader2 size={56} className="animate-spin" style={{ color: ACCENT }} />
          </div>
        )}

        {/* Los controles de transporte se ocultan mientras el carrusel de episodios está abierto,
            igual que YouTube TV deja el video en pausa/de fondo detrás de la lista */}
        <div
          className={classNames(
            'absolute inset-0 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          {/* Scrim superior + navegación */}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/40 to-transparent pt-[clamp(1.25rem,3.4vh,2rem)] pb-[clamp(2.5rem,7vh,4rem)] px-[clamp(2rem,4vw,3rem)] pointer-events-auto">


            <div className="mt-[clamp(1rem,3vh,1.75rem)] max-w-3xl">
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

          {/* Transporte central: se desvanece suavemente cuando el foco está en la fila de episodios */}
          <div
            className={classNames(
              'absolute inset-0 flex items-center justify-center pointer-events-auto transition-opacity transition-transform duration-300',
              railExpanded ? 'opacity-0 -translate-y-3 pointer-events-none' : 'opacity-100 translate-y-0',
            )}
          >
            <div className="flex items-center gap-[clamp(1.25rem,3vw,2rem)]">
              <Focusable
                onEnterPress={() => { seek(-10); showControlsTemporarily(); }}
                focusKey="watch-rewind"
                focusedClassName="bg-white/15 ring-4 scale-110"
                className="w-[clamp(3rem,6vw,4rem)] h-[clamp(3rem,6vw,4rem)] rounded-full flex items-center justify-center text-white/85 transition-transform duration-150"
              >
                <LucideRotateCcw size="45%" strokeWidth={1.9} />
              </Focusable>

              <Focusable
                onEnterPress={togglePlay}
                focusKey="watch-playpause"
                focusedClassName="scale-110 ring-4"
                className="w-[clamp(4.25rem,8vw,6rem)] h-[clamp(4.25rem,8vw,6rem)] rounded-full flex items-center justify-center text-black transition-transform duration-150 bg-white"
              >
                {playerState.isPlaying ? (
                  <LucidePause size="38%" fill="currentColor" strokeWidth={0} />
                ) : (
                  <LucidePlay size="38%" fill="currentColor" strokeWidth={0} className="ml-1" />
                )}
              </Focusable>

              <Focusable
                onEnterPress={() => { seek(10); showControlsTemporarily(); }}
                focusKey="watch-forward"
                focusedClassName="bg-white/15 ring-4 scale-110"
                className="w-[clamp(3rem,6vw,4rem)] h-[clamp(3rem,6vw,4rem)] rounded-full flex items-center justify-center text-white/85 transition-transform duration-150"
              >
                <LucideRotateCw size="45%" strokeWidth={1.9} />
              </Focusable>
            </div>
          </div>

          {/* Scrim inferior: seekbar y (título + descripción del episodio resaltado) se
              apilan en el mismo lugar (position: relative/absolute) y hacen cross-fade con
              opacity + translate. Nada se recorta ni se desmonta: ambas vistas existen
              siempre en el DOM, solo cambia cuál es visible/interactiva. */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-[clamp(2.5rem,7vh,5rem)] pb-[clamp(1.25rem,3.5vh,2.25rem)] px-[clamp(2rem,4vw,3rem)] pointer-events-auto">
            <div className="relative h-[clamp(44px,6vh,52px)]">
              {/* Vista seekbar: se actualiza por DOM/rAF, fuera de React state */}
              <Focusable
                onArrowPress={handleProgressArrow}
                focusKey="watch-progress"
                focusedClassName="scale-101"
                className={classNames(
                  'absolute inset-0 transition-opacity transition-transform duration-300',
                  railExpanded ? 'opacity-0 translate-y-3 pointer-events-none' : 'opacity-100 translate-y-0',
                )}
              >
                <Seekbar videoRef={videoRef} duration={duration} chapterMarks={chapterMarks} />
              </Focusable>

              {/* Vista expandida: título + descripción del episodio resaltado en la fila */}
              <div
                className={classNames(
                  'absolute inset-0 flex flex-col justify-center transition-opacity transition-transform duration-300',
                  railExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none',
                )}
              >
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">
                  {focusedRailEpisode
                    ? `Ep ${allEpisodes.findIndex((e) => e.id === focusedRailEpisode.id) + 1}`
                    : 'Episodios'}
                </p>
                <h3 className="text-white text-base font-bold leading-snug truncate">
                  {focusedRailEpisode?.title}
                </h3>
                {focusedRailEpisode?.description && (
                  <p className="text-white/55 text-sm leading-snug truncate">
                    {focusedRailEpisode.description}
                  </p>
                )}
              </div>
            </div>

            {/* Fila de episodios: siempre visible junto con los controles (estilo YouTube TV),
                se agranda levemente cuando el foco entra en ella */}
            {isTVShow && episodesWithThumb.length > 0 && (
              <EpisodesRow
                episodes={episodesWithThumb}
                currentIndex={currentEpisodeIndex}
                expanded={railExpanded}
                onSelect={navigateToEpisode}
                onExpandChange={setRailExpanded}
                onFocusedEpisodeChange={setFocusedRailEpisode}
              />
            )}
          </div>
        </div>

        {/* --- SKIP INTRO/RESUME (siempre visible cuando hay segmento activo) --- */}
        {skipSegment && (
          <div className="absolute bottom-[clamp(7rem,16vh,11rem)] right-[clamp(2rem,4vw,3rem)] z-25 pointer-events-auto">
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
          <div className="absolute bottom-[clamp(7rem,16vh,11rem)] right-[clamp(2rem,4vw,3rem)] z-25 pointer-events-auto">
            {/* bg-black/90 sólido en vez de backdrop-blur-sm: el backdrop-filter
                es una de las operaciones más caras para las GPUs integradas de
                Android TV / STBs y en varios WebViews de fabricante ni siquiera
                está bien acelerado (cae a software y genera jank). */}
            <div className="bg-black/90 border border-white/10 rounded-2xl flex items-center gap-3 p-2.5 min-w-[280px]">
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

      </div>
    </FocusContext.Provider>
  );
}

/* ─── Seekbar ───────────────────────────────────────────────────────────
   Se actualiza directo por DOM en cada frame (requestAnimationFrame),
   leyendo video.currentTime / video.buffered sin pasar por React state.
   Esto es lo que más impacto tiene en WebView de Android TV: evita que el
   componente padre (y con él, todo el rail de episodios) se re-renderice
   varias veces por segundo solo para mover una barra de progreso. */

function Seekbar({
  videoRef,
  duration,
  chapterMarks,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
  chapterMarks: number[];
}) {
  const fillRef = useRef<HTMLDivElement>(null);
  const bufferedRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const currentTimeLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number;

    const update = () => {
      const dur = video.duration || 0;
      const ct = video.currentTime;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;

      let bufferedEnd = 0;
      if (video.buffered.length > 0) {
        bufferedEnd = video.buffered.end(video.buffered.length - 1);
      }
      const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;

      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (bufferedRef.current) bufferedRef.current.style.width = `${bufferedPct}%`;
      if (thumbRef.current) thumbRef.current.style.left = `calc(${pct}% - 8px)`;
      if (currentTimeLabelRef.current) currentTimeLabelRef.current.textContent = formatTime(ct);

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [videoRef]);

  return (
    <div className="flex items-center gap-5 h-full">
      <span ref={currentTimeLabelRef} className="text-white text-sm font-mono w-14 text-right tabular-nums">
        0:00
      </span>

      <div className="relative flex-1 h-2 rounded-full">
        <div className="absolute inset-0 bg-white/20 rounded-full" />
        <div ref={bufferedRef} className="absolute inset-y-0 left-0 bg-white/35 rounded-full" style={{ width: '0%' }} />
        <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-full" style={{ width: '0%', backgroundColor: ACCENT }} />

        {chapterMarks.map((pct, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-black/50 rounded-full"
            style={{ left: `${pct}%` }}
          />
        ))}

        <div
          ref={thumbRef}
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white"
          style={{ left: '-8px', boxShadow: `0 0 0 5px ${ACCENT}55` }}
        />
      </div>

      <span className="text-white/50 text-sm font-mono w-14 tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
}

/* ─── Episodes Row (carrusel horizontal siempre visible, estilo YouTube TV) ───
   Vive dentro del scrim inferior junto al resto de los controles: aparece y
   desaparece con ellos (showControls), no requiere un botón para abrirla.
   Memoizado: no debe re-renderizar cuando cambia playerState/currentTime. */

type EpisodeWithThumb = { ep: FlatEpisode; thumbUrl: string | null | undefined };

const EpisodesRow = memo(function EpisodesRow({
  episodes,
  currentIndex,
  expanded,
  onSelect,
  onExpandChange,
  onFocusedEpisodeChange,
}: {
  episodes: EpisodeWithThumb[];
  currentIndex: number;
  expanded: boolean;
  onSelect: (epId: string | number) => void;
  onExpandChange: (expanded: boolean) => void;
  onFocusedEpisodeChange: (ep: FlatEpisode | null) => void;
}) {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const railViewportRef = useRef<HTMLDivElement>(null);

  const { ref: rowRef, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'episodes-rail',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: currentIndex >= 0 ? `rail-ep-item-${episodes[currentIndex]?.ep.id}` : undefined,
  });

  // Reportar hacia arriba si el foco está dentro de la fila: esto es lo que
  // dispara el cross-fade seekbar <-> título/descripción en el padre.
  useEffect(() => {
    onExpandChange(hasFocusedChild);
    if (!hasFocusedChild) onFocusedEpisodeChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocusedChild]);

  const centerItem = useCallback((ep: FlatEpisode) => {
    const viewport = railViewportRef.current;
    const el = itemRefs.current.get(String(ep.id));
    if (viewport && el) {
      viewport.scrollTo({
        left: el.offsetLeft - (viewport.clientWidth - el.offsetWidth) / 2,
        behavior: 'smooth',
      });
    }
    onFocusedEpisodeChange(ep);
  }, [onFocusedEpisodeChange]);

  // registerNode estable por id: evita romper la memoización de RailEpisodeItem.
  const registerNode = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) itemRefs.current.set(id, node);
    else itemRefs.current.delete(id);
  }, []);

  // Centrar el episodio actual al montar (sin animación, ya arranca centrado)
  useEffect(() => {
    if (currentIndex < 0) return;
    const ep = episodes[currentIndex]?.ep;
    if (!ep) return;
    const viewport = railViewportRef.current;
    const el = itemRefs.current.get(String(ep.id));
    if (viewport && el) {
      viewport.scrollTo({
        left: el.offsetLeft - (viewport.clientWidth - el.offsetWidth) / 2,
        behavior: 'auto',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seasonCount = useMemo(() => new Set(episodes.map((e) => e.ep.seasonNumber)).size, [episodes]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={rowRef as React.RefObject<HTMLDivElement>}
        className={classNames('transition-transform duration-300', expanded ? 'mt-[clamp(0.5rem,1.8vh,1rem)]' : 'mt-[clamp(1rem,3.5vh,2rem)]')}
      >
        <div
          ref={railViewportRef}
          className="flex gap-[clamp(0.75rem,1.8vw,1rem)] overflow-x-auto p-[clamp(0.5rem,1.4vw,0.75rem)] snap-x snap-mandatory hide-scrollbar scroll-smooth"
          style={{ scrollPaddingInline: 'clamp(2rem, 4vw, 3rem)' }}
        >
          {episodes.map(({ ep, thumbUrl }, index) => (
            <RailEpisodeItem
              key={ep.id}
              episode={ep}
              index={index}
              isActive={index === currentIndex}
              expanded={expanded}
              showSeasonEyebrow={seasonCount > 1}
              thumbUrl={thumbUrl}
              onSelect={onSelect}
              onCenter={centerItem}
              registerNode={registerNode}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  );
});

/* ─── Tarjeta individual del carrusel de episodios ───
   Usa useFocusable directamente (en vez del wrapper Focusable) porque
   necesitamos el callback onFocus real de norigin-spatial-navigation
   para centrar el scroll cuando el foco llega vía mando (flechas),
   no solo al hacer click/enter.
   Memoizado: con onSelect/onCenter/registerNode estables, esta card no
   vuelve a renderizar salvo que cambien sus propias props. */

const RailEpisodeItem = memo(function RailEpisodeItem({
  episode: ep,
  index,
  isActive,
  expanded,
  showSeasonEyebrow,
  thumbUrl,
  onSelect,
  onCenter,
  registerNode,
}: {
  episode: FlatEpisode;
  index: number;
  isActive: boolean;
  expanded: boolean;
  showSeasonEyebrow: boolean;
  thumbUrl: string | null | undefined;
  onSelect: (epId: string | number) => void;
  onCenter: (ep: FlatEpisode) => void;
  registerNode: (id: string, node: HTMLDivElement | null) => void;
}) {
  const handleSelect = useCallback(() => onSelect(ep.id), [onSelect, ep.id]);
  const handleCenter = useCallback(() => onCenter(ep), [onCenter, ep]);
  const handleRegisterNode = useCallback(
    (node: HTMLDivElement | null) => registerNode(String(ep.id), node),
    [registerNode, ep.id],
  );

  const { ref, focused } = useFocusable({
    focusKey: `rail-ep-item-${ep.id}`,
    onEnterPress: handleSelect,
    onFocus: handleCenter,
  });

  const cardWidth = expanded ? 'clamp(180px, 13.5vw, 260px)' : 'clamp(156px, 11.5vw, 220px)';
  const cardHeight = expanded ? 'clamp(101px, 7.6vw, 146px)' : 'clamp(88px, 6.5vw, 124px)';

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      onClick={handleSelect}
      className={classNames(
        'snap-center flex-shrink-0 transition-transform duration-300 cursor-pointer',
        focused && 'scale-105',
      )}
      style={{ width: cardWidth }}
    >
      <div
        ref={handleRegisterNode}
        className={classNames(
          'relative bg-neutral-800 transition-transform duration-300 rounded-2xl',
          focused && 'ring-4',
        )}
        style={{
          width: cardWidth,
          height: cardHeight,
          boxShadow: focused ? `0 0 0 4px ${ACCENT}` : undefined,
        }}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover rounded-2xl" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center rounded-2xl">
            <LucidePlay size={26} className="text-neutral-600" />
          </div>
        )}

        {isActive && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center rounded-2xl">
            <div className="flex items-end gap-[3px] h-5">
              <div className="w-[3px] h-2.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
              <div className="w-[3px] h-5 rounded-full animate-pulse [animation-delay:0.15s]" style={{ backgroundColor: ACCENT }} />
              <div className="w-[3px] h-3.5 rounded-full animate-pulse [animation-delay:0.3s]" style={{ backgroundColor: ACCENT }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
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
          'text-[14px] font-semibold leading-snug truncate',
          isActive ? 'text-white' : 'text-white/80',
        )}>
          {ep.title}
        </p>
      </div>
    </div>
  );
});