import { useToastStore } from '@/stores/toastStore';
import { pdbg, instrumentVideo } from './playerDebug';

function toast(msg: string) {
  try { useToastStore.getState().show(msg, 'error', 8000); } catch { /* ignore */ }
}

// Static import of the UMD bundle. Rolldown resolves CJS exports as named
// properties, so shakaModule.Player, shakaModule.polyfill, etc. should exist.
import * as shakaModule from 'shaka-player/dist/shaka-player.compiled.js';

// Build the shaka reference from whichever interop shape Rolldown produces.
const _mod = shakaModule as any;
const shaka: any =
  _mod.Player ? _mod :
  _mod.default?.Player ? _mod.default :
  (typeof globalThis !== 'undefined' && (globalThis as any).shaka?.Player) ? (globalThis as any).shaka :
  _mod;

type PlayerEvent = 'playing' | 'paused' | 'buffering' | 'error' | 'timeupdate' | 'durationchange' | 'ended' | 'trackschanged';
type EventCallback = (data?: any) => void;

export class CinelarPlayerEngine {
  private player: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<PlayerEvent, EventCallback[]> = new Map();
  private _videoListeners: Array<[string, EventListener]> = [];
  private _bufferingState = false;

  /** Resolves when `attach()` settles (never rejects); error stored in `attachError`. */
  private attachState: Promise<void> | null = null;
  private attachError: any = null;

  /** Serializes load() calls: Shaka rejects a load while another is in flight. */
  private loadQueue: Promise<void> = Promise.resolve();
  private loadToken = 0;

