import { useToastStore } from '@/stores/toastStore';

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

type PlayerEvent = 'playing' | 'paused' | 'buffering' | 'error' | 'timeupdate' | 'durationchange' | 'ended';
type EventCallback = (data?: any) => void;

export class CinelarPlayerEngine {
  private player: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<PlayerEvent, EventCallback[]> = new Map();
  private attachPromise: Promise<void> | null = null;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    this.initShaka();
  }

  private initShaka() {
    if (!this.videoElement) {
      toast('[Player] No hay elemento video');
      return;
    }

    if (!shaka || !shaka.Player) {
      toast('[Player] Shaka Player no se pudo cargar');
      return;
    }

    try {
      shaka.polyfill.installAll();
    } catch (e: any) {
      toast(`[Player] Polyfill: ${e?.message ?? String(e)}`);
    }

    try {
      this.player = new shaka.Player();
      this.attachPromise = this.player.attach(this.videoElement);

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
        toast(`[Player] Error: ${code} ${message}`);
        this.emit('error', event.detail);
      });
    } catch (e: any) {
      toast(`[Player] Init fallo: ${e?.message ?? String(e)}`);
      this.player = null;
    }

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

  public async load(url: string, startTime?: number) {
    if (!this.videoElement) return;

    if (this.player && this.isAdaptiveManifest(url)) {
      try {
        if (this.attachPromise) await this.attachPromise;
        await this.player.load(url, startTime && startTime > 0 ? startTime : undefined);
        return;
      } catch (e: any) {
        toast(`[Player] Load fallo: ${e?.message ?? String(e)}`);
        this.emit('error', e);
        return;
      }
    }

    try {
      if (this.player) {
        await this.player.detach();
      }
    } catch {
      // ignore
    }

    const video = this.videoElement;
    if (startTime && startTime > 0) {
      const seekOnce = () => {
        video.currentTime = startTime;
        video.removeEventListener('loadedmetadata', seekOnce);
      };
      video.addEventListener('loadedmetadata', seekOnce);
    }
    video.src = url;
    video.load();
  }

  public play() {
    this.videoElement?.play().catch((err) => {
      toast(`[Player] Autoplay bloqueado: ${err?.message ?? String(err)}`);
    });
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
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.eventListeners.clear();
  }

  public on(event: PlayerEvent, callback: EventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  private emit(event: PlayerEvent, data?: any) {
    this.eventListeners.get(event)?.forEach((cb) => cb(data));
  }
}
