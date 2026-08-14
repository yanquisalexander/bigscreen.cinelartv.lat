<script lang="ts">
  import { replace, push } from "svelte-spa-router";
  import FocusContainer from "@/components/tv/FocusContainer.svelte";
  import Focusable from "@/components/tv/Focusable.svelte";
  import { svelteAuthStore } from "@/stores/authStore";
  import { svelteConfigStore } from "@/stores/configStore";
  import { svelteSettingsStore } from "@/stores/settingsStore";
  import { svelteSiteSettingsStore } from "@/stores/siteSettingsStore";
  import { toastStore } from "@/stores/toastStore";
  import {
    consumeWatchData,
    updateProgress,
    pingStream,
    sendStreamEnd,
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
    setOnNativePlayerFinished,
  } from "@/services/NativeBridge";
  import { fetchVast } from "@/services/player/vast-client";
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
  import { MonitorPlay, AlertTriangle } from "@lucide/svelte";
  import PlayerSettingsPanel from "@/components/player/PlayerSettingsPanel.svelte";

  import "@/components/tv/PlayerControlsElement";
  import "@/components/tv/FocusableElement";
  import "@/components/tv/FocusableCardElement";
  import "@/components/tv/AdOverlayElement";

  const AD_PREROLL_TAG =
    "https://pubads.g.doubleclick.net/gampad/live/ads?iu=/22530741549/CTV_VAST_ADS&description_url=[DESCRIPTION_URL]&tfcd=0&npa=0&sz=400x300%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&impl=s&correlator=[CACHEBUSTER]";
  const AD_POSTROLL_TAG =
    "https://youradexchange.com/video/select.php?r=11621170";

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

  let watchData = $state<WatchData | null>(null);
  let currentAd = $state<VastAd | null>(null);
  let adPhase = $state<"none" | "preroll" | "midroll" | "postroll">("none");
  let prerollChecked = $state(false);
  let settingsOpen = $state(false);
  let debugVisible = $state(
    typeof window !== "undefined" && window.location.search.includes("debug=1"),
  );

  let controlsEl = $state<any>(null);
  let adOverlayEl = $state<any>(null);
  let videoEl = $state<HTMLVideoElement | null>(null);

  let pendingNavigation: { contentId: string; episodeId?: string } | null =
    null;
  let loadedUrl: string | null = null;

  let streamLimitError = $state<string | null>(null);
  let streamLimitSessions = $state<any[]>([]);
  let playerError = $state<{ code?: number | string; message?: string } | null>(
    null,
  );
  let streamPingToken: string | null = null;
  let clientRequestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let pingIntervalId: ReturnType<typeof setInterval> | null = null;

  const tokens = $derived($svelteAuthStore.tokens);
  const isAdmin = $derived(
    $svelteAuthStore.session?.current_user?.admin ?? false,
  );
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);
  const prefersModernPlayback = $derived(
    $svelteSettingsStore.prefersModernPlayback,
  );
  const siteSettings = $derived($svelteSiteSettingsStore.settings);

  const streamUrl = $derived(watchData?.sources?.[0]?.url);
  const ready = $derived(Boolean(watchData && streamUrl));
  const useNative = $derived(!prefersModernPlayback && prefersNativePlayer());

  const userLang = $derived.by(() => {
    const prefs =
      ($svelteAuthStore.selectedProfile?.preferences as
        | Array<{ audio_language?: string; language?: string }>
        | undefined) ?? [];
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
    const idx = watchData.seasons.findIndex(
      (s) => s.id === watchData.episode!.season_id,
    );
    return idx >= 0 ? (watchData.seasons[idx].position ?? idx) : null;
  });

  const nextEpisode = $derived.by(() => {
    if (
      currentEpisodeIndex >= 0 &&
      currentEpisodeIndex < allEpisodes.length - 1
    ) {
      return allEpisodes[currentEpisodeIndex + 1];
    }
    return null;
  });

  const allSegments = $derived.by(() => {
    const epSegs = watchData?.episode?.segments ?? [];
    const contentSegs = watchData?.content?.segments ?? [];
    return [...epSegs, ...contentSegs];
  });

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
      if (tokens?.accessToken) {
        pingStream(tokens.accessToken, sessionId).catch(() => {});
      }
    }, intervalMs);
    streamPingToken = sessionId;
  }

  function releaseStreamSlot() {
    const sessionId = streamPingToken || getStoredSessionToken();
    if (!sessionId || !tokens?.accessToken) return;
    sendStreamEnd(tokens.accessToken, sessionId).catch(() => {});
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
  $effect(() => {
    if (!useNative || !contentId || !tokens) return;
    launchNativePlayer({
      contentId,
      episodeId,
      accessToken: tokens.accessToken,
      clientEndpoint,
    });
    setOnNativePlayerFinished(() => replace("/home"));
    return () => setOnNativePlayerFinished(null);
  });

  // Heal ghost focus on unmount
  $effect(() => {
    return () => {
      const key = getCurrentFocusKey();
      if (key && !doesFocusableExist(key)) {
        setFocus("sidebar");
      }
    };
  });

  // Stream slot cleanup on pagehide / unmount
  $effect(() => {
    const handlePageHide = () => {
      const sessionId = streamPingToken || getStoredSessionToken();
      if (!sessionId || !tokens?.accessToken) return;
      const url = `${window.location.origin}/stream/end`;
      const payload = new Blob([JSON.stringify({ session_id: sessionId })], {
        type: "application/json",
      });
      navigator.sendBeacon?.(url, payload);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      stopStreamPing();
      releaseStreamSlot();
    };
  });

  // Reset ad state on content / episode change
  $effect(() => {
    prerollChecked = false;
    adPhase = "none";
    currentAd = null;
    clientRequestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  });

  // Load watch data
  function fetchData() {
    if (!tokens || !contentId) return;
    watchData = null;
    streamLimitError = null;
    streamLimitSessions = [];
    stopStreamPing();

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
        const isTV =
          data.content.content_type === "TVSHOW" ||
          data.content.contentType === "TVSHOW";
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
          toastStore
            .getState()
            .show(
              "Este contenido no tiene episodios disponibles.",
              "error",
              4000,
            );
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

        if (
          err?.body?.error === "STREAM_LIMIT_REACHED" ||
          errStr.includes("STREAM_LIMIT_REACHED")
        ) {
          streamLimitError =
            "Has alcanzado el número máximo de transmisiones simultáneas.";
          streamLimitSessions = err?.body?.sessions ?? [];
          clearSessionToken();
          return;
        }

        const is502 =
          err?.status === 502 ||
          errStr.includes("502") ||
          errStr.toLowerCase().includes("bad gateway");
        toastStore
          .getState()
          .show(
            is502
              ? "El servicio no está disponible temporalmente. Intenta de nuevo."
              : "No se pudo cargar el contenido. Intenta de nuevo más tarde.",
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
    if (!streamUrl || prerollChecked || adPhase !== "none" || isAdmin) {
      if (isAdmin) prerollChecked = true;
      return;
    }
    pdbg("watch.preroll", "fetching VAST");
    fetchVast(AD_PREROLL_TAG)
      .then((ad) => {
        pdbg("watch.preroll", "vast settled", ad ? "ad found" : "no ad");
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
    if (!streamUrl || adPhase !== "none" || !prerollChecked) return;
    let cancelled = false;
    const resume = watchData?.continue_watching?.progress ?? 0;
    loadedUrl = streamUrl;
    pdbg("watch.load", "calling engine.load", {
      engineReady: engine.engineReady,
      url: streamUrl,
      resume,
    });
    engine
      .load(streamUrl, resume)
      .then(() => {
        if (cancelled) return;
        pdbg("watch.load", "engine.load resolved -> play()");
        engine.play();
        engine.applyPreferredAudioLanguage(userLang);
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

    const cover =
      resolvePoster(
        watchData.content.images,
        watchData.content.cover_resized ?? watchData.content.cover,
        clientEndpoint,
      ) ?? undefined;
    const banner =
      resolveBackdrop(
        watchData.content.images,
        watchData.content.banner_resized ?? watchData.content.banner,
        clientEndpoint,
        "medium",
      ) ?? undefined;
    const cwItemBase = {
      content_id: contentId,
      episode_id: episodeId,
      title: watchData.content.title,
      description: watchData.episode?.title ?? watchData.content.description,
      content_type:
        watchData.content.content_type ?? watchData.content.contentType,
      cover,
      cover_resized: cover,
      banner,
      banner_resized: banner,
      image_url:
        resolveBackdrop(
          watchData.content.images,
          watchData.content.banner_resized ??
            watchData.content.banner ??
            watchData.content.cover_resized ??
            watchData.content.cover,
          clientEndpoint,
          "medium",
        ) ?? undefined,
      url: `/watch/${contentId}${episodeId ? `/${episodeId}` : ""}`,
      episode_title:
        watchData.season?.title && watchData.episode?.title
          ? `${watchData.season.title} - ${watchData.episode.title}`
          : watchData.episode?.title,
    };

    const timer = setInterval(() => {
      const video = videoEl;
      if (video && video.duration) {
        const sessionToken =
          streamPingToken || getStoredSessionToken() || undefined;
        updateProgress(
          tokens.accessToken,
          contentId,
          episodeId,
          video.currentTime,
          video.duration,
          sessionToken,
        ).catch(() => {});
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
    engine.setOnEnded(() => {
      if (isAdmin) {
        if (nextEpisode) {
          replace(`/watch/${contentId}/${nextEpisode.id}`);
        } else {
          window.history.back();
        }
        return;
      }
      fetchVast(AD_POSTROLL_TAG)
        .then((ad) => {
          if (ad) {
            pendingNavigation = nextEpisode
              ? { contentId, episodeId: String(nextEpisode.id) }
              : { contentId };
            currentAd = ad;
            adPhase = "postroll";
          } else {
            if (nextEpisode) {
              replace(`/watch/${contentId}/${nextEpisode.id}`);
            } else {
              window.history.back();
            }
          }
        })
        .catch(() => {
          if (nextEpisode) {
            replace(`/watch/${contentId}/${nextEpisode.id}`);
          } else {
            window.history.back();
          }
        });
    });
  });

  // Controls properties sync
  $effect(() => {
    const el = controlsEl;
    if (!el) return;
    if (engine.engineReady) el.engineRef = engine.getEngine();
    el.videoEl = videoEl;
    if (watchData) {
      el.contentTitle = watchData.content.title;
      el.contentSubtitle = watchData.episode?.title
        ? `${(watchData.content.content_type === "TVSHOW" || watchData.content.contentType === "TVSHOW") && currentSeasonNumber ? `T${currentSeasonNumber} · ` : ""}${watchData.episode.title}`
        : "";
    }
    if (allEpisodes.length > 0) {
      el.episodes = { episodes: allEpisodes, currentId: episodeId, contentId };
    }
    el.segments = allSegments;
    el.clientEndpoint = clientEndpoint;
    el.nextEpisode = nextEpisode;
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
    });
    return unsub;
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
          if (doesFocusableExist("watch-settings")) {
            setFocus("watch-settings");
          } else if (doesFocusableExist("watch-root")) {
            setFocus("watch-root");
          }
        });
      }
    };

    const handleNextEpisode = (e: CustomEvent) => {
      const { contentId: cid, episodeId: eid } = e.detail;
      replace(`/watch/${cid}/${eid}`);
    };

    const handleSkip = () => {
      focusPlaybackControl();
    };

    const handleEpisodeSelect = (
      e: CustomEvent<{ episodeId: string | number }>,
    ) => {
      const selectedEpisodeId = e.detail.episodeId;
      if (String(selectedEpisodeId) !== String(episodeId)) {
        replace(`/watch/${contentId}/${selectedEpisodeId}`);
      }
    };

    el.addEventListener("settings-toggle", handleSettingsToggle);
    el.addEventListener("next-episode", handleNextEpisode);
    el.addEventListener("skip", handleSkip);
    el.addEventListener("episode-select", handleEpisodeSelect as EventListener);

    return () => {
      el.removeEventListener("settings-toggle", handleSettingsToggle);
      el.removeEventListener("next-episode", handleNextEpisode);
      el.removeEventListener("skip", handleSkip);
      el.removeEventListener(
        "episode-select",
        handleEpisodeSelect as EventListener,
      );
    };
  });

  // Ad completion
  $effect(() => {
    const el = adOverlayEl;
    if (!el) return;

    const handleAdComplete = () => {
      pdbg("watch.ad-complete", "received");
      const pending = pendingNavigation;
      if (pending) {
        pendingNavigation = null;
        replace(
          pending.episodeId
            ? `/watch/${pending.contentId}/${pending.episodeId}`
            : `/watch/${pending.contentId}`,
        );
        return;
      }
      currentAd = null;
      adPhase = "none";
      setFocus("watch-playpause");
    };

    el.addEventListener("ad-complete", handleAdComplete);
    return () => el.removeEventListener("ad-complete", handleAdComplete);
  });

  // Ad watchdog
  $effect(() => {
    if (adPhase === "none" || !currentAd) return;
    const graceMs = Math.max(25_000, (currentAd.duration || 0) * 1000 + 15_000);
    pdbg("watch.ad-watchdog", "armed", {
      adPhase,
      duration: currentAd.duration,
      graceMs,
    });
    const timer = setTimeout(() => {
      pdbg("watch.ad-watchdog", "FIRED — releasing gate", { adPhase });
      const pending = pendingNavigation;
      if (pending) {
        pendingNavigation = null;
        replace(
          pending.episodeId
            ? `/watch/${pending.contentId}/${pending.episodeId}`
            : `/watch/${pending.contentId}`,
        );
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
      pdbg(
        "watch.ad-overlay",
        currentAd ? "ad pushed to overlay" : "ad cleared",
      );
    }
  });

  // Back button and Play/Pause inputs
  $effect(() => {
    const handleBack = () => {
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
      window.history.back();
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

  // Auto-hide controls
  $effect(() => {
    if (engine.isPlaying && controlsEl) {
      controlsEl.showControls = true;
      setTimeout(() => {
        const controls = controlsEl;
        const currentFocus = getCurrentFocusKey() ?? "";
        if (
          controls &&
          !controls.video?.paused &&
          !controls.settingsOpen &&
          !controls.railExpanded &&
          !currentFocus.startsWith("player-settings")
        ) {
          controls.showControls = false;
        }
      }, 5000);
    }
  });

  // Focus when ready
  $effect(() => {
    if (ready && engine.engineReady) {
      focusPlaybackControl();
    }
  });

  // Sync buffering
  $effect(() => {
    if (controlsEl) {
      controlsEl.isBuffering = engine.isBuffering;
    }
  });
</script>

{#if useNative}
  <div
    class="w-full h-full bg-black flex flex-col items-center justify-center gap-5"
  >
    <div
      class="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin"
    ></div>
    <p class="text-white/50 text-base tracking-wide">
      Abriendo reproductor nativo…
    </p>
  </div>
{:else if streamLimitError}
  <FocusContainer
    focusKey="stream-limit-root"
    focusable={false}
    preferredChildFocusKey="stream-limit-home"
    trackChildren={true}
    saveLastFocusedChild={true}
    class="fixed inset-0 w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center select-none"
  >
    <div class="flex flex-col items-center text-center max-w-lg px-8">
      <MonitorPlay class="text-[#3ea6ff] mb-6 w-16 h-16" />

      <h1 class="text-white text-3xl font-semibold mb-4">
        Límite de transmisiones alcanzado
      </h1>

      <p class="text-white/70 text-base leading-relaxed mb-10">
        Ya hay demasiados dispositivos reproduciendo contenido en esta cuenta.
        Detén la transmisión en otro dispositivo para continuar viendo.
      </p>

      <div class="flex gap-4">
        <Focusable
          focusKey="stream-limit-home"
          onEnterPress={() => replace("/home")}
          autoFocus={true}
          focusedClass="!bg-white !text-black"
          class="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}
            Volver al inicio
          {/snippet}
        </Focusable>

        <Focusable
          focusKey="stream-limit-retry"
          onEnterPress={() => {
            streamLimitError = null;
            streamLimitSessions = [];
            fetchData();
          }}
          focusedClass="!bg-white !text-black"
          class="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}
            Reintentar
          {/snippet}
        </Focusable>
      </div>
    </div>
  </FocusContainer>
{:else if playerError}
  <FocusContainer
    focusKey="player-error-root"
    focusable={false}
    preferredChildFocusKey="player-error-retry"
    trackChildren={true}
    saveLastFocusedChild={true}
    class="fixed inset-0 w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center select-none"
  >
    <div class="flex flex-col items-center text-center max-w-lg px-8">
      <AlertTriangle class="text-red-400 mb-6 w-16 h-16" />

      <h1 class="text-white text-3xl font-semibold mb-4">
        Error de reproducción
      </h1>

      <p class="text-white/70 text-base leading-relaxed mb-4">
        Ocurrió un error al intentar reproducir el contenido. Por favor, intenta
        de nuevo.
      </p>

      {#if playerError.code != null || playerError.message}
        <p class="text-white/40 text-sm font-mono mb-8">
          {playerError.code != null ? playerError.code : ""}
          {playerError.message ? `: ${playerError.message}` : ""}
        </p>
      {/if}

      <div class="flex gap-4">
        <Focusable
          focusKey="player-error-back"
          onEnterPress={() => replace("/home")}
          autoFocus={true}
          focusedClass="!bg-white !text-black"
          class="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}
            Volver
          {/snippet}
        </Focusable>

        <Focusable
          focusKey="player-error-retry"
          onEnterPress={() => {
            playerError = null;
            if (loadedUrl) {
              const resume = watchData?.continue_watching?.progress ?? 0;
              engine
                .load(loadedUrl, resume)
                .then(() => {
                  engine.play();
                  engine.applyPreferredAudioLanguage(userLang);
                })
                .catch((e: any) => {
                  playerError = {
                    code: e?.code,
                    message: e?.message ?? "Error al cargar el contenido.",
                  };
                });
            }
          }}
          focusedClass="!bg-white !text-black"
          class="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}
            Reintentar
          {/snippet}
        </Focusable>
      </div>
    </div>
  </FocusContainer>
{:else}
  <FocusContainer
    focusKey="watch-root"
    focusable={false}
    preferredChildFocusKey="watch-playpause"
    trackChildren={true}
    saveLastFocusedChild={true}
    class="fixed inset-0 w-screen h-screen bg-black overflow-hidden select-none"
  >
    {#if !ready && !streamLimitError}
      <div
        class="absolute inset-0 bg-black flex flex-col items-center justify-center gap-5 z-30"
      >
        <p class="text-white/50 text-xl tracking-wide uppercase">Cargando...</p>
      </div>
    {/if}

    <video
      bind:this={videoEl}
      class="absolute inset-0 w-full h-full block object-contain object-center"
      autoplay
      playsinline
    ></video>

    <div
      class="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-60"
    ></div>

    {#if engine.engineReady}
      <tv-player-controls
        bind:this={controlsEl}
        style="display: {ready ? 'block' : 'none'};"
      ></tv-player-controls>
    {/if}

    <PlayerSettingsPanel engine={engine.getEngine()} open={settingsOpen} />

    {#if currentAd}
      <tv-ad-overlay bind:this={adOverlayEl}></tv-ad-overlay>
    {/if}

    {#if debugVisible}
      <div
        class="absolute top-0 right-0 z-50 p-3 bg-black/90 text-green-400 text-xs font-mono leading-5 max-w-xs"
      >
        <div>engineReady: {String(engine.engineReady)}</div>
        <div>watchData: {String(Boolean(watchData))}</div>
        <div>streamUrl: {streamUrl ? "ok" : "null"}</div>
        <div>prerollChecked: {String(prerollChecked)}</div>
        <div>adPhase: {adPhase}</div>
        <div>isPlaying: {String(engine.isPlaying)}</div>
        <div>isBuffering: {String(engine.isBuffering)}</div>
        <div>video.paused: {videoEl ? String(videoEl.paused) : "no-el"}</div>
        <div>video.src: {videoEl?.src ? "ok" : "empty"}</div>
        <div>ready: {String(ready)}</div>
      </div>
    {/if}
  </FocusContainer>
{/if}
