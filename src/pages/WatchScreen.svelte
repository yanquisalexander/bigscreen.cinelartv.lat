<script lang="ts">
  import { replace } from "svelte-spa-router";
  import { navigateBack } from "@/services/appNavigation";
  import FocusContainer from "@/components/tv/FocusContainer.svelte";
  import Focusable from "@/components/tv/Focusable.svelte";
  import { svelteAuthStore, useAuthStore } from "@/stores/authStore";
  import { svelteConfigStore } from "@/stores/configStore";
  import { svelteSettingsStore } from "@/stores/settingsStore";
  import { svelteSiteSettingsStore } from "@/stores/siteSettingsStore";
  import { toastStore } from "@/stores/toastStore";
  import {
    consumeWatchData,
    updateProgress,
    pingStream,
    sendStreamEndBeacon,
    getStoredSessionToken,
    saveSessionToken,
    clearSessionToken,
  } from "@/features/content/api";
  import { createPlayerEngine } from "@/services/player/playerEngine.svelte";
  import { resolveBackdrop, resolvePoster } from "@/utils/helpers";
  import {
    addContinueWatching,
    prefersNative as prefersNativePlayer,
    launchNativePlayer,
    updateNativePlayerAccessToken,
    setOnNativePlayerFinished,
    supportsPiP,
    enterPiP,
  } from "@/services/NativeBridge";
  import { untrack } from "svelte";
  import { prerollAds, postrollAds } from "@/services/player/ad-tags";
  import { pdbg } from "@/services/player/playerDebug";
  import { inputManager } from "@/services/InputManager";
  import {
    setFocus,
    getCurrentFocusKey,
    doesFocusableExist,
  } from "@noriginmedia/norigin-spatial-navigation-core";
  import type { WatchData } from "@/types/content";
  import type { FlatEpisode } from "@/components/tv/RailEpisodeItem.svelte";
  import type { VastAd } from "@/types/vast";
  import CinelarLogo from "@/components/ui/CinelarLogo.svelte";
  import PlayerSettingsPanel from "@/components/player/PlayerSettingsPanel.svelte";
  import PlayerStage from "@/components/player/PlayerStage.svelte";
  import DebugStatsPanel from "@/components/player/DebugStatsPanel.svelte";
  import { showQrPanel } from "@/services/overlayPanel";
  import {
    trackPlayIntent,
    trackPlaybackStart,
    trackPlaybackError,
    trackPlaybackComplete,
    trackPlaybackExit,
    trackPlaybackBuffer,
    trackPlaybackPause,
    trackPlaybackResume,
    trackPlaybackSeek,
    trackPlaybackSessionSummary,
  } from "@/lib/analytics";

  import "@/components/tv/PlayerControlsElement";
  import "@/components/tv/FocusableElement";
  import "@/components/tv/FocusableCardElement";
  import "@/components/tv/AdOverlayElement";
  import "@/components/tv/PromoBarElement";

  interface Props {
    params?: {
      contentId?: string;
      episodeId?: string;
    };
  }

  let { params }: Props = $props();
  const contentId = $derived(params?.contentId ?? "");
  const episodeId = $derived(params?.episodeId);

  const engine = createPlayerEngine();
  const engineInstance = $derived(engine.getEngine());

  let watchData = $state<WatchData | null>(null);
  let currentAd = $state<VastAd | null>(null);
  let adPhase = $state<"none" | "preroll" | "midroll" | "postroll">("none");
  let prerollChecked = $state(false);
  let settingsOpen = $state(false);
  let debugVisible = $state(false);
  $effect(() => { debugVisible = $svelteSettingsStore.debugMode; });

  const forceShowAds = $derived(
    Boolean(
      $svelteSettingsStore.forceShowAds ||
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("_force_show_ads") === "true")
    )
  );

  const isSubscribed = $derived(
    $svelteAuthStore.session?.current_user?.is_subscribed ?? false
  );

  // Preview mode: ?promo=1 forces promo bar for design review
  const promoPreview = $derived(
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get('promo') === '1'
  );

  let controlsEl = $state<any>(null);
  const supportsPip = supportsPiP();
  let adOverlayEl = $state<any>(null);
  let promoBarEl = $state<any>(null);
  let videoEl = $state<HTMLVideoElement | null>(null);

  // Promo bar state — YouTube mealbar pattern: pending → show during playback → autodismiss
  let showPromo = $state(false);
  let promoPending = $state(false);
  let promoAdCounter = $state((() => {
    try { return parseInt(localStorage.getItem('cinelar_promo_counter') || '0', 10); }
    catch { return 0; }
  })());
  const PROMO_EVERY_N_ADS = 3;
  const PROMO_DISMISS_MS = 15_000;
  let promoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  let pendingNavigation: { contentId: string; episodeId?: string } | null = null;
  let loadedUrl: string | null = null;

  let streamLimitError = $state<string | null>(null);
  let streamLimitSessions = $state<any[]>([]);
  let playerError = $state<{ code?: number | string; message?: string } | null>(null);
  let streamPingToken: string | null = null;
  let nativeLaunchAccessToken: string | null = null;
  let clientRequestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let pingIntervalId: ReturnType<typeof setInterval> | null = null;

  // ── Analytics tracking state ──────────────────────────────────────────────
  let _playbackStartTime = 0;
  let _playbackStarted = false;
  let _bufferCount = 0;
  let _bufferTotalMs = 0;
  let _lastBufferStart = 0;
  let _playIntentTracked = false;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const tokens = $derived($svelteAuthStore.tokens);
  const isAdmin = $derived($svelteAuthStore.session?.current_user?.admin ?? false);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);
  const prefersModernPlayback = $derived($svelteSettingsStore.prefersModernPlayback);
  const siteSettings = $derived($svelteSiteSettingsStore.settings);

  const streamUrl = $derived(watchData?.sources?.[0]?.url);
  const ready = $derived(Boolean(watchData && streamUrl));
  const useNative = $derived(!prefersModernPlayback && prefersNativePlayer());
  // Reactive "has token" flag so the native launch effect runs once tokens
  // are available, without re-running when the access token is refreshed.
  const hasNativeToken = $derived(Boolean(tokens?.accessToken));

  const userLang = $derived.by(() => {
    const prefs = ($svelteAuthStore.selectedProfile?.preferences as Array<{ audio_language?: string; language?: string }> | undefined) ?? [];
    const langPref = prefs.find((p) => p?.audio_language || p?.language);
    return (
      langPref?.audio_language ??
      langPref?.language ??
      (typeof navigator !== "undefined" ? navigator.language : "es")
    );
  });

  const allEpisodes = $derived.by(() => {
    if (!watchData?.seasons) return [];
    const result: FlatEpisode[] = [];
    for (const season of watchData.seasons) {
      const seasonNum = (season.position ?? 1);
      for (const ep of season.episodes ?? []) {
        result.push({ ...ep, seasonNumber: seasonNum });
      }
    }
    return result;
  });

  const currentEpisodeIndex = $derived.by(() => {
    if (!episodeId || allEpisodes.length === 0) return -1;
    return allEpisodes.findIndex((ep) => String(ep.id) === String(episodeId));
  });

  const currentSeasonNumber = $derived.by(() => {
    if (!watchData?.episode?.season_id || !watchData?.seasons) return null;
    const idx = watchData.seasons.findIndex((s) => s.id === watchData.episode!.season_id);
    return idx >= 0 ? (watchData.seasons[idx].position ?? idx) : null;
  });

  const nextEpisode = $derived.by(() => {
    if (currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1) {
      return allEpisodes[currentEpisodeIndex + 1];
    }
    return null;
  });

  const allSegments = $derived.by(() => {
    const epSegs = watchData?.episode?.segments ?? [];
    const contentSegs = watchData?.content?.segments ?? [];
    if (epSegs.length === 0) return contentSegs;
    if (contentSegs.length === 0) return epSegs;
    return epSegs.concat(contentSegs);
  });

  // OPTIMIZACIÓN 1: Derivar los datos de episodios una sola vez para evitar comparaciones manuales costosas
  const episodesData = $derived.by(() => {
    if (allEpisodes.length === 0) return null;
    return { episodes: allEpisodes, currentId: episodeId, contentId };
  });

  function classifyPlayerError(err: any): 'DRM' | 'MANIFEST' | 'MEDIA' | 'NETWORK' | 'PLAYER' | 'UNKNOWN' {
    const code = err?.code ?? err?.status ?? 0;
    const msg = String(err?.message ?? err?.name ?? '').toLowerCase();
    if (code >= 2000 && code < 3000) return 'DRM';
    if (code >= 3000 && code < 4000) return 'MANIFEST';
    if (code >= 4000 && code < 5000) return 'MEDIA';
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('cors') || code === 1002) return 'NETWORK';
    if (msg.includes('drm') || msg.includes('license') || msg.includes('encrypted')) return 'DRM';
    if (msg.includes('manifest') || msg.includes('mpd') || msg.includes('m3u8')) return 'MANIFEST';
    return 'PLAYER';
  }

  function stopStreamPing() {
    if (pingIntervalId) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
  }

  function startStreamPing(sessionId: string) {
    if (!sessionId) return;
    stopStreamPing();
    const intervalMs = (siteSettings.stream_ping_interval_seconds || 10) * 1000;
    pingIntervalId = setInterval(() => {
      // Always read the live store token — it may have been refreshed
      // since this interval was created.
      const accessToken = useAuthStore.getState().tokens?.accessToken;
      if (accessToken) {
        pingStream(accessToken, sessionId).catch(() => {});
      }
    }, intervalMs);
    streamPingToken = sessionId;
  }

  function focusPlaybackControl() {
    requestAnimationFrame(() => {
      if (doesFocusableExist("watch-playpause")) {
        setFocus("watch-playpause");
      } else if (doesFocusableExist("watch-root")) {
        setFocus("watch-root");
      }
    });
  }

  $effect(() => {
    if (videoEl) {
      engine.attachVideo(videoEl);
    }
  });

  // Native player delegation
  // Launch is keyed on content + token availability, NOT on the token value —
  // a token refresh must not restart native playback.
  $effect(() => {
    if (!useNative || !contentId || !hasNativeToken) return;
    const launchToken = untrack(() => tokens);
    if (!launchToken?.accessToken) return;

    nativeLaunchAccessToken = launchToken.accessToken;
    launchNativePlayer({
      contentId,
      episodeId,
      accessToken: launchToken.accessToken,
      refreshToken: launchToken.refreshToken,
      clientEndpoint,
    });
    setOnNativePlayerFinished(() => replace("/home"));
    return () => setOnNativePlayerFinished(null);
  });

  // Push refreshed tokens to the running native player without relaunching.
  $effect(() => {
    if (!useNative || !hasNativeToken) return;
    const accessToken = tokens?.accessToken;
    const refreshToken = tokens?.refreshToken;
    if (!accessToken) return;

    if (nativeLaunchAccessToken === accessToken) return;
    nativeLaunchAccessToken = accessToken;
    updateNativePlayerAccessToken?.({ accessToken, refreshToken });
  });

  // Heal ghost focus on unmount
  $effect(() => {
    return () => {
      const key = getCurrentFocusKey();
      if (key && !doesFocusableExist(key)) {
        setFocus("topnav");
      }
    };
  });

  // OPTIMIZACIÓN 2: Limpieza de slot y analytics al salir (keepalive fetch autenticado)
  $effect(() => {
    const handlePageHide = () => {
      const sessionId = streamPingToken || getStoredSessionToken();
      const accessToken = useAuthStore.getState().tokens?.accessToken;

      // 1. Liberar slot de transmisión de forma asíncrona (con Authorization + CLIENT_ENDPOINT)
      if (sessionId && accessToken) {
        sendStreamEndBeacon(accessToken, sessionId);
      }

      // 2. Enviar métricas de salida de forma asíncrona
      if (videoEl && videoEl.duration && _playbackStarted) {
        const watchedPct = (videoEl.currentTime / videoEl.duration) * 100;
        trackPlaybackExit(contentId, videoEl.currentTime, videoEl.duration, watchedPct, 'pagehide');
      }

      // 3. Enviar session summary (Package 6: Telemetría)
      const summary = engine.getSessionSummary?.();
      if (summary && _playbackStarted) {
        trackPlaybackSessionSummary(contentId, {
          total_stalls: summary.totalStalls,
          total_resyncs: summary.totalResyncs,
          total_quality_changes: summary.totalQualityChanges,
          avg_drop_rate: summary.avgDropRate,
          avg_buffer_health: summary.avgBufferHealth,
          peak_quality_height: summary.peakQualityHeight,
          session_duration_ms: Math.round(summary.sessionDurationMs),
          recovery_attempts: summary.recoveryAttempts,
          recovery_successes: summary.recoverySuccesses,
        });
      }
      
      stopStreamPing();
      if (promoDismissTimer) { clearTimeout(promoDismissTimer); promoDismissTimer = null; }
    };
    
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      handlePageHide(); // Fallback por si pagehide no se dispara en ciertos navegadores de TV
    };
  });

  // Reset ad state on content / episode change
  $effect(() => {
    // Read reactive values to create dependencies — re-runs on change
    const _cid = contentId;
    const _eid = episodeId;

    prerollChecked = false;
    adPhase = "none";
    currentAd = null;
    promoPending = false;
    showPromo = false;
    _promoPreviewShown = false;
    if (promoDismissTimer) { clearTimeout(promoDismissTimer); promoDismissTimer = null; }
    _playIntentTracked = false;
    clientRequestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  });

  // Load watch data
  function fetchData() {
    if (!tokens || !contentId) return;
    
    // CORRECCIÓN: No anulamos watchData aquí para no perder la referencia si se necesita, 
    // o si lo hacemos, evaluamos el intent DESPUÉS de recibir los nuevos datos.
    streamLimitError = null;
    streamLimitSessions = [];
    stopStreamPing();
    _playbackStarted = false;
    _bufferCount = 0;
    _bufferTotalMs = 0;
    _lastBufferStart = 0;

    const storedToken = getStoredSessionToken();
    const opts = {
      deviceSessionToken: storedToken ?? undefined,
      clientRequestId,
    };

    pdbg("watch.watchdata", "fetching", {
      contentId,
      episodeId,
      hasToken: Boolean(storedToken),
    });
    
    consumeWatchData(tokens.accessToken, contentId, episodeId, opts)
      .then((data) => {
        pdbg("watch.watchdata", "resolved", {
          hasSources: Boolean(data.sources?.length),
          title: data.content?.title,
        });

        // CORRECCIÓN: Evaluamos play_intent AHORA que tenemos los datos reales
        if (!_playIntentTracked) {
          _playIntentTracked = true;
          const source = (data.continue_watching?.progress ?? 0) > 0 ? 'continue_watching' : 'detail';
          trackPlayIntent(
            contentId,
            (data.content?.content_type ?? data.content?.contentType ?? 'movie') as 'movie' | 'series' | 'live',
            source as any,
            episodeId,
          );
        }

        const isTV = data.content.content_type === "TVSHOW" || data.content.contentType === "TVSHOW";
        if (isTV && !episodeId && !data.episode) {
          const firstEpisode = data.seasons?.[0]?.episodes?.[0];
          if (firstEpisode) {
            replace(`/watch/${contentId}/${firstEpisode.id}`);
            return;
          }
        }
        if (!episodeId && data.episode) {
          replace(`/watch/${contentId}/${data.episode.id}`);
          return;
        }
        if (!data.sources?.length) {
          toastStore.getState().show("Este contenido no tiene episodios disponibles.", "error", 4000);
          replace("/home");
          return;
        }

        if (data.deviceSessionToken) {
          saveSessionToken(data.deviceSessionToken);
          startStreamPing(data.deviceSessionToken);
        } else {
          clearSessionToken();
        }

        watchData = data;
      })
      .catch((err: any) => {
        pdbg("watch.watchdata", "REJECTED", err);
        const errStr = String(err?.message ?? err ?? "");

        if (err?.body?.error === "STREAM_LIMIT_REACHED" || errStr.includes("STREAM_LIMIT_REACHED")) {
          streamLimitError = "Has alcanzado el número máximo de transmisiones simultáneas.";
          streamLimitSessions = err?.body?.sessions ?? [];
          clearSessionToken();
          return;
        }

        const is502 = err?.status === 502 || errStr.includes("502") || errStr.toLowerCase().includes("bad gateway");
        toastStore.getState().show(
          is502 ? "El servicio no está disponible temporalmente. Intenta de nuevo." : "No se pudo cargar el contenido. Intenta de nuevo más tarde.",
          "error",
          is502 ? 6000 : 4000,
        );
        replace("/home");
      });
  }

  $effect(() => {
    if (contentId) {
      fetchData();
    }
  });

  // Preroll
  $effect(() => {
    if (!streamUrl || prerollChecked || adPhase !== "none" || (isAdmin && !forceShowAds)) {
      if (isAdmin && !forceShowAds) prerollChecked = true;
      return;
    }
    pdbg("watch.preroll", "fetching VAST");
    prerollAds.next(7000)
      .then((ad) => {
        pdbg("watch.preroll", "vast settled", ad ? "ad found" : "no ad", prerollAds.currentLabel);
        prerollChecked = true;
        if (ad) {
          adPhase = "preroll";
          currentAd = ad;
        }
      })
      .catch(() => {
        pdbg("watch.preroll", "vast rejected");
        prerollChecked = true;
      });

    const safety = setTimeout(() => {
      pdbg("watch.preroll", "safety timeout — opening gate");
      prerollChecked = true;
    }, 9000);
    return () => clearTimeout(safety);
  });

  // Load stream
  $effect(() => {
    // Stream loads after ad completes; promo will overlay during playback
    if (!streamUrl || adPhase !== "none" || !prerollChecked) return;
    let cancelled = false;
    const resume = watchData?.continue_watching?.progress ?? 0;
    loadedUrl = streamUrl;
    pdbg("watch.load", "calling engine.load", {
      engineReady: engine.engineReady,
      url: streamUrl,
      resume,
      userLang,
    });
    engine.load(streamUrl, resume, userLang)
      .then(() => {
        if (cancelled) return;
        pdbg("watch.load", "engine.load resolved -> play()");
        _playbackStartTime = performance.now();
        engine.play();
      })
      .catch((e: any) => {
        if (cancelled) return;
        pdbg("watch.load", "engine.load rejected");
        playerError = {
          code: e?.code,
          message: e?.message ?? "Error al cargar el contenido.",
        };
      });
    return () => {
      cancelled = true;
    };
  });

  // Progress reporting
  $effect(() => {
    if (!tokens || !contentId || !watchData) return;

    const cover = resolvePoster(watchData.content.images, watchData.content.cover_resized ?? watchData.content.cover, clientEndpoint) ?? undefined;
    const banner = resolveBackdrop(watchData.content.images, watchData.content.banner_resized ?? watchData.content.banner, clientEndpoint, "medium") ?? undefined;
    
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
      image_url: resolveBackdrop(watchData.content.images, watchData.content.banner_resized ?? watchData.content.banner ?? watchData.content.cover_resized ?? watchData.content.cover, clientEndpoint, "medium") ?? undefined,
      url: `/watch/${contentId}${episodeId ? `/${episodeId}` : ""}`,
      episode_title: watchData.season?.title && watchData.episode?.title ? `${watchData.season.title} - ${watchData.episode.title}` : watchData.episode?.title,
    };

    const timer = setInterval(() => {
      const video = videoEl;
      if (video && video.duration && !video.paused) {
        const accessToken = useAuthStore.getState().tokens?.accessToken;
        if (!accessToken) return;
        const sessionToken = streamPingToken || getStoredSessionToken() || undefined;
        updateProgress(accessToken, contentId, episodeId, video.currentTime, video.duration, sessionToken).catch(() => {});
        addContinueWatching({
          ...cwItemBase,
          progress: Math.round(video.currentTime * 1000),
          duration: Math.round(video.duration * 1000),
        });
      }
    }, 10000);
    return () => clearInterval(timer);
  });

  // On ended
  $effect(() => {
    if (!engine.engineReady) return;
    
    const handleEnded = () => {
      const video = videoEl;
      if (video && video.duration) {
        const contentType = (watchData?.content?.content_type ?? watchData?.content?.contentType ?? 'movie') as string;
        trackPlaybackComplete(contentId, contentType, video.duration, 100, episodeId);
      }

      if (isAdmin && !forceShowAds) {
        if (nextEpisode) replace(`/watch/${contentId}/${nextEpisode.id}`);
        else navigateBack();
        return;
      }

      postrollAds.next(7000)
        .then((ad) => {
          if (ad) {
            pendingNavigation = nextEpisode ? { contentId, episodeId: String(nextEpisode.id) } : { contentId };
            currentAd = ad;
            adPhase = "postroll";
          } else {
            if (nextEpisode) replace(`/watch/${contentId}/${nextEpisode.id}`);
            else navigateBack();
          }
        })
        .catch(() => {
          if (nextEpisode) replace(`/watch/${contentId}/${nextEpisode.id}`);
          else navigateBack();
        });
    };
    
    engine.setOnEnded(handleEnded);
  });

  // OPTIMIZACIÓN 3: Controls properties sync — solo escribe cuando los valores cambian realmente
  $effect(() => {
    const el = controlsEl;
    if (!el || !engine.engineReady) return;

    if (el.engineRef !== engine.getEngine()) el.engineRef = engine.getEngine();
    if (el.videoEl !== videoEl) el.videoEl = videoEl;
    if (el.segments !== allSegments) el.segments = allSegments;
    if (el.clientEndpoint !== clientEndpoint) el.clientEndpoint = clientEndpoint;
    if (el.nextEpisode !== nextEpisode) el.nextEpisode = nextEpisode;

    if (watchData) {
      const title = watchData.content.title;
      if (el.contentTitle !== title) el.contentTitle = title;
      
      const subtitle = watchData.episode?.title
        ? `${(watchData.content.content_type === "TVSHOW" || watchData.content.contentType === "TVSHOW") && currentSeasonNumber ? `T${currentSeasonNumber} · ` : ""}${watchData.episode.title}`
        : "";
      if (el.contentSubtitle !== subtitle) el.contentSubtitle = subtitle;

      const advisory = watchData.content.content_rating?.description ?? '';
      if (el.advisoryText !== advisory) el.advisoryText = advisory;
    }

    const epData = episodesData;
    if (epData) {
      const prev = el.episodes;
      if (!prev || prev.currentId !== epData.currentId || prev.contentId !== epData.contentId) {
        el.episodes = epData;
      }
    }
  });

  // Error listener from engine
  $effect(() => {
    const rawEngine = engine.getEngine();
    if (!rawEngine) return;
    const unsub = rawEngine.on("error", (err: any) => {
      const name = err?.name ?? "";
      if (name === "AbortError" || name === "NotAllowedError") return;
      pdbg("watch.player-error", "showing overlay", err?.code, err?.message);
      playerError = { code: err?.code, message: err?.message };

      const errorCategory = classifyPlayerError(err);
      const phase = _playbackStarted ? 'running' : 'load';
      trackPlaybackError(contentId, err?.code, err?.message, errorCategory, phase);
    });
    return unsub;
  });

  // Playback start detection — uses reactive engine.isPlaying instead of raw engine event
  $effect(() => {
    if (engine.isPlaying && !_playbackStarted) {
      _playbackStarted = true;
      const startupMs = Math.round(performance.now() - _playbackStartTime);
      const contentType = (watchData?.content?.content_type ?? watchData?.content?.contentType ?? 'movie') as string;
      const prof = engine.getProfile();
      trackPlaybackStart(
        contentId,
        contentType as any,
        'detail',
        startupMs,
        undefined,
        undefined,
        episodeId,
        prof?.platform,
        prof?.isLowEndDevice,
        prof?.decoderMaxHeight,
        prof?.bandwidthEstimate,
      );
    }
  });

  // Buffer tracking — uses reactive engine.isBuffering instead of raw engine event
  $effect(() => {
    if (engine.isBuffering) {
      _bufferCount++;
      _lastBufferStart = performance.now();
    } else if (_lastBufferStart > 0) {
      _bufferTotalMs += performance.now() - _lastBufferStart;
      _lastBufferStart = 0;
    }
  });

  // Controls events
  $effect(() => {
    const el = controlsEl;
    if (!el) return;

    const handleSettingsToggle = (e: CustomEvent) => {
      const open = Boolean(e.detail.open);
      settingsOpen = open;
      if (!open) {
        requestAnimationFrame(() => {
          if (doesFocusableExist("watch-settings")) setFocus("watch-settings");
          else if (doesFocusableExist("watch-root")) setFocus("watch-root");
        });
      }
    };

    const handleNextEpisode = (e: CustomEvent) => {
      const { contentId: cid, episodeId: eid } = e.detail;
      replace(`/watch/${cid}/${eid}`);
    };

    const handleSkip = () => focusPlaybackControl();

    const handleRestartVideo = () => {
      focusPlaybackControl();
    };

    const handlePipToggle = () => {
      enterPiP();
    };

    const handleEpisodeSelect = (e: CustomEvent<{ episodeId: string | number }>) => {
      const selectedEpisodeId = e.detail.episodeId;
      if (String(selectedEpisodeId) !== String(episodeId)) {
        videoEl?.pause();
        replace(`/watch/${contentId}/${selectedEpisodeId}`);
      }
    };

    el.addEventListener("settings-toggle", handleSettingsToggle);
    el.addEventListener("next-episode", handleNextEpisode);
    el.addEventListener("skip", handleSkip);
    el.addEventListener("restart-video", handleRestartVideo);
    el.addEventListener("episode-select", handleEpisodeSelect as EventListener);
    el.addEventListener("pip-toggle", handlePipToggle);

    return () => {
      el.removeEventListener("settings-toggle", handleSettingsToggle);
      el.removeEventListener("next-episode", handleNextEpisode);
      el.removeEventListener("skip", handleSkip);
      el.removeEventListener("restart-video", handleRestartVideo);
      el.removeEventListener("episode-select", handleEpisodeSelect as EventListener);
      el.removeEventListener("pip-toggle", handlePipToggle);
    };
  });

  // Ad completion
  $effect(() => {
    const el = adOverlayEl;
    if (!el) return;

const handleAdComplete = () => {
      pdbg("watch.ad-complete", "received");
      const pending = pendingNavigation;
      const wasPreroll = adPhase === "preroll";

      if (pending) {
        pendingNavigation = null;
        replace(pending.episodeId ? `/watch/${pending.contentId}/${pending.episodeId}` : `/watch/${pending.contentId}`);
        return;
      }

      currentAd = null;
      adPhase = "none";

      // Defer promo until playback actually starts (YouTube mealbar pattern)
      if (wasPreroll) {
        const isAdminUser = isAdmin;
        const isSubscribedUser = isSubscribed;
        const promoPreview = typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get('promo') === '1';

        if (promoPreview || isAdminUser) {
          promoAdCounter++;
          localStorage.setItem('cinelar_promo_counter', String(promoAdCounter));
          pdbg("watch.promo", "preview/admin mode - pending, counter", promoAdCounter);
          promoPending = true;
        } else if (!isSubscribedUser) {
          promoAdCounter++;
          localStorage.setItem('cinelar_promo_counter', String(promoAdCounter));
          pdbg("watch.promo", "normal mode - counter incremented", promoAdCounter);

          if (promoAdCounter >= PROMO_EVERY_N_ADS) {
            pdbg("watch.promo", "promo pending after N ads");
            promoPending = true;
            promoAdCounter = 0;
            localStorage.setItem('cinelar_promo_counter', '0');
          }
        }
      }

      setFocus("watch-playpause");
    };

    el.addEventListener("ad-complete", handleAdComplete);
    return () => el.removeEventListener("ad-complete", handleAdComplete);
  });

  // Show promo DURING playback — YouTube mealbar pattern
  // Waits for playback to start, then overlays promo and hides controls
  $effect(() => {
    if (!promoPending || showPromo) return;
    if (!engine.isPlaying) return;

    pdbg("watch.promo", "showing promo during playback");
    showPromo = true;
    promoPending = false;

    // Hide player controls while promo is visible; tell controls promo owns focus
    if (controlsEl) {
      controlsEl.promoActive = true;
      controlsEl.showControls = false;
    }

    // Focus promo CTA — wait for element to mount
    requestAnimationFrame(() => {
      setTimeout(() => {
        try { setFocus('promo-cta'); } catch { /* noop */ }
      }, 60);
    });

    // Autodismiss
    if (promoDismissTimer) clearTimeout(promoDismissTimer);
    promoDismissTimer = setTimeout(() => {
      pdbg("watch.promo", "auto-dismissed");
      promoDismissTimer = null;
      showPromo = false;
      if (controlsEl) {
        controlsEl.promoActive = false;
        controlsEl.showControls = true;
      }
      focusPlaybackControl();
    }, PROMO_DISMISS_MS);
  });

  // Promo bar events
  $effect(() => {
    const el = promoBarEl;
    if (!el) return;

    const clearPromoTimer = () => {
      if (promoDismissTimer) { clearTimeout(promoDismissTimer); promoDismissTimer = null; }
    };

    const restoreControls = () => {
      if (controlsEl) {
        controlsEl.promoActive = false;
        controlsEl.showControls = true;
      }
    };

    const handleDismiss = () => {
      pdbg("watch.promo", "dismissed");
      showPromo = false;
      clearPromoTimer();
      restoreControls();
      focusPlaybackControl();
    };

    const handleCta = () => {
      pdbg("watch.promo", "cta clicked");
      showPromo = false;
      clearPromoTimer();
      restoreControls();
      const plansUrl = `https://cinelartv.lat/account/billing`;
      showQrPanel({
        title: "CinelarTV+",
        subtitle: "Mirá sin anuncios, sin conexión y en segundo plano.",
        url: plansUrl,
        caption: "Escaneá con tu celular para suscribirte",
        closeLabel: "Cerrar",
      });
      focusPlaybackControl();
    };

    el.addEventListener("promo-dismiss", handleDismiss);
    el.addEventListener("promo-cta", handleCta);
    return () => {
      el.removeEventListener("promo-dismiss", handleDismiss);
      el.removeEventListener("promo-cta", handleCta);
    };
  });

  // Preview mode: force-show promo once for design review (?promo=1)
  let _promoPreviewShown = false;
  $effect(() => {
    if (showPromo || promoPending || _promoPreviewShown) return;
    const isPreview = typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get('promo') === '1';
    if (!isPreview) return;
    if (adPhase !== "none" || currentAd) return;
    pdbg("watch.promo", "preview mode — pending promo");
    _promoPreviewShown = true;
    promoPending = true;
  });

  // Ad watchdog
  $effect(() => {
    if (adPhase === "none" || !currentAd) return;
    const graceMs = Math.max(25_000, (currentAd.duration || 0) * 1000 + 15_000);
    pdbg("watch.ad-watchdog", "armed", { adPhase, duration: currentAd.duration, graceMs });
    
    const timer = setTimeout(() => {
      pdbg("watch.ad-watchdog", "FIRED — releasing gate", { adPhase });
      const pending = pendingNavigation;
      if (pending) {
        pendingNavigation = null;
        replace(pending.episodeId ? `/watch/${pending.contentId}/${pending.episodeId}` : `/watch/${pending.contentId}`);
        return;
      }
      currentAd = null;
      adPhase = "none";
    }, graceMs);
    return () => clearTimeout(timer);
  });

  // Ad push to element
  $effect(() => {
    const el = adOverlayEl;
    if (el) {
      el.ad = currentAd;
      el.setAttribute("skip-offset", "5");
      pdbg("watch.ad-overlay", currentAd ? "ad pushed to overlay" : "ad cleared");
    }
  });

  // Back button and Play/Pause inputs
  $effect(() => {
    const handleBack = () => {
      // Promo takes priority — dismiss on back
      if (showPromo) {
        promoBarEl?.dismiss();
        return;
      }
      if (settingsOpen) {
        if (controlsEl) controlsEl.settingsOpen = false;
        return;
      }
      if (controlsEl?.railExpanded) {
        controlsEl.railExpanded = false;
        setFocus("watch-episodes");
        return;
      }
      if (controlsEl?.showControls) {
        controlsEl.showControls = false;
        return;
      }

      const video = videoEl;
      if (video && video.duration) {
        const watchedPct = (video.currentTime / video.duration) * 100;
        trackPlaybackExit(contentId, video.currentTime, video.duration, watchedPct, 'back');
      }

      navigateBack();
    };

    const handlePlayPause = () => {
      if (controlsEl?.settingsOpen) return;
      controlsEl?.togglePlayPause();
    };

    inputManager.on("back", handleBack);
    inputManager.on("playpause", handlePlayPause);

    return () => {
      inputManager.off("back", handleBack);
      inputManager.off("playpause", handlePlayPause);
    };
  });

  // Auto-hide controls — skip if promo overlay is active
  $effect(() => {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = null;
    if (showPromo) return;
    if (engine.isPlaying && controlsEl) {
      controlsEl.showControls = true;
      hideTimeout = setTimeout(() => {
        const controls = controlsEl;
        const currentFocus = getCurrentFocusKey() ?? "";
        if (
          controls &&
          !controls.video?.paused &&
          !controls.settingsOpen &&
          !controls.railExpanded &&
          !currentFocus.startsWith("player-settings") &&
          !showPromo
        ) {
          controls.showControls = false;
        }
        hideTimeout = null;
      }, 5000);
    }
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = null;
    };
  });

  // Focus when ready
  $effect(() => {
    if (ready && engine.engineReady) {
      focusPlaybackControl();
    }
  });

  // Sync buffering — only write when value changes
  $effect(() => {
    if (controlsEl && controlsEl.isBuffering !== engine.isBuffering) {
      controlsEl.isBuffering = engine.isBuffering;
    }
  });
