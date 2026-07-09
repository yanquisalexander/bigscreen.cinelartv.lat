import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { consumeWatchData, updateProgress } from '@/features/content/api';
import { useKeyHandler } from '@/hooks/useKeyHandler';
import { classNames, resolveImageUrl } from '@/utils/helpers';
import { addContinueWatching, prefersNative as prefersNativePlayer, launchNativePlayer, setOnNativePlayerFinished } from '@/services/NativeBridge';
import { usePlayerEngine } from '@/services/player/usePlayerEngine';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AndroidTvHomeItem } from '@/services/NativeBridge';
import {
  LucidePlay,
  LucidePause,
  LucideChevronsRight,
  LucideLoader2,
  LucideX,
} from 'lucide-react';
import type { WatchData, Segment } from '@/types/content';
import { M3eLoadingIndicator } from "@m3e/react/loading-indicator";
import { useToastStore } from "@/stores/toastStore";
import { Seekbar } from '@/components/tv/Seekbar';
import { EpisodesRow } from '@/components/tv/EpisodesRow';
import type { FlatEpisode } from '@/components/tv/RailEpisodeItem';

const ACCENT = '#FFFFFF';

// Cada cuánto se re-evalúan segmentos / next-episode / progreso "lógico".
// No afecta el suavizado visual de la seekbar, que corre por rAF aparte.
const LOGIC_TICK_MS = 1000;

