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

  /** Resolves when `attach()` settles (never rejects); error stored in `attachError`. */
  private attachState: Promise<void> | null = null;
  private attachError: any = null;

  /** Serializes load() calls: Shaka rejects a load while another is in flight. */
  private loadQueue: Promise<void> = Promise.resolve();
  private loadToken = 0;

  private playRetried = false;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    pdbg('engine.constructor', 'video element received');
    instrumentVideo(videoElement);
    this.initShaka();
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

      this.player.configure({
        streaming: {
          bufferingGoal: 60,
          rebufferingGoal: 5,
          stallEnabled: true,
        },
        abr: {
          enabled: true,
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

    this.videoElement.addEventListener('play', () => this.emit('playing'));
    this.videoElement.addEventListener('pause', () => this.emit('paused'));
    this.videoElement.addEventListener('waiting', () => this.emit('buffering', true));
    this.videoElement.addEventListener('playing', () => this.emit('buffering', false));
    this.videoElement.addEventListener('canplay', () => this.emit('buffering', false));
    this.videoElement.addEventListener('canplaythrough', () => this.emit('buffering', false));
    this.videoElement.addEventListener('timeupdate', () => this.emit('timeupdate', this.videoElement?.currentTime));
    this.videoElement.addEventListener('durationchange', () => this.emit('durationchange', this.videoElement?.duration));
    this.videoElement.addEventListener('ended', () => this.emit('ended'));
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
    this.player.configure({ abr: { enabled: false } });
    const candidates = this.player.getVariantTracks().filter((v: any) => v.height === option);
    if (candidates.length) {
      candidates.sort((a: any, b: any) => (b.bandwidth || 0) - (a.bandwidth || 0));
      this.player.selectVariantTrack(candidates[0], true);
    }
  }

  public selectAudioTrack(language: string, role?: string) {
    if (!this.player) return;
    try {
      const tracks = this.player.getAudioTracks();
      const target = tracks.find((t: any) => {
        const langMatch = t.language === language;
        if (role) return langMatch && (t.roles || []).includes(role);
        return langMatch;
      });
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
