// WatchScreen.tsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { consumeWatchData, updateProgress, pingStream, sendStreamEnd, getStoredSessionToken, saveSessionToken, clearSessionToken } from '@/features/content/api';
import { usePlayerEngine } from '@/services/player/usePlayerEngine';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettingsStore } from '@/stores/siteSettingsStore';
import { useToastStore } from '@/stores/toastStore';
import { resolveImageUrl, resolveBackdrop, resolvePoster } from '@/utils/helpers';
import { addContinueWatching, prefersNative as prefersNativePlayer, launchNativePlayer, setOnNativePlayerFinished } from '@/services/NativeBridge';
import { fetchVast } from '@/services/player/vast-client';
import { pdbg } from '@/services/player/playerDebug';
import { M3eLoadingIndicator } from '@m3e/react/loading-indicator';
import { MonitorPlay, AlertTriangle } from 'lucide-react';
import { inputManager } from '@/services/InputManager';
import type { WatchData } from '@/types/content';
import { isTVShow } from '@/types/content';
import type { FlatEpisode } from '@/components/tv/RailEpisodeItem';
import type { VastAd } from '@/types/vast';

import '@/components/tv/PlayerControlsElement';
import '@/components/tv/FocusableElement';

import '@/components/tv/FocusableCardElement';
import '@/components/tv/AdOverlayElement';
import { PlayerSettingsPanel } from '@/components/player/PlayerSettingsPanel';
import { TVFocusable } from '@/components/tv/TVFocusable';

const AD_PREROLL_TAG = 'https://pubads.g.doubleclick.net/gampad/live/ads?iu=/22530741549/CTV_VAST_ADS&description_url=[DESCRIPTION_URL]&tfcd=0&npa=0&sz=400x300%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&impl=s&correlator=[CACHEBUSTER]';
const AD_POSTROLL_TAG = 'https://youradexchange.com/video/select.php?r=11621170';
const TEST_STREAM_URL = 'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths-hls/hls.m3u8';