  private playRetried = false;
  private _maxHeight = 1080;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    pdbg('engine.constructor', 'video element received');
    instrumentVideo(videoElement);
    this.initShaka();
  }

  private async _detectMaxHeight(): Promise<number> {
    try {
      const mc = (navigator as any).mediaCapabilities;
      if (mc?.decodingInfo) {
        const result = await mc.decodingInfo({
          type: 'media-source',
          video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 3840, height: 2160, bitrate: 20000000, framerate: 60 },
        });
        if (result?.supported) return 2160;
      }
    } catch { /* noop */ }

    const h = Math.max(screen.height, screen.width);
    if (h >= 2160) return 2160;
    if (h >= 1440) return 1440;
    if (h >= 1080) return 1080;
    return 720;
  }

  private initShaka() {
    if (!this.videoElement) {
      toast('[Player] No hay elemento video');
      return;
    }

    if (!shaka || !shaka.Player) {
      toast('[Player] Shaka Player no se pudo cargar');
      pdbg('engine.initShaka', 'shaka NOT resolved — playback will not work');
      return;
    }

    pdbg('engine.initShaka', 'shaka resolved, version', shaka.Player.version ?? '?');

    try {
      shaka.polyfill.installAll();
      pdbg('engine.initShaka', 'polyfills installed');
    } catch (e: any) {
      toast(`[Player] Polyfill: ${e?.message ?? String(e)}`);
      pdbg('engine.initShaka', 'polyfill.installAll FAILED', e);
    }

    try {
      this.player = new shaka.Player();

      this._detectMaxHeight().then((maxH) => {
        this._maxHeight = maxH;
        pdbg('engine.initShaka', 'maxHeight detected', maxH);
        this.player!.configure({
          abr: { restrictions: { maxHeight: maxH } },
        });
      });

      this.player.configure({
        streaming: {
          bufferingGoal: 15,
          rebufferingGoal: 1,
          bufferBehind: 30,
          stallEnabled: true,
          segmentPrefetchLimit: 2,
          maxDisabledTime: 30,
          retryParameters: {
            maxAttempts: 4,
            baseDelay: 1000,
            backoffFactor: 2,
            fuzzFactor: 0.5,
            timeout: 0,
          },
        },
        abr: {
          enabled: true,
          switchInterval: 8,
          bandwidthUpgradeTarget: 0.85,
          bandwidthDowngradeTarget: 0.85,
          defaultBandwidthEstimate: 1000000,
        },
        preferredAudioLanguage: 'es',
        manifest: {
          retryParameters: {
            maxAttempts: 4,
            baseDelay: 1000,
            backoffFactor: 2,
            fuzzFactor: 0.5,
            timeout: 0,
          },
        },
      });

      this.player.addEventListener('error', (event: any) => {
        const code = event?.detail?.code ?? 'unknown';
        const message = event?.detail?.message ?? '';
        pdbg('engine.shaka-error', `code=${code}`, message, event?.detail);
        this.emit('error', event.detail);
      });

      this.player.addEventListener('trackschanged', () => {
        this.emit('trackschanged');
      });
    } catch (e: any) {
      toast(`[Player] Init fallo: ${e?.message ?? String(e)}`);
      pdbg('engine.initShaka', 'new shaka.Player() FAILED', e);
      this.player = null;
    }

    if (!this.player) return;

    pdbg('engine.initShaka', 'player created, calling attach()…');
    this.attachState = (async () => {
      try {
        await this.player.attach(this.videoElement);
        pdbg('engine.attach', 'attach() OK');
      } catch (e: any) {
        this.attachError = e;
        pdbg('engine.attach', 'attach() FAILED', e);
        // Without a working attach, Shaka cannot drive the element: drop it
        // so non-adaptive URLs fall back to native <video> playback.
        try { await this.player?.detach(); } catch { /* ignore */ }
        this.player = null;
      }
    })();

    const emitBuffering = (val: boolean) => {
      if (this._bufferingState !== val) {
        this._bufferingState = val;
        this.emit('buffering', val);
      }
    };

    const onPlay = () => this.emit('playing');
    const onPause = () => this.emit('paused');
    const onWaiting = () => emitBuffering(true);
    const onPlaying = () => emitBuffering(false);
    const onCanplay = () => emitBuffering(false);
    const onCanplaythrough = () => emitBuffering(false);
    const onTimeupdate = () => this.emit('timeupdate', this.videoElement?.currentTime);
    const onDurationchange = () => this.emit('durationchange', this.videoElement?.duration);
    const onEnded = () => this.emit('ended');

    this._videoListeners = [
      ['play', onPlay],
      ['pause', onPause],
      ['waiting', onWaiting],
      ['playing', onPlaying],
      ['canplay', onCanplay],
      ['canplaythrough', onCanplaythrough],
      ['timeupdate', onTimeupdate],
      ['durationchange', onDurationchange],
      ['ended', onEnded],
    ];

    for (const [event, handler] of this._videoListeners) {
      this.videoElement.addEventListener(event, handler);
    }
  }

  private isAdaptiveManifest(url: string): boolean {
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.m3u8') || clean.endsWith('.mpd');
  }

  /**
   * Serialized, last-wins load. Concurrent calls are queued so Shaka never
   * sees a load while another is in flight (it rejects those), and a load
   * superseded by a newer one before starting is skipped entirely.
   */
  public load(url: string, startTime?: number): Promise<void> {
    const token = ++this.loadToken;
    pdbg('engine.load', 'queued', { url, startTime, token });

    const run = this.loadQueue.then(async () => {
      if (token !== this.loadToken) {
        pdbg('engine.load', 'skipped (superseded)', token);
        return;
      }
      await this.doLoad(url, startTime);
    });

    this.loadQueue = run.catch(() => { /* keep the queue alive */ });
    return run;
  }

  private async doLoad(url: string, startTime?: number): Promise<void> {
    const video = this.videoElement;
    if (!video) return;

    if (this.attachState) {
      await this.attachState;
      if (this.attachError) {
        // attach() failed: Shaka cannot play adaptive manifests here.
        if (this.isAdaptiveManifest(url)) {
          pdbg('engine.load', 'ABORTED — attach failed and URL is adaptive');
          this.emit('error', this.attachError);
          return;
        }
      }
    }

    if (this.player && this.isAdaptiveManifest(url)) {
      pdbg('engine.load', 'starting shaka load', url);
      try {
        await this.player.load(url, startTime && startTime > 0 ? startTime : undefined);
        pdbg('engine.load', 'shaka load OK');
        return;
      } catch (e: any) {
        pdbg('engine.load', 'shaka load FAILED', e);
        this.emit('error', e);
        return;
      }
    }

    // Native fallback (progressive MP4, or Shaka unavailable/attach failed).
    if (this.player) {
      try {
        await this.player.detach();
      } catch {
        // ignore
      }
    }
    pdbg('engine.load', 'native fallback (video.src)', url);
    if (startTime && startTime > 0) {
      const seekOnce = () => {
        video.currentTime = startTime!;
        video.removeEventListener('loadedmetadata', seekOnce);
      };
      video.addEventListener('loadedmetadata', seekOnce);
    }
    video.src = url;
    video.load();
  }

  public play() {
    const video = this.videoElement;
    if (!video) return;
    pdbg('engine.play', 'calling video.play()');

    const doPlay = () => {
      const p = video.play();
      if (!p) return;
      p.then(() => {
        this.playRetried = false;
      }).catch((err: any) => {
        const name = err?.name ?? 'UnknownError';
        pdbg('engine.play', 'rejected', name, err?.message);
        // Readiness/autoplay races (AbortError/NotAllowedError) can occur right
        // after load() on TV WebViews; retry once, driven by media events
        // (no blind setTimeout), once metadata/canplay actually arrives.
        if (!this.playRetried && (name === 'AbortError' || name === 'NotAllowedError')) {
          this.playRetried = true;
          toast(`[Player] Autoplay bloqueado: ${err?.message ?? String(err)}`);
          const retry = () => {
            video.removeEventListener('loadedmetadata', retry);
            video.removeEventListener('canplay', retry);
            pdbg('engine.play', 'retrying after media-ready event');
            video.play().catch((e2: any) => {
              toast(`[Player] Autoplay bloqueado: ${e2?.message ?? String(e2)}`);
            });
          };
          video.addEventListener('loadedmetadata', retry);
          video.addEventListener('canplay', retry);
        } else {
          toast(`[Player] Autoplay bloqueado: ${err?.message ?? String(err)}`);
        }
      });
    };
    doPlay();
  }

  public pause() {
    this.videoElement?.pause();
  }

  public seek(time: number) {
    if (this.videoElement) this.videoElement.currentTime = time;
  }

  public getVariantTracksInfo(): {
    auto: boolean;
    activeHeight: number | null;
    tracks: { height: number; bandwidth: number; active: boolean }[];
  } | null {
    if (!this.player) return null;
    const cfg = this.player.getConfiguration();
    const auto = !!(cfg.abr && cfg.abr.enabled);
    const variants = this.player.getVariantTracks();
    const byHeight = new Map<number, { height: number; bandwidth: number; active: boolean }>();
    for (const v of variants) {
      if (!v.height) continue;
      const existing = byHeight.get(v.height);
      if (!existing || (v.bandwidth || 0) > existing.bandwidth) {
        byHeight.set(v.height, { height: v.height, bandwidth: v.bandwidth || 0, active: !!v.active });
      }
    }
    const tracks = Array.from(byHeight.values()).sort((a, b) => b.height - a.height);
    const active = variants.find((v: any) => v.active);
    return { auto, activeHeight: active?.height ?? null, tracks };
  }

  public getAudioTracksInfo(): {
    language: string;
    role: string;
    label: string;
    active: boolean;
  }[] | null {
    if (!this.player) return null;
    try {
      const tracks = this.player.getAudioTracks();
      if (!tracks || !tracks.length) return null;
      return tracks.map((t: any) => ({
        language: t.language || 'und',
        role: (t.roles && t.roles[0]) || '',
        label: t.label || t.language?.toUpperCase() || 'UND',
        active: !!t.active,
      }));
    } catch {
      return null;
    }
  }

  public selectQuality(option: number | 'auto') {
    if (!this.player) return;

    if (option === 'auto') {
      this.player.configure({ abr: { enabled: true } });
      return;
    }

    const video = this.videoElement;
    if (!video) return;

    // Save active audio before switching
    const currentAudioTracks = this.player.getAudioTracks();
    const activeAudioIndex = currentAudioTracks?.findIndex((t: any) => t.active) ?? -1;

    this.player.configure({ abr: { enabled: false } });

    const candidates = this.player.getVariantTracks().filter((v: any) => v.height === option);
    if (!candidates.length) return;

    candidates.sort((a: any, b: any) => (b.bandwidth || 0) - (a.bandwidth || 0));

    // Check buffered enough for safe switch (avoid glitch on low-end TVs)
    const buffered = video.buffered;
    const currentTime = video.currentTime || 0;
    let hasBuffer = false;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) - currentTime >= 2) {
        hasBuffer = true;
        break;
      }
    }

    // false = switch at next safe point (no glitch)
    this.player.selectVariantTrack(candidates[0], !hasBuffer);

    // Restore audio track
    if (activeAudioIndex >= 0) {
      const tracks = this.player.getAudioTracks();
      if (tracks && tracks[activeAudioIndex]) {
        this.player.selectAudioTrack(tracks[activeAudioIndex], false);
      }
    }
  }

  public selectAudioTrack(language: string, role?: string, index?: number) {
    if (!this.player) return;
    try {
      const tracks = this.player.getAudioTracks();
      let target: any = null;
      if (typeof index === 'number' && index >= 0 && index < tracks.length) {
        target = tracks[index];
      } else {
        target = tracks.find((t: any) => {
          const langMatch = t.language === language;
          if (role) return langMatch && (t.roles || []).includes(role);
          return langMatch;
        });
      }
      if (target) {
        this.player.selectAudioTrack(target, false);
        if (this.videoElement?.paused) {
          this.videoElement.play().catch(() => {});
        }
      }
    } catch (e: any) {
      toast(`[Player] Audio error: ${e?.message ?? String(e)}`);
    }
  }

  public applyPreferredAudioLanguage(preferred?: string) {
    if (!this.player || !preferred) return;
    const tracks = this.getAudioTracksInfo();
    if (!tracks || tracks.length <= 1) return;
    const lang = preferred.toLowerCase().split('-')[0];
    const match = tracks.find((t) => t.language.toLowerCase().startsWith(lang));
    if (match && !match.active) {
      this.selectAudioTrack(match.language, match.role || undefined);
    }
  }

  public destroy() {
    pdbg('engine.destroy');
    this.loadToken++; // invalidate any queued loads
    this._bufferingState = false;

    if (this.videoElement) {
      for (const [event, handler] of this._videoListeners) {
        this.videoElement.removeEventListener(event, handler);
      }
      this._videoListeners = [];
    }

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.eventListeners.clear();
  }

  public on(event: PlayerEvent, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
    return () => {
      const list = this.eventListeners.get(event);
      if (list) {
        const idx = list.indexOf(callback);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  private emit(event: PlayerEvent, data?: any) {
    this.eventListeners.get(event)?.forEach((cb) => cb(data));
  }
}
