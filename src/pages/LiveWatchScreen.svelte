<script lang="ts">
  import { replace } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { svelteAuthStore } from '@/stores/authStore';
  import { createPlayerEngine } from '@/services/player/playerEngine.svelte';
  import { consumeLiveChannel } from '@/stores/liveChannelStore';
  import { getChannelGuide } from '@/api/live';
  import { pdbg } from '@/services/player/playerDebug';
  import { inputManager } from '@/services/InputManager';
  import { setFocus, doesFocusableExist, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation-core';
  import PlayerStage from '@/components/player/PlayerStage.svelte';
  import '@/components/tv/LivePlayerControlsElement';
  import '@/components/tv/FocusableElement';

  interface Props {
    params?: { channelId?: string };
  }

  let { params }: Props = $props();
  const channelId = $derived(params?.channelId ?? '');

  const engine = createPlayerEngine();

  let controlsEl = $state<any>(null);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let playerError = $state<{ code?: number | string; message?: string } | null>(null);
  let channelName = $state('');
  let programTitle = $state('');
  let secondaryText = $state('');
  let streamUrl = $state('');
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const tokens = $derived($svelteAuthStore.tokens);

  function focusPlaybackControl() {
    requestAnimationFrame(() => {
      if (doesFocusableExist('live-playpause')) setFocus('live-playpause');
      else if (doesFocusableExist('live-root')) setFocus('live-root');
    });
  }

  $effect(() => {
    if (videoEl) engine.attachVideo(videoEl);
  });

  $effect(() => {
    return () => {
      const key = getCurrentFocusKey();
      if (key && !doesFocusableExist(key)) setFocus('topnav');
    };
  });

  // Initialize from store
  $effect(() => {
    const ch = consumeLiveChannel();
    if (ch) {
      streamUrl = ch.url;
      channelName = ch.name;
      pdbg('livewatch.init', 'channel from store', { id: ch.id, name: ch.name });
    } else if (!streamUrl) {
      replace('/live');
    }
  });

  // Fetch EPG
  $effect(() => {
    if (!channelId || !tokens?.accessToken) return;
    getChannelGuide(channelId, undefined, undefined, tokens.accessToken)
      .then((guide) => {
        const now = new Date();
        const nowIso = now.toISOString();
        const current = guide.programs.find(
          (p) => p.start_time <= nowIso && p.end_time >= nowIso,
        );
        if (current) {
          programTitle = current.title;
          const start = new Date(current.start_time);
          const end = new Date(current.end_time);
          const fmt = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          const date = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
          secondaryText = `${date} • ${fmt(start)} – ${fmt(end)}`;
          pdbg('livewatch.epg', 'current program', current.title);
        }
      })
      .catch(() => {});
  });

  // Load stream
  $effect(() => {
    if (!streamUrl) return;
    let cancelled = false;
    pdbg('livewatch.load', 'loading stream', streamUrl);
    engine.load(streamUrl, undefined, undefined)
      .then(() => {
        if (cancelled) return;
        pdbg('livewatch.load', 'load OK → play');
        engine.setLiveMode(true);
        engine.play();
      })
      .catch((e: any) => {
        if (cancelled) return;
        pdbg('livewatch.load', 'load FAILED', e);
        playerError = { code: e?.code, message: e?.message ?? 'Error al cargar el stream.' };
      });
    return () => { cancelled = true; };
  });

  // Error listener
  $effect(() => {
    const raw = engine.getEngine();
    if (!raw) return;
    return raw.on('error', (err: any) => {
      const name = err?.name ?? '';
      if (name === 'AbortError' || name === 'NotAllowedError') return;
      pdbg('livewatch.player-error', err?.code, err?.message);
      playerError = { code: err?.code, message: err?.message };
    });
  });

  // Sync videoEl to controls
  $effect(() => {
    if (controlsEl && videoEl) {
      controlsEl.videoEl = videoEl;
    }
  });

  // Controls events
  $effect(() => {
    const el = controlsEl;
    if (!el) return;

    const handleBack = () => {
      window.history.back();
    };

    el.addEventListener('live-back', handleBack);
    return () => el.removeEventListener('live-back', handleBack);
  });

  // Back button + play/pause
  $effect(() => {
    const handleBack = () => {
      window.history.back();
    };

    const handlePlayPause = () => {
      controlsEl?.togglePlayPause();
    };

    inputManager.on('back', handleBack);
    inputManager.on('playpause', handlePlayPause);
    return () => {
      inputManager.off('back', handleBack);
      inputManager.off('playpause', handlePlayPause);
    };
  });

  // Auto-hide controls
  $effect(() => {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = null;
    if (engine.isPlaying && controlsEl) {
      controlsEl.showControls = true;
      hideTimeout = setTimeout(() => {
        if (controlsEl && !controlsEl.video?.paused) {
          controlsEl.showControls = false;
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
    if (streamUrl && engine.engineReady) focusPlaybackControl();
  });

  // Sync buffering
  $effect(() => {
    if (controlsEl && controlsEl.isBuffering !== engine.isBuffering) {
      controlsEl.isBuffering = engine.isBuffering;
    }
  });
</script>

<div class="fixed inset-0 w-screen h-screen bg-black -z-10"></div>

{#if playerError}
  <FocusContainer
    focusKey="live-error-root"
    focusable={false}
    preferredChildFocusKey="live-error-retry"
    trackChildren={true}
    saveLastFocusedChild={true}
    class="fixed inset-0 w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center select-none"
  >
    <div class="flex flex-col items-center text-center max-w-lg px-8">
      <p class="text-white/70 text-base leading-relaxed mb-4">
        Ocurrió un error al intentar reproducir el canal. Por favor, intenta de nuevo.
      </p>
      {#if playerError.code != null || playerError.message}
        <p class="text-white/40 text-sm font-mono mb-8">
          {playerError.code != null ? playerError.code : ''}
          {playerError.message ? `: ${playerError.message}` : ''}
        </p>
      {/if}
      <div class="flex gap-4">
        <Focusable
          focusKey="live-error-back"
          onEnterPress={() => replace('/live')}
          autoFocus={true}
          focusedClass="!bg-white !text-black"
          class="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}Volver{/snippet}
        </Focusable>
        <Focusable
          focusKey="live-error-retry"
          onEnterPress={() => {
            playerError = null;
            if (streamUrl) {
              engine.load(streamUrl)
                .then(() => { engine.setLiveMode(true); engine.play(); })
                .catch((e: any) => {
                  playerError = { code: e?.code, message: e?.message ?? 'Error al cargar el stream.' };
                });
            }
          }}
          focusedClass="!bg-white !text-black"
          class="px-8 py-3 bg-white/10 text-white font-medium rounded-full text-base cursor-pointer"
          playSound={true}
        >
          {#snippet children()}Reintentar{/snippet}
        </Focusable>
      </div>
    </div>
  </FocusContainer>
{:else}
  <PlayerStage bind:videoEl />

  <div
    class="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-60"
    style="contain: paint;"
  ></div>

  <FocusContainer
    focusKey="live-root"
    focusable={false}
    isFocusBoundary={true}
    preferredChildFocusKey="live-playpause"
    trackChildren={true}
    saveLastFocusedChild={true}
    class="fixed inset-0 z-[3] w-screen h-screen overflow-hidden select-none"
  >
    {#if !streamUrl}
      <div class="absolute inset-0 bg-black flex flex-col items-center justify-center gap-5 z-30" style="contain: layout paint;">
        <p class="text-white/50 text-xl tracking-wide uppercase">Cargando...</p>
      </div>
    {/if}

    {#if engine.engineReady}
      <tv-live-player-controls
        bind:this={controlsEl}
        channel-name={channelName}
        program-title={programTitle}
        secondary-text={secondaryText}
        style="display: {streamUrl ? 'block' : 'none'}; contain: layout style;"
      ></tv-live-player-controls>
    {/if}
  </FocusContainer>
{/if}