export function WatchScreen() {
  const { contentId, episodeId } = useParams<{ contentId: string; episodeId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const toast = useToastStore();

  const { attachVideo, videoRef, load, play, pause, seek, setOnEnded, isPlaying, isBuffering, duration } = usePlayerEngine();
  const [watchData, setWatchData] = useState<WatchData | null>(null);
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

  // --- Native player delegation ---
  // "Prefers modern playback" override: when enabled, always use the web player
  // and ignore the native player preference reported by the device.
  const prefersModernPlayback = useSettingsStore((s) => s.prefersModernPlayback);
  const useNative = useMemo(
    () => !prefersModernPlayback && prefersNativePlayer(),
    [prefersModernPlayback],
  );

  useEffect(() => {
    if (!useNative || !contentId || !tokens) return;
    launchNativePlayer({
      contentId,
      episodeId,
      accessToken: tokens.accessToken,
      clientEndpoint,
    });
    setOnNativePlayerFinished(() => {
      navigate('/home', { replace: true });
    });
    return () => setOnNativePlayerFinished(null);
  }, [useNative, contentId, episodeId, tokens, clientEndpoint, navigate]);

  // When prefersNative, show only a loading spinner while native player is active
  if (useNative) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-5">
        <M3eLoadingIndicator style={{ "--m3e-loading-indicator-active-indicator-color": "#ddd" } as any} />
        <p className="text-white/50 text-base tracking-wide">Abriendo reproductor nativo…</p>
      </div>
    );
  }

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

  // --- Sincronizar handler de "ended" con el Engine ---
  useEffect(() => {
    setOnEnded(() => {
      if (nextEpisode) {
        navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
      } else {
        navigate(-1);
      }
    });
  }, [setOnEnded, nextEpisode, contentId, navigate]);

  // --- Load watch data ---
  useEffect(() => {
    if (!tokens || !contentId) return;
    setWatchData(null);
    setSkipSegment(null);
    consumeWatchData(tokens.accessToken, contentId, episodeId)
      .then((data) => {
        const isTVShow = data.content.content_type === 'TVSHOW';
        if (isTVShow && !episodeId && !data.episode) {
          const firstEpisode = data.seasons?.[0]?.episodes?.[0];
          if (firstEpisode) {
            navigate(`/watch/${contentId}/${firstEpisode.id}`, { replace: true });
            return;
          }
        }
        if (!episodeId && data.episode) {
          navigate(`/watch/${contentId}/${data.episode.id}`, { replace: true });
          return;
        }
        if (!data.sources?.length) {
          useToastStore.getState().show('Este contenido no tiene episodios disponibles.', 'error', 4000);
          navigate('/home', { replace: true });
          return;
        }
        setWatchData(data);
      })
      .catch(() => {
        useToastStore.getState().show('No se pudo cargar el contenido. Intenta de nuevo más tarde.', 'error', 4000);
        navigate('/home', { replace: true })
      });
  }, [tokens, contentId, episodeId, navigate]);

  // --- Cargar el stream en el Engine cuando el <video> ya está montado ---
  // Debe correr en un efecto (no dentro del .then de la carga de datos)
  // porque el elemento <video> solo se monta tras el setWatchData, y el
  // engine se crea vía callback ref en ese commit.
  useEffect(() => {
    if (!streamUrl) return;
    let cancelled = false;
    const resume = watchData?.continue_watching?.progress ?? 0;
    load(streamUrl, resume).then(() => {
      if (cancelled) return;
      play();
    });
    return () => { cancelled = true; };
  }, [streamUrl, load, play, watchData]);

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
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const handleSkip = useCallback(() => {
    if (!skipSegment) return;
    const end = skipSegment.end ?? skipSegment.end_time ?? 0;
    seek(end);
    setSkipSegment(null);
  }, [skipSegment, seek]);

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
    if (isPlaying && showControls) {
      showControlsTemporarily();
    }
  }, [isPlaying, showControls, showControlsTemporarily]);

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

  // FIX: antes se chequeaba document.activeElement?.closest('[data-episode-rail]')
  // para decidir si las flechas eran seek o navegación del rail. Pero
  // norigin-spatial-navigation maneja el foco de forma virtual y no mueve el
  // foco real del DOM, así que ese chequeo nunca era verdadero y las flechas
  // siempre terminaban haciendo seek, incluso con foco dentro del rail.
  // Ahora usamos railExpanded (ya calculado a partir de hasFocusedChild del
  // rail) como fuente de verdad.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isSeekKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (!isSeekKey) return;

      const focusKey = getCurrentFocusKey();
      if (focusKey === 'episodes-rail' || focusKey.startsWith('rail-ep-item-')) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      const video = videoRef.current;
      if (video) {
        const delta = e.key === 'ArrowLeft' ? -10 : 10;
        video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration || 0));
        showControlsTemporarily();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [showControlsTemporarily]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isBackKey = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'XF86Back' || e.key === 'GoBack' || e.key === 'BrowserBack';
      const isActionKey = e.key === ' ' || e.key === 'Enter';
      const isNavArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown';
      handleKeyDown(e);
      if (isActionKey || isNavArrow || (!isBackKey && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) {
        showControlsTemporarily();
      }
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

  const ready = !!(watchData && streamUrl);

  const chapterMarks = duration > 0
    ? allSegments
      .map((s) => (((s.start ?? s.start_time ?? 0) / duration) * 100))
      .filter((p) => p > 0.5 && p < 99.5)
    : [];

  const skipLabel = (skipSegment?.type === 'intro' || skipSegment?.segment_type === 'skip_intro')
    ? 'intro'
    : 'resumen';

  const isTVShow = watchData?.content.content_type === 'TVSHOW';

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="fixed inset-0 w-screen h-screen bg-black overflow-hidden select-none"
      >
        {/* El <video> se monta SIEMPRE y se reutiliza entre episodios.
            Desmontarlo (early-return) destruía el elemento al que el engine
            estaba adjunto, dejando solo audio al cambiar de episodio. */}
        <video
          ref={attachVideo}
          className="absolute inset-0 w-full h-full block"
          style={{ objectFit: 'contain', objectPosition: 'center' }}
          autoPlay
          playsInline
        />

        {/* Viñeta persistente */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-60" />

        {/* Pantalla de preparación mientras se cargan los datos del episodio */}
        {!ready && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-5 z-30">
            <M3eLoadingIndicator style={{ "--m3e-loading-indicator-active-indicator-color": "#ddd" } as any} />
            <p className="text-white/50 text-base tracking-wide">Preparando la reproduccion…</p>
          </div>
        )}

        {ready && isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <LucideLoader2 size={56} className="animate-spin" style={{ color: ACCENT }} />
          </div>
        )}

        {/* Los controles de transporte se ocultan mientras el carrusel de episodios está abierto,
            igual que YouTube TV deja el video en pausa/de fondo detrás de la lista */}
        <div
          className={classNames(
            'absolute inset-0 transition-opacity duration-300',
            ready && showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          {/* Scrim superior + navegación */}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/30 to-transparent pt-[clamp(1.25rem,3.4vh,2rem)] pb-[clamp(2.5rem,7vh,4rem)] px-[clamp(2rem,4vw,3rem)] pointer-events-auto">


            <div className="mt-[clamp(1rem,3vh,1.75rem)] max-w-3xl">
              <h1 className="text-white font-bold leading-tight" style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)' }}>
                {watchData?.content.title}
              </h1>
              {watchData?.episode && (
                <p className="text-white/45 text-[15px] font-medium mt-1">
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
            <Focusable
              onEnterPress={togglePlay}
              focusKey="watch-playpause"
              focusedClassName="scale-110 ring-4"
              className="w-[clamp(4.25rem,8vw,6rem)] h-[clamp(4.25rem,8vw,6rem)] rounded-2xl flex items-center justify-center text-black transition-all duration-200 ease-out bg-white/[0.92] backdrop-blur-sm border border-white/20 shadow-lg shadow-black/30 hover:bg-white"
            >
              {isPlaying ? (
                <LucidePause size="38%" fill="currentColor" strokeWidth={0} />
              ) : (
                <LucidePlay size="38%" fill="currentColor" strokeWidth={0} className="ml-1" />
              )}
            </Focusable>
          </div>

          {/* Scrim inferior: seekbar y (título + descripción del episodio resaltado) se
              apilan en el mismo lugar (position: relative/absolute) y hacen cross-fade con
              opacity + translate. Nada se recorta ni se desmonta: ambas vistas existen
              siempre en el DOM, solo cambia cuál es visible/interactiva. */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-[clamp(2.5rem,7vh,5rem)] pb-[clamp(1.25rem,3.5vh,2.25rem)] px-[clamp(2rem,4vw,3rem)] pointer-events-auto">
            <div className={classNames(
              'relative transition-all duration-300',
              railExpanded ? 'h-[clamp(80px,12vh,110px)]' : 'h-[clamp(44px,6vh,52px)]',
            )}>
              {/* Vista seekbar: se actualiza por DOM/rAF, fuera de React state */}
              <Focusable
                onEnterPress={togglePlay}
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
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/40 mb-1">
                  {focusedRailEpisode
                    ? `Ep ${allEpisodes.findIndex((e) => e.id === focusedRailEpisode.id) + 1}`
                    : 'Episodios'}
                </p>
                <h3 className="text-white text-[15px] font-medium leading-snug line-clamp-1">
                  {focusedRailEpisode?.title}
                </h3>
                {focusedRailEpisode?.description && (
                  <p className="text-white/45 text-[13px] leading-snug line-clamp-2 mt-0.5">
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
          <div className="absolute bottom-[clamp(7rem,16vh,11rem)] right-[clamp(2rem,4vw,3rem)] z-25 pointer-events-auto transition-all duration-350 ease-out opacity-100 translate-y-0">
            <Focusable
              onEnterPress={handleSkip}
              focusKey="watch-skip"
              focusedClassName="scale-105 ring-4"
              className="flex items-center gap-2.5 px-5 py-3 bg-white/[0.92] backdrop-blur-md border border-white/20 rounded-2xl shadow-lg shadow-black/30 text-black text-sm font-semibold transition-all duration-200 ease-out hover:scale-[1.04] active:scale-[0.96]"
            >
              <span className="tracking-wide">Omitir {skipLabel}</span>
              <LucideChevronsRight size={16} strokeWidth={2.5} />
            </Focusable>
          </div>
        )}

        {/* --- NEXT EPISODE CARD --- */}
        {showNextCard && nextEpisode && (
          <div className="absolute bottom-[clamp(7rem,16vh,11rem)] right-[clamp(2rem,4vw,3rem)] z-25 pointer-events-auto transition-all duration-400 ease-out opacity-100 translate-y-0">
            <div className="flex items-center gap-3.5 bg-white/[0.05] backdrop-blur-2xl rounded-2xl shadow-xl shadow-black/40 border border-white/[0.08] px-4 py-3 min-w-[300px]">
              {nextEpisode.thumbnail ? (
                <img
                  src={resolveImageUrl(nextEpisode.thumbnail, clientEndpoint) ?? undefined}
                  alt={nextEpisode.title}
                  className="w-[4.5rem] h-[2.75rem] rounded-xl object-cover flex-shrink-0 bg-neutral-800"
                />
              ) : (
                <div className="w-[4.5rem] h-[2.75rem] rounded-xl bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <LucidePlay size={14} className="text-white/30" />
                </div>
              )}

              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/40">
                  Siguiente episodio
                </span>
                <span className="text-white text-sm font-medium truncate max-w-[180px]">
                  {nextEpisode.title}
                </span>
              </div>

              <div className="flex items-center gap-2 ml-1">
                <span className="text-white/70 text-xs font-semibold tabular-nums bg-white/[0.08] px-2 py-1 rounded-lg">
                  {nextCountdown}s
                </span>

                <Focusable
                  onEnterPress={playNextEpisode}
                  focusKey="watch-next-play"
                  focusedClassName="scale-110 ring-4"
                  className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center transition-all duration-200 ease-out hover:scale-105"
                >
                  <LucidePlay size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
                </Focusable>

                <Focusable
                  onEnterPress={cancelNextEpisode}
                  focusKey="watch-next-cancel"
                  focusedClassName="scale-110 ring-4"
                  className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/70 transition-all duration-200 ease-out"
                >
                  <LucideX size={14} />
                </Focusable>
              </div>
            </div>
          </div>
        )}

      </div>
    </FocusContext.Provider>
  );
}