export function WatchScreen({ test = false }: { test?: boolean }) {
  const { contentId, episodeId } = useParams<{ contentId: string; episodeId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const isAdmin = useAuthStore((s) => s.session?.current_user?.admin) ?? false;
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);

  const { attachVideo, videoRef, load, play, setOnEnded, getEngine, engineReady, applyPreferredAudioLanguage, isPlaying, isBuffering } = usePlayerEngine();
  const [watchData, setWatchData] = useState<WatchData | null>(null);
  const [currentAd, setCurrentAd] = useState<VastAd | null>(null);
  const [adPhase, setAdPhase] = useState<'none' | 'preroll' | 'midroll' | 'postroll'>('none');
  const [prerollChecked, setPrerollChecked] = useState(test);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugVisible, setDebugVisible] = useState(() => typeof window !== 'undefined' && window.location.search.includes('debug=1'));

  const controlsRef = useRef<any>(null);
  const adOverlayRef = useRef<any>(null);
  const adPhaseRef = useRef<'none' | 'preroll' | 'midroll' | 'postroll'>('none');
  const pendingNavigationRef = useRef<{ contentId: string; episodeId?: string } | null>(null);
  const loadedUrlRef = useRef<string | null>(null);

  const [streamLimitError, setStreamLimitError] = useState<string | null>(null);
  const [streamLimitSessions, setStreamLimitSessions] = useState<any[]>([]);
  const [playerError, setPlayerError] = useState<{ code?: number | string; message?: string } | null>(null);
  const streamPingTokenRef = useRef<string | null>(null);
  const clientRequestIdRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const siteSettings = useSiteSettingsStore((s) => s.settings);

  const streamUrl = watchData?.sources?.[0]?.url;
  const ready = !!(watchData && streamUrl);

  // --- Stream session helpers ---
  const stopStreamPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const startStreamPing = useCallback((sessionId: string) => {
    if (!sessionId) return;
    stopStreamPing();
    const intervalMs = (siteSettings.stream_ping_interval_seconds || 10) * 1000;
    pingIntervalRef.current = setInterval(() => {
      if (tokens?.accessToken) {
        pingStream(tokens.accessToken, sessionId).catch(() => { });
      }
    }, intervalMs);
    streamPingTokenRef.current = sessionId;
  }, [tokens?.accessToken, siteSettings.stream_ping_interval_seconds, stopStreamPing]);

  const releaseStreamSlot = useCallback(() => {
    const sessionId = streamPingTokenRef.current || getStoredSessionToken();
    if (!sessionId || !tokens?.accessToken) return;
    sendStreamEnd(tokens.accessToken, sessionId).catch(() => { });
  }, [tokens?.accessToken]);

  // Regenerate clientRequestId on content/episode navigation
  useEffect(() => {
    clientRequestIdRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }, [contentId, episodeId]);

  const prefersModernPlayback = useSettingsStore((s) => s.prefersModernPlayback);
  const useNative = useMemo(
    () => !prefersModernPlayback && prefersNativePlayer(),
    [prefersModernPlayback],
  );

  const userLang = useMemo(() => {
    const prefs = (useAuthStore.getState().selectedProfile?.preferences as Array<{ audio_language?: string; language?: string }> | undefined) ?? [];
    const langPref = prefs.find((p) => p?.audio_language || p?.language);
    const val = langPref?.audio_language ?? langPref?.language;
    return val || (typeof navigator !== 'undefined' ? navigator.language : 'es');
  }, []);

  const allEpisodes = useMemo(() => {
    if (!watchData?.seasons) return [];
    const result: FlatEpisode[] = [];
    for (const season of watchData.seasons) {
      const seasonNum = (season.position ?? 0) + 1;
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

  const currentSeasonNumber = useMemo(() => {
    if (!watchData?.episode?.season_id || !watchData?.seasons) return null;
    const idx = watchData.seasons.findIndex((s) => s.id === watchData.episode!.season_id);
    return idx >= 0 ? ((watchData.seasons[idx].position ?? idx) + 1) : null;
  }, [watchData]);

  const nextEpisode = useMemo(() => {
    if (currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1) {
      return allEpisodes[currentEpisodeIndex + 1];
    }
    return null;
  }, [currentEpisodeIndex, allEpisodes]);

  const allSegments = useMemo(() => {
    const epSegs = watchData?.episode?.segments ?? [];
    const contentSegs = watchData?.content?.segments ?? [];
    return [...epSegs, ...contentSegs];
  }, [watchData]);

  const { ref, focusKey } = useFocusable({
    focusKey: 'watch-root',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'watch-playpause',
  });

  const { ref: limitRef, focusKey: limitFocusKey } = useFocusable({
    focusKey: 'stream-limit-root',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'stream-limit-home',
  });

  const { ref: playerErrorRef, focusKey: playerErrorFocusKey } = useFocusable({
    focusKey: 'player-error-root',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'player-error-retry',
  });
  const focusPlaybackControl = useCallback(() => {
    requestAnimationFrame(() => {
      if (doesFocusableExist('watch-playpause')) {
        setFocus('watch-playpause');
      } else if (doesFocusableExist('watch-root')) {
        setFocus('watch-root');
      }
    });
  }, []);


  // --- Native player delegation ---
  useEffect(() => {
    if (!useNative || !contentId || !tokens) return;
    launchNativePlayer({ contentId, episodeId, accessToken: tokens.accessToken, clientEndpoint });
    setOnNativePlayerFinished(() => navigate('/home', { replace: true }));
    return () => setOnNativePlayerFinished(null);
  }, [useNative, contentId, episodeId, tokens, clientEndpoint, navigate]);

  // --- Sync adPhaseRef ---
  useEffect(() => { adPhaseRef.current = adPhase; }, [adPhase]);

  // --- Heal norigin ghost focus on unmount ---
  // When the player unmounts, the focused key is removed from norigin without a
  // live parent, leaving a stale "ghost" focusKey behind. Any subsequent arrow
  // press then aborts (smartNavigate cannot find the component), killing
  // navigation on the destination screen. Redirect focus to a key that is
  // guaranteed to exist (the always-mounted sidebar).
  useEffect(() => {
    return () => {
      const key = getCurrentFocusKey();
      if (key && !doesFocusableExist(key)) {
        setFocus('sidebar');
      }
    };
  }, []);

  // --- Release stream slot on unmount or tab close ---
  useEffect(() => {
    const handlePageHide = () => {
      const sessionId = streamPingTokenRef.current || getStoredSessionToken();
      if (!sessionId || !tokens?.accessToken) return;
      const url = `${window.location.origin}/stream/end`;
      const payload = new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' });
      navigator.sendBeacon?.(url, payload);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      stopStreamPing();
      releaseStreamSlot();
    };
  }, [tokens?.accessToken, stopStreamPing, releaseStreamSlot]);

  // --- Reset ad state on content change ---
  useEffect(() => {
    if (test) return;
    setPrerollChecked(false);
    setAdPhase('none');
    setCurrentAd(null);
  }, [contentId, episodeId, test]);

  // --- Load watch data ---
  const fetchData = useCallback(() => {
    if (test) {
      setWatchData({
        sources: [{ url: TEST_STREAM_URL }],
        content: {
          title: 'Big Buck Bunny',
          content_type: 'MOVIE',
          description: 'Video de prueba',
        },
      } as unknown as WatchData);
      return;
    }
    if (!tokens || !contentId) return;
    setWatchData(null);
    setStreamLimitError(null);
    setStreamLimitSessions([]);
    stopStreamPing();

    const storedToken = getStoredSessionToken();
    const opts = {
      deviceSessionToken: storedToken ?? undefined,
      clientRequestId: clientRequestIdRef.current,
    };

    pdbg('watch.watchdata', 'fetching', { contentId, episodeId, hasToken: !!storedToken });
    consumeWatchData(tokens.accessToken, contentId, episodeId, opts)
      .then((data) => {
        pdbg('watch.watchdata', 'resolved', { hasSources: !!data.sources?.length, title: data.content?.title });
        const isTVShow = data.content.content_type === 'TVSHOW' || data.content.contentType === 'TVSHOW';
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

        // Persist / resume device session token
        if (data.deviceSessionToken) {
          saveSessionToken(data.deviceSessionToken);
          startStreamPing(data.deviceSessionToken);
        } else {
          clearSessionToken();
        }

        setWatchData(data);
      })
      .catch((err: any) => {
        pdbg('watch.watchdata', 'REJECTED', err);
        const errStr = String(err?.message ?? err ?? '');

        // Stream limit reached
        if (err?.body?.error === 'STREAM_LIMIT_REACHED' || errStr.includes('STREAM_LIMIT_REACHED')) {
          setStreamLimitError('Has alcanzado el número máximo de transmisiones simultáneas.');
          setStreamLimitSessions(err?.body?.sessions ?? []);
          clearSessionToken();
          return;
        }

        const is502 = err?.status === 502 || errStr.includes('502') || errStr.toLowerCase().includes('bad gateway');
        useToastStore.getState().show(
          is502
            ? 'El servicio no está disponible temporalmente. Intenta de nuevo.'
            : 'No se pudo cargar el contenido. Intenta de nuevo más tarde.',
          'error',
          is502 ? 6000 : 4000,
        );
        navigate('/home', { replace: true });
      });
  }, [test, tokens, contentId, episodeId, navigate, stopStreamPing, startStreamPing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Preroll ---
  useEffect(() => {
    if (test || !streamUrl || prerollChecked || adPhase !== 'none' || isAdmin) {
      if (isAdmin) setPrerollChecked(true);
      return;
    }
    pdbg('watch.preroll', 'fetching VAST');
    fetchVast(AD_PREROLL_TAG).then((ad) => {
      pdbg('watch.preroll', 'vast settled', ad ? 'ad found' : 'no ad');
      setPrerollChecked(true);
      if (ad) {
        setAdPhase('preroll');
        setCurrentAd(ad);
      }
    }).catch(() => {
      pdbg('watch.preroll', 'vast rejected');
      setPrerollChecked(true);
    });
    // Safety net: the preroll gate must NEVER block the stream. Even if the
    // VAST request stalls (ad-network unreachable on TV networks), open the
    // gate so the load effect can start playback.
    const safety = setTimeout(() => {
      pdbg('watch.preroll', 'safety timeout — opening gate');
      setPrerollChecked(true);
    }, 9000);
    return () => clearTimeout(safety);
  }, [test, streamUrl, prerollChecked, adPhase]);

  // --- Load stream ---
  useEffect(() => {
    if (!streamUrl || adPhase !== 'none' || !prerollChecked) return;
    let cancelled = false;
    const resume = watchData?.continue_watching?.progress ?? 0;
    loadedUrlRef.current = streamUrl;
    pdbg('watch.load', 'calling engine.load', { engineReady, url: streamUrl, resume });
    load(streamUrl, resume).then(() => {
      if (cancelled) return;
      pdbg('watch.load', 'engine.load resolved → play()');
      play();
      applyPreferredAudioLanguage(userLang);
    }).catch((e: any) => {
      if (cancelled) return;
      pdbg('watch.load', 'engine.load rejected');
      setPlayerError({ code: e?.code, message: e?.message ?? 'Error al cargar el contenido.' });
    });
    return () => { cancelled = true; };
  }, [streamUrl, load, play, watchData, applyPreferredAudioLanguage, userLang, adPhase, prerollChecked, engineReady]);

  // --- Progress reporting ---
  useEffect(() => {
    if (test || !tokens || !contentId || !watchData) return;

    const cover = resolvePoster(watchData.content.images, watchData.content.cover_resized ?? watchData.content.cover, clientEndpoint) ?? undefined;
    const banner = resolveBackdrop(watchData.content.images, watchData.content.banner_resized ?? watchData.content.banner, clientEndpoint, 'medium') ?? undefined;
    const cwItemBase = {
      content_id: contentId,
      episode_id: episodeId,
      title: watchData.content.title,
      description: watchData.episode?.title ?? watchData.content.description,
      content_type: watchData.content.content_type ?? watchData.content.contentType,
      cover,
      cover_resized: cover,
      banner,
      banner_resized: banner,
      image_url: resolveBackdrop(watchData.content.images, watchData.content.banner_resized ?? watchData.content.banner ?? watchData.content.cover_resized ?? watchData.content.cover, clientEndpoint, 'medium') ?? undefined,
      url: `/watch/${contentId}${episodeId ? `/${episodeId}` : ''}`,
      episode_title: watchData.season?.title && watchData.episode?.title
        ? `${watchData.season.title} - ${watchData.episode.title}`
        : watchData.episode?.title,
    };

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (video && video.duration) {
        const sessionToken = streamPingTokenRef.current || getStoredSessionToken() || undefined;
        updateProgress(tokens.accessToken, contentId, episodeId, video.currentTime, video.duration, sessionToken).catch(() => { });
        addContinueWatching({ ...cwItemBase, progress: Math.round(video.currentTime * 1000), duration: Math.round(video.duration * 1000) });
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [test, tokens, contentId, watchData, clientEndpoint, episodeId, videoRef]);

  // --- Ended handler ---
  useEffect(() => {
    setOnEnded(() => {
      if (test || isAdmin) {
        if (nextEpisode) {
          navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
        } else {
          navigate(-1);
        }
        return;
      }
      fetchVast(AD_POSTROLL_TAG).then((ad) => {
        if (ad) {
          pendingNavigationRef.current = nextEpisode
            ? { contentId: contentId!, episodeId: nextEpisode.id }
            : { contentId: contentId! };
          setCurrentAd(ad);
          setAdPhase('postroll');
        } else {
          if (nextEpisode) {
            navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
          } else {
            navigate(-1);
          }
        }
      }).catch(() => {
        if (nextEpisode) {
          navigate(`/watch/${contentId}/${nextEpisode.id}`, { replace: true });
        } else {
          navigate(-1);
        }
      });
    });
  }, [setOnEnded, nextEpisode, contentId, navigate, test, isAdmin]);

  // --- Sync controls ref with engine + data ---
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    if (engineReady) el.engineRef = getEngine();
    el.videoEl = videoRef.current;
    if (watchData) {
      el.contentTitle = watchData.content.title;
      el.contentSubtitle = watchData.episode?.title
        ? `${(watchData.content.content_type === 'TVSHOW' || watchData.content.contentType === 'TVSHOW') && currentSeasonNumber ? `T${currentSeasonNumber} · ` : ''}${watchData.episode.title}`
        : '';
    }
    if (allEpisodes.length > 0) {
      el.episodes = { episodes: allEpisodes, currentId: episodeId, contentId };
    }
    el.segments = allSegments;
    el.clientEndpoint = clientEndpoint;
    el.nextEpisode = nextEpisode;
  }, [engineReady, getEngine, watchData, allEpisodes, allSegments, currentSeasonNumber, episodeId, contentId, clientEndpoint, nextEpisode, videoRef]);

  // --- Listen to player errors (show full-screen overlay) ---
  useEffect(() => {
    const engine = getEngine();
    if (!engine) return;
    const unsub = engine.on('error', (err: any) => {
      const name = err?.name ?? '';
      if (name === 'AbortError' || name === 'NotAllowedError') return;
      pdbg('watch.player-error', 'showing overlay', err?.code, err?.message);
      setPlayerError({ code: err?.code, message: err?.message });
    });
    return unsub;
  }, [getEngine, engineReady]);

  // --- Handle controls events ---
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;

    const handleSettingsToggle = (e: CustomEvent) => {
      const open = !!e.detail.open;
      setSettingsOpen(open);
      if (!open) {
        requestAnimationFrame(() => {
          if (doesFocusableExist('watch-settings')) {
            setFocus('watch-settings');
          } else if (doesFocusableExist('watch-root')) {
            setFocus('watch-root');
          }
        });
      }
    };

    const handleNextEpisode = (e: CustomEvent) => {
      const { contentId: cid, episodeId: eid } = e.detail;
      navigate(`/watch/${cid}/${eid}`, { replace: true });
    };

    const handleSkip = () => {
      focusPlaybackControl();
    };

    const handleEpisodeSelect = (e: CustomEvent<{ episodeId: string | number }>) => {
      const selectedEpisodeId = e.detail.episodeId;
      if (String(selectedEpisodeId) !== String(episodeId)) {
        navigate(`/watch/${contentId}/${selectedEpisodeId}`, { replace: true });
      }
    };

    el.addEventListener('settings-toggle', handleSettingsToggle);
    el.addEventListener('next-episode', handleNextEpisode);
    el.addEventListener('skip', handleSkip);
    el.addEventListener('episode-select', handleEpisodeSelect as EventListener);

    return () => {
      el.removeEventListener('settings-toggle', handleSettingsToggle);
      el.removeEventListener('next-episode', handleNextEpisode);
      el.removeEventListener('skip', handleSkip);
      el.removeEventListener('episode-select', handleEpisodeSelect as EventListener);
    };
  }, [contentId, episodeId, navigate, focusPlaybackControl, engineReady]);

  // --- Handle ad completion ---
  useEffect(() => {
    const el = adOverlayRef.current;
    if (!el) return;

    const handleAdComplete = () => {
      pdbg('watch.ad-complete', 'received');
      const pending = pendingNavigationRef.current;
      if (pending) {
        pendingNavigationRef.current = null;
        navigate(
          pending.episodeId
            ? `/watch/${pending.contentId}/${pending.episodeId}`
            : `/watch/${pending.contentId}`,
          { replace: true },
        );
        return;
      }
      setCurrentAd(null);
      setAdPhase('none');
      setFocus('watch-playpause');
    };

    el.addEventListener('ad-complete', handleAdComplete);
    return () => el.removeEventListener('ad-complete', handleAdComplete);
  }, [currentAd, navigate]);

  // --- Ad watchdog: an ad stuck in any phase must never block the stream ---
  // The gate (load effect) waits for adPhase === 'none'. If the overlay fails
  // silently (element missing, media error, autoplay blocked), force-release
  // the gate after the ad duration plus a safety margin.
  useEffect(() => {
    if (adPhase === 'none' || !currentAd) return;
    const graceMs = Math.max(25_000, (currentAd.duration || 0) * 1000 + 15_000);
    pdbg('watch.ad-watchdog', 'armed', { adPhase, duration: currentAd.duration, graceMs });
    const timer = setTimeout(() => {
      pdbg('watch.ad-watchdog', 'FIRED — releasing gate', { adPhase });
      const pending = pendingNavigationRef.current;
      if (pending) {
        pendingNavigationRef.current = null;
        navigate(
          pending.episodeId
            ? `/watch/${pending.contentId}/${pending.episodeId}`
            : `/watch/${pending.contentId}`,
          { replace: true },
        );
        return;
      }
      setCurrentAd(null);
      setAdPhase('none');
    }, graceMs);
    return () => clearTimeout(timer);
  }, [adPhase, currentAd, navigate]);

  // --- Push current ad into the overlay element ---
  useEffect(() => {
    const el = adOverlayRef.current;
    if (el) {
      el.ad = currentAd;
      el.setAttribute('skip-offset', '5');
      pdbg('watch.ad-overlay', currentAd ? 'ad pushed to overlay' : 'ad cleared');
    }
  }, [currentAd]);

  // --- Back button + play/pause via InputManager ---
  useEffect(() => {
    const handleBack = () => {
      if (settingsOpen) {
        if (controlsRef.current) controlsRef.current.settingsOpen = false;
        return;
      }
      if (controlsRef.current?.railExpanded) {
        controlsRef.current.railExpanded = false;
        setFocus('watch-episodes');
        return;
      }
      if (controlsRef.current?.showControls) {
        controlsRef.current.showControls = false;
        return;
      }
      if (test) {
        navigate('/home');
      } else {
        navigate(-1);
      }
    };

    const handlePlayPause = () => {
      if (controlsRef.current?.settingsOpen) return;
      controlsRef.current?.togglePlayPause();
    };

    inputManager.on('back', handleBack);
    inputManager.on('playpause', handlePlayPause);

    return () => {
      inputManager.off('back', handleBack);
      inputManager.off('playpause', handlePlayPause);
    };
  }, [navigate, settingsOpen, test, focusPlaybackControl, engineReady]);

  // --- Auto-hide on play ---
  useEffect(() => {
    if (isPlaying && controlsRef.current) {
      controlsRef.current.showControls = true;
      setTimeout(() => {
        const controls = controlsRef.current;
        const currentFocus = getCurrentFocusKey() ?? '';
        if (
          controls &&
          !controls.video?.paused &&
          !controls.settingsOpen &&
          !controls.railExpanded &&
          !currentFocus.startsWith('player-settings')
        ) {
          controlsRef.current.showControls = false;
        }
      }, 5000);
    }
  }, [isPlaying]);

  // --- Focus play/pause when ready ---
  useEffect(() => {
    if (ready && engineReady) {
      focusPlaybackControl();
    }
  }, [ready, engineReady, focusPlaybackControl]);

  // --- Sync isBuffering to WC ---
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.isBuffering = isBuffering;
    }
  }, [isBuffering]);

  // Duration is now managed entirely by PlayerControlsElement._startSeekbarLoop()

  // When prefersNative, show only a loading spinner while native player is active
  if (useNative) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-5">
        <M3eLoadingIndicator style={{ '--m3e-loading-indicator-active-indicator-color': '#ddd' } as any} />
        <p className="text-white/50 text-base tracking-wide">Abriendo reproductor nativo…</p>
      </div>
    );
  }

  // Stream limit reached — full-screen YouTube-style page
  if (streamLimitError) {
    return (
      <FocusContext.Provider value={limitFocusKey}>
        <div
          ref={limitRef as React.RefObject<HTMLDivElement>}
          className="fixed inset-0 w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center select-none"
        >
          <div className="flex flex-col items-center text-center max-w-lg px-8">
            <MonitorPlay className="text-[#3ea6ff] mb-6" size={64} />

            <h1 className="text-white text-3xl font-semibold mb-4">
              Límite de transmisiones alcanzado
            </h1>

            <p className="text-white/70 text-base leading-relaxed mb-10">
              Ya hay demasiados dispositivos reproduciendo contenido en esta cuenta.
              Detén la transmisión en otro dispositivo para continuar viendo.
            </p>

            <div className="flex gap-4">
              <TVFocusable
                focusKey="stream-limit-home"
                parentFocusKey={limitFocusKey}
                onEnterPress={() => navigate('/home', { replace: true })}
                autoFocus
                className="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
                focusedClassName="!bg-white !text-black"
              >
                Volver al inicio
              </TVFocusable>

              <TVFocusable
                focusKey="stream-limit-retry"
                parentFocusKey={limitFocusKey}
                onEnterPress={() => {
                  setStreamLimitError(null);
                  setStreamLimitSessions([]);
                  fetchData();
                }}
                className="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
                focusedClassName="!bg-white !text-black"
              >
                Reintentar
              </TVFocusable>
            </div>
          </div>
        </div>
      </FocusContext.Provider>
    );
  }

  // Player error — full-screen error page
  if (playerError) {
    return (
      <FocusContext.Provider value={playerErrorFocusKey}>
        <div
          ref={playerErrorRef as React.RefObject<HTMLDivElement>}
          className="fixed inset-0 w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center select-none"
        >
          <div className="flex flex-col items-center text-center max-w-lg px-8">
            <AlertTriangle className="text-[#3ea6ff] mb-6" size={64} />

            <h1 className="text-white text-3xl font-semibold mb-4">
              Error de reproducción
            </h1>

            <p className="text-white/70 text-base leading-relaxed mb-4">
              Ocurrió un error al intentar reproducir el contenido. Por favor, intenta de nuevo.
            </p>

            {(playerError.code != null || playerError.message) && (
              <p className="text-white/40 text-sm font-mono mb-8">
                {playerError.code != null ? playerError.code : ''}
                {playerError.message ? `: ${playerError.message}` : ''}
              </p>
            )}

            <div className="flex gap-4">
              <TVFocusable
                focusKey="player-error-back"
                parentFocusKey={playerErrorFocusKey}
                onEnterPress={() => navigate('/home', { replace: true })}
                autoFocus
                className="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
                focusedClassName="!bg-white !text-black"
              >
                Volver
              </TVFocusable>

              <TVFocusable
                focusKey="player-error-retry"
                parentFocusKey={playerErrorFocusKey}
                onEnterPress={() => {
                  setPlayerError(null);
                  if (loadedUrlRef.current) {
                    const resume = watchData?.continue_watching?.progress ?? 0;
                    load(loadedUrlRef.current, resume).then(() => {
                      play();
                      applyPreferredAudioLanguage(userLang);
                    }).catch((e: any) => {
                      setPlayerError({ code: e?.code, message: e?.message ?? 'Error al cargar el contenido.' });
                    });
                  }
                }}
                className="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
                focusedClassName="!bg-white !text-black"
              >
                Reintentar
              </TVFocusable>
            </div>
          </div>
        </div>
      </FocusContext.Provider>
    );
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="fixed inset-0 w-screen h-screen bg-black overflow-hidden select-none"
      >
        {/* Stream limit reached overlay */}
        {streamLimitError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-8">
            <div className="text-center max-w-md">
              <h2 className="text-white text-xl font-semibold mb-3">Límite de transmisiones alcanzado</h2>
              <p className="text-white/60 text-sm mb-6">{streamLimitError}</p>
              {streamLimitSessions.length > 0 && (
                <div className="mb-6">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Sesiones activas</p>
                  <ul className="space-y-2">
                    {streamLimitSessions.map((s: any) => (
                      <li key={s.session_id} className="bg-white/5 rounded-lg px-4 py-2 text-left">
                        <div className="text-white text-sm">{s.device_name || 'Dispositivo desconocido'}</div>
                        <div className="text-white/50 text-xs">
                          {s.content_title || 'Contenido desconocido'}
                          {s.episode_title ? ` · ${s.episode_title}` : ''}
                        </div>
                        <div className="text-white/30 text-xs">{s.device_type || ''} · TTL: {s.ttl}s</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() => navigate('/home', { replace: true })}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        )}

        {!ready && !streamLimitError && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-5 z-30">
            <p className="text-white/50 text-xl tracking-wide uppercase">Cargando...</p>
          </div>
        )}

        {test && (
          <div className="absolute top-0 left-0 z-30 px-4 py-2 bg-live/80 text-white text-xs font-bold uppercase tracking-wider rounded-br-xl">
            Modo prueba
          </div>
        )}

        <video
          ref={attachVideo}
          className="absolute inset-0 w-full h-full block"
          style={{ objectFit: 'contain', objectPosition: 'center' }}
          autoPlay
          playsInline
        />

        <div className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/70 via-transparent to-black/40 opacity-60" />

        {engineReady && (
          <tv-player-controls
            ref={controlsRef}
            style={{ display: ready ? 'block' : 'none' }}
          />
        )}

        <PlayerSettingsPanel engine={getEngine()} open={settingsOpen} />

        {currentAd && (
          <tv-ad-overlay
            ref={(el: any) => {
              adOverlayRef.current = el;
            }}
          />
        )}

        {debugVisible && (
          <div className="absolute top-0 right-0 z-50 p-3 bg-black/90 text-green-400 text-xs font-mono leading-5 max-w-xs">
            <div>engineReady: {String(engineReady)}</div>
            <div>watchData: {String(!!watchData)}</div>
            <div>streamUrl: {streamUrl ? 'ok' : 'null'}</div>
            <div>prerollChecked: {String(prerollChecked)}</div>
            <div>adPhase: {adPhase}</div>
            <div>isPlaying: {String(isPlaying)}</div>
            <div>isBuffering: {String(isBuffering)}</div>
            <div>video.paused: {videoRef.current ? String(videoRef.current.paused) : 'no-el'}</div>
            <div>video.src: {videoRef.current?.src ? 'ok' : 'empty'}</div>
            <div>ready: {String(ready)}</div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}