</script>

<div class="fixed inset-0 w-screen h-screen bg-black -z-10"></div>

{#if streamLimitError}
  <FocusContainer
    focusKey="stream-limit-root"
    focusable={false}
    preferredChildFocusKey="stream-limit-home"
    trackChildren={true}
    saveLastFocusedChild={true}
    class="fixed inset-0 w-screen h-screen bg-[#050505] flex flex-col justify-center px-[clamp(2.5rem,6vw,6rem)] select-none z-[9999]"
  >
    <div class="fixed top-[clamp(2.5rem,6vh,4rem)] left-[clamp(2.5rem,6vw,6rem)]">
      <CinelarLogo class="h-[clamp(1.75rem,3.5vh,2.25rem)] w-auto text-white" />
    </div>

    <div class="flex flex-col items-start text-left max-w-3xl">
      <h1 class="text-white text-[clamp(2rem,3.5vw,3rem)] font-bold mb-4 leading-tight">
        Límite de transmisiones alcanzado
      </h1>
      <p class="text-white/75 text-[clamp(0.95rem,1.4vw,1.15rem)] leading-relaxed mb-8 max-w-2xl">
        Ya hay demasiados dispositivos reproduciendo contenido en esta cuenta. Detén la transmisión en otro dispositivo para continuar viendo.
      </p>

      <div class="flex items-center gap-4 mb-6">
        <Focusable
          focusKey="stream-limit-home"
          onEnterPress={() => replace("/home")}
          autoFocus={true}
          focusedClass="!bg-white !text-black shadow-lg"
          class="px-8 py-3.5 bg-white/15 text-white font-semibold rounded-lg text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}Volver al inicio{/snippet}
        </Focusable>
        <Focusable
          focusKey="stream-limit-retry"
          onEnterPress={() => {
            streamLimitError = null;
            streamLimitSessions = [];
            fetchData();
          }}
          focusedClass="!bg-white !text-black shadow-lg"
          class="px-8 py-3.5 bg-white/15 text-white font-semibold rounded-lg text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}Reintentar{/snippet}
        </Focusable>
      </div>

      <p class="text-white/35 text-xs font-mono tracking-wide mt-2">
        Código: CTV-LIMIT-409
      </p>
    </div>
  </FocusContainer>
{:else if playerError}
  <FocusContainer
    focusKey="player-error-root"
    focusable={false}
    preferredChildFocusKey="player-error-retry"
    trackChildren={true}
    saveLastFocusedChild={true}
    class="fixed inset-0 w-screen h-screen bg-[#050505] flex flex-col justify-center px-[clamp(2.5rem,6vw,6rem)] select-none z-[9999]"
  >
    <div class="fixed top-[clamp(2.5rem,6vh,4rem)] left-[clamp(2.5rem,6vw,6rem)]">
      <CinelarLogo class="h-[clamp(1.75rem,3.5vh,2.25rem)] w-auto text-white" />
    </div>

    <div class="flex flex-col items-start text-left max-w-3xl">
      <h1 class="text-white text-[clamp(2rem,3.5vw,3rem)] font-bold mb-4 leading-tight">
        Ha ocurrido un error
      </h1>
      <p class="text-white/75 text-[clamp(0.95rem,1.4vw,1.15rem)] leading-relaxed mb-8 max-w-2xl">
        No podemos reproducir este título en este momento. Inténtalo de nuevo más tarde o selecciona otro título.
      </p>

      <div class="flex items-center gap-4 mb-6">
        <Focusable
          focusKey="player-error-retry"
          onEnterPress={() => {
            playerError = null;
            if (loadedUrl) {
              const resume = watchData?.continue_watching?.progress ?? 0;
              engine.load(loadedUrl, resume, userLang)
                .then(() => {
                  engine.play();
                })
                .catch((e: any) => {
                  playerError = { code: e?.code, message: e?.message ?? "Error al cargar el contenido." };
                });
            }
          }}
          autoFocus={true}
          focusedClass="!bg-white !text-black shadow-lg"
          class="px-8 py-3.5 bg-white/15 text-white font-semibold rounded-lg text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}Reintentar{/snippet}
        </Focusable>
        <Focusable
          focusKey="player-error-back"
          onEnterPress={() => replace("/home")}
          focusedClass="!bg-white !text-black shadow-lg"
          class="px-8 py-3.5 bg-white/15 text-white font-semibold rounded-lg text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}Volver al inicio{/snippet}
        </Focusable>
      </div>

      <p class="text-white/35 text-xs font-mono tracking-wide mt-2">
        Código: {playerError.code != null ? playerError.code : "SHAKA-ERR-500"} {playerError.message ? `(${playerError.message})` : ""}
      </p>
    </div>
  </FocusContainer>
{:else}
    <!-- YouTube TV Compositor Layer: All player elements wrapped in a single
         position:relative + translateZ(0) container. Forces Chromium to composite
         video + overlays as one stable GPU layer, preventing reflows on UI updates. -->
    <div class="player-compositor">
      <PlayerStage bind:videoEl={videoEl} />

      <div
        class="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-60"
        style="contain: paint;"
      ></div>

      <FocusContainer
        focusKey="watch-root"
        focusable={false}
        isFocusBoundary={true}
        preferredChildFocusKey="watch-playpause"
        trackChildren={true}
        saveLastFocusedChild={true}
        class="absolute inset-0 z-[3] w-full h-full overflow-hidden select-none"
      >
      {#if !ready && !streamLimitError}
        <div class="absolute inset-0 bg-black flex flex-col items-center justify-center gap-5 z-30" style="contain: layout paint;">
          <p class="text-white/50 text-xl tracking-wide uppercase">Cargando...</p>
        </div>
      {/if}

      {#if engine.engineReady}
        <tv-player-controls
          bind:this={controlsEl}
          style="display: {ready && !showPromo ? 'block' : 'none'}; contain: layout style;"
            supports-pip="${supportsPip}"
        ></tv-player-controls>
      {/if}

      <PlayerSettingsPanel engine={engineInstance} open={settingsOpen} />

      {#if currentAd}
        <tv-ad-overlay bind:this={adOverlayEl}></tv-ad-overlay>
      {/if}

      {#if debugVisible}
        <DebugStatsPanel
          engine={engineInstance}
          {videoEl}
          {streamUrl}
          {adPhase}
          {prerollChecked}
        />
      {/if}

      {#if showPromo}
        <tv-promo-bar bind:this={promoBarEl}></tv-promo-bar>
      {/if}
    </FocusContainer>

    </div>
{/if}

<style>
  .player-compositor {
    position: relative;
    width: 100vw;
    height: 100vh;
    transform: translateZ(0);
    will-change: transform;
    contain: layout style;
  }
</style>