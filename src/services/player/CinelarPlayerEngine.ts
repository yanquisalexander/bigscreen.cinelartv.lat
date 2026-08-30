import { pdbg } from './playerDebug';

// Tipos
type PlayerEvent = 'playing' | 'paused' | 'buffering' | 'error' | 'timeupdate' | 'durationchange' | 'ended' | 'trackschanged';
type EventCallback = (data?: any) => void;

export interface TvPlayerProfile {
  displayMaxHeight: number;
  decoderMaxHeight: number;
  maxFps: number;
  codecs: { h264: boolean; hevc: boolean; vp9: boolean; av1: boolean };
  bandwidthEstimate: number;
  performanceCap?: { maxHeight: number; reason: string };
  isLowEndDevice: boolean;
}

interface StoredPlayerPerformance {
  bandwidth?: number;
  performanceCapHeight?: number;
  performanceCapReason?: string;
  stabilityStreakMs?: number;
}

const PERF_STORAGE_KEY = 'cinelar_player_perf';

// Importación segura de Shaka (ajusta la ruta según tu bundler: Vite, Rolldown, etc.)
import * as shakaModule from 'shaka-player/dist/shaka-player.compiled.js';
const _mod = shakaModule as any;
const shaka: any =
  _mod.Player ? _mod :
    _mod.default?.Player ? _mod.default :
      (typeof globalThis !== 'undefined' && (globalThis as any).shaka?.Player) ? (globalThis as any).shaka : _mod;

export class CinelarPlayerEngine {
  private player: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<PlayerEvent, EventCallback[]> = new Map();
  private _videoListeners: Array<[string, EventListener]> = [];
  private _bufferingState = false;

  private loadQueue: Promise<void> = Promise.resolve();
  private loadToken = 0;
  private playRetried = false;

  private profile: TvPlayerProfile | null = null;
  private stallTimestamps: number[] = [];
  private bwSaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private perfCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    pdbg('engine.constructor', 'video element received');
    this.initShaka();
  }

  // ─── Persistencia de Rendimiento (Técnica "Sticky Cap" de YouTube) ───
  private getStoredPerformance(): StoredPlayerPerformance | null {
    try {
      const raw = localStorage.getItem(PERF_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private saveStoredPerformance(data: Partial<StoredPlayerPerformance>) {
    try {
      const current = this.getStoredPerformance() || {};
      localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify({ ...current, ...data, updatedAt: Date.now() }));
    } catch { /* noop */ }
  }

  private async detectTvProfile(): Promise<TvPlayerProfile> {
    const stored = this.getStoredPerformance();

    const codecs = {
      h264: typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/mp4; codecs="avc1.640028"'),
      hevc: typeof MediaSource !== 'undefined' && (MediaSource.isTypeSupported('video/mp4; codecs="hvc1.2.4.L150.B0"') || MediaSource.isTypeSupported('video/mp4; codecs="hev1.1.6.L150.B0"')),
      vp9: typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/webm; codecs="vp09.00.10.08"'),
      av1: typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/mp4; codecs="av01.0.08M.08"'),
    };

    let decoderMaxHeight = 1080;
    let maxFps = 30;
    try {
      const mc = (navigator as any).mediaCapabilities;
      if (mc?.decodingInfo) {
        const res4k60 = await mc.decodingInfo({ type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 3840, height: 2160, bitrate: 20000000, framerate: 60 } });
        if (res4k60?.supported) { decoderMaxHeight = 2160; maxFps = 60; }
        else {
          const res4k30 = await mc.decodingInfo({ type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 3840, height: 2160, bitrate: 15000000, framerate: 30 } });
          if (res4k30?.supported) { decoderMaxHeight = 2160; maxFps = 30; }
          else {
            const res1080p60 = await mc.decodingInfo({ type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 8000000, framerate: 60 } });
            if (res1080p60?.supported) { decoderMaxHeight = 1080; maxFps = 60; }
          }
        }
      }
    } catch { /* noop */ }

    const screenH = Math.max(screen.height, screen.width);
    let displayMaxHeight = 720;
    if (screenH >= 2160) displayMaxHeight = 2160;
    else if (screenH >= 1440) displayMaxHeight = 1440;
    else if (screenH >= 1080) displayMaxHeight = 1080;

    const cores = navigator.hardwareConcurrency ?? 2;
    const memory = (navigator as any).deviceMemory ?? 2;
    const isLowEndDevice = cores <= 2 || memory <= 2 || decoderMaxHeight < 1080;

    const bandwidthEstimate = stored?.bandwidth && stored.bandwidth > 1_000_000
      ? stored.bandwidth
      : (isLowEndDevice ? 5_000_000 : 10_000_000);

    const prof: TvPlayerProfile = { displayMaxHeight, decoderMaxHeight, maxFps, codecs, bandwidthEstimate, isLowEndDevice };

    if (stored?.performanceCapHeight) {
      prof.performanceCap = { maxHeight: stored.performanceCapHeight, reason: stored.performanceCapReason || 'persisted_cap' };
    }

    return prof;
  }

  private getEffectiveMaxHeight(): number {
    if (!this.profile) return 1080;
    return Math.min(
      this.profile.displayMaxHeight,
      this.profile.decoderMaxHeight,
      this.profile.performanceCap?.maxHeight ?? 2160
    );
  }

  private applyPerformanceCap(newMaxHeight: number, reason: string) {
    if (!this.player || !this.profile) return;
    const currentCap = this.profile.performanceCap?.maxHeight ?? 2160;
    if (currentCap <= newMaxHeight) return;

    pdbg('engine.cap', `Rendimiento ajustado a ${newMaxHeight}p. Razón: ${reason}`);
    this.profile.performanceCap = { maxHeight: newMaxHeight, reason };
    this.saveStoredPerformance({ performanceCapHeight: newMaxHeight, performanceCapReason: reason, stabilityStreakMs: 0 });

    const effective = this.getEffectiveMaxHeight();
    try {
      this.player.configure({ abr: { restrictions: { maxHeight: effective } } });
    } catch { /* noop */ }
  }

  private checkDroppedFramesAndEvaluate() {
    const video = this.videoElement;
    if (!video || typeof video.getVideoPlaybackQuality !== 'function' || video.paused) return;

    try {
      const q = video.getVideoPlaybackQuality();
      if (q && q.totalVideoFrames > 300) {
        const dropRatio = q.droppedVideoFrames / q.totalVideoFrames;
        const effective = this.getEffectiveMaxHeight();

        // 1. Aplicar cap si hay muchos drops (>15%)
        if (dropRatio > 0.15 && effective > 720) {
          const nextCap = effective > 1080 ? 1080 : 720;
          this.applyPerformanceCap(nextCap, `high_frame_drops_${Math.round(dropRatio * 100)}%`);
        }
        // 2. Mecanismo de Recuperación (YouTube "Sticky" con prueba)
        else if (dropRatio < 0.02 && this.profile?.performanceCap) {
          const stored = this.getStoredPerformance() || {};
          const newStreak = (stored.stabilityStreakMs || 0) + 5000; // +5s por chequeo exitoso
          this.saveStoredPerformance({ stabilityStreakMs: newStreak });

          if (newStreak > 300000) { // 5 minutos de estabilidad
            const nextTestCap = this.profile.performanceCap.maxHeight >= 1080 ? 2160 : 1080;
            pdbg('engine.cap', `Probando resolución superior: ${nextTestCap}p tras estabilidad`);
            this.profile.performanceCap = { maxHeight: nextTestCap, reason: 'stability_recovery_test' };
            this.saveStoredPerformance({ performanceCapHeight: nextTestCap, performanceCapReason: 'stability_recovery_test', stabilityStreakMs: 0 });
            this.player.configure({ abr: { restrictions: { maxHeight: nextTestCap } } });
          }
        }
      }
    } catch { /* noop */ }
  }

  private updateBandwidthMemory() {
    if (!this.player) return;
    try {
      const stats = this.player.getStats();
      const bw = stats?.estimatedBandwidth;
      if (bw && bw > 500_000 && bw < 100_000_000) {
        this.saveStoredPerformance({ bandwidth: Math.round(bw) });
      }
    } catch { /* noop */ }
  }

  public getProfile(): TvPlayerProfile | null {
    return this.profile;
  }

  // ─── Inicialización de Shaka ───
  private initShaka() {
    if (!this.videoElement) return;
    if (!shaka || !shaka.Player) {
      pdbg('engine.initShaka', 'Shaka Player no se pudo cargar');
      return;
    }

    try {
      shaka.polyfill.installAll();
      this.player = new shaka.Player();

      this.detectTvProfile().then((prof) => {
        this.profile = prof;
        const maxH = this.getEffectiveMaxHeight();
        const isLowEnd = prof.isLowEndDevice;

        pdbg('engine.initShaka', 'TV profile initialized', { effectiveMaxHeight: maxH, isLowEndDevice: isLowEnd });

        this.player.configure({
          streaming: {
            bufferingGoal: isLowEnd ? 15 : 30,      // Menos búfer inicial en low-end para evitar OOM
            rebufferingGoal: 2,                     // Agresivo para reanudar rápido
            bufferBehind: isLowEnd ? 15 : 30,       // CRÍTICO: Libera memoria de segmentos ya vistos
            safeSeekOffset: 5,                      // Evita seeks a zonas no bufferizadas
            stallEnabled: true,
            stallThreshold: 1,
            segmentPrefetchLimit: isLowEnd ? 1 : 2,
            maxDisabledTime: 30,
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 8000 },
          },
          abr: {
            enabled: true,
            switchInterval: 15,
            bandwidthUpgradeTarget: 0.85,
            bandwidthDowngradeTarget: 0.85,
            defaultBandwidthEstimate: prof.bandwidthEstimate,
            restrictions: { maxHeight: maxH },
            minTimeToSwitch: 2, // Evita cambios de calidad si el búfer es bajo
          },
          preferredAudioLanguage: 'es',
          manifest: {
            retryParameters: { maxAttempts: 4, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 0 },
          },
        });

        this.player.addEventListener('error', (event: any) => {
          pdbg('engine.shaka-error', `code=${event?.detail?.code}`, event?.detail?.message);
          this.emit('error', event.detail);
        });

        this.player.addEventListener('trackschanged', () => this.emit('trackschanged'));
      });

      this.player.attach(this.videoElement).catch((e: any) => {
        pdbg('engine.attach', 'attach() FAILED', e);
        try { this.player?.detach(); } catch { /* ignore */ }
        this.player = null;
      });

      // Listeners de video nativo
      const emitBuffering = (val: boolean) => {
        if (this._bufferingState !== val) {
          this._bufferingState = val;
          this.emit('buffering', val);
        }
      };

      this._videoListeners = [
        ['play', () => this.emit('playing')],
        ['pause', () => { this.updateBandwidthMemory(); this.emit('paused'); }],
        ['waiting', () => { emitBuffering(true); this.stallTimestamps.push(performance.now()); this.stallTimestamps = this.stallTimestamps.filter((t) => performance.now() - t <= 60000); }],
        ['playing', () => emitBuffering(false)],
        ['canplay', () => emitBuffering(false)],
        ['canplaythrough', () => emitBuffering(false)],
        ['timeupdate', () => this.emit('timeupdate', this.videoElement?.currentTime)],
        ['durationchange', () => this.emit('durationchange', this.videoElement?.duration)],
        ['ended', () => { this.updateBandwidthMemory(); this.emit('ended'); }],
      ];

      for (const [event, handler] of this._videoListeners) {
        this.videoElement.addEventListener(event, handler);
      }

      // Chequeo periódico de rendimiento (cada 5s) y ancho de banda (cada 15s)
      this.perfCheckIntervalId = setInterval(() => this.checkDroppedFramesAndEvaluate(), 5000);
      this.bwSaveIntervalId = setInterval(() => this.updateBandwidthMemory(), 15000);

    } catch (e: any) {
      pdbg('engine.initShaka', 'new shaka.Player() FAILED', e);
      this.player = null;
    }
  }

  private isAdaptiveManifest(url: string): boolean {
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.m3u8') || clean.endsWith('.mpd');
  }

  // ─── Carga de Stream (Cola serializada) ───
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

    const resumeSec = (startTime && startTime > 0) ? startTime : undefined;

    if (this.player && this.isAdaptiveManifest(url)) {
      pdbg('engine.load', 'starting shaka load', { url, resumeSec });
      try {
        await this.player.load(url, resumeSec);
        pdbg('engine.load', 'shaka load OK');
        return;
      } catch (e: any) {
        pdbg('engine.load', 'shaka load FAILED', e);
        this.emit('error', e);
        return;
      }
    }

    // Fallback nativo (MP4 progresivo o si Shaka falló)
    if (this.player) {
      try { await this.player.detach(); } catch { /* ignore */ }
    }
    pdbg('engine.load', 'native fallback (video.src)', url);
    if (resumeSec && resumeSec > 0) {
      const seekOnce = () => {
        video.currentTime = resumeSec;
        video.removeEventListener('loadedmetadata', seekOnce);
      };
      video.addEventListener('loadedmetadata', seekOnce);
    }
    video.src = url;
    video.load();
  }

  // ─── Controles ───
  public play() {
    const video = this.videoElement;
    if (!video) return;
    pdbg('engine.play', 'calling video.play()');

    const doPlay = () => {
      const p = video.play();
      if (!p) return;
      p.then(() => { this.playRetried = false; })
        .catch((err: any) => {
          const name = err?.name ?? 'UnknownError';
          pdbg('engine.play', 'rejected', name, err?.message);
          if (!this.playRetried && (name === 'AbortError' || name === 'NotAllowedError')) {
            this.playRetried = true;
            const retry = () => {
              video.removeEventListener('loadedmetadata', retry);
              video.removeEventListener('canplay', retry);
              pdbg('engine.play', 'retrying after media-ready event');
              video.play().catch(() => { });
            };
            video.addEventListener('loadedmetadata', retry);
            video.addEventListener('canplay', retry);
          }
        });
    };
    doPlay();
  }

  public pause() { this.videoElement?.pause(); }
  public seek(time: number) {
    if (this.player && this.player.seek) {
      this.player.seek(time);
    } else if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  // ─── Gestión de Pistas y Calidad ───
  public getVariantTracksInfo() {
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

  public getAudioTracksInfo() {
    if (!this.player) return null;
    try {
      return this.player.getAudioTracks().map((t: any) => ({
        language: t.language || 'und',
        role: (t.roles && t.roles[0]) || '',
        label: t.label || t.language?.toUpperCase() || 'UND',
        active: !!t.active,
      }));
    } catch { return null; }
  }

  /**
   * OPTIMIZACIÓN CLAVE: Cambio de calidad manual seguro para TV
   */
  public selectQuality(option: number | 'auto') {
    if (!this.player || !this.videoElement) return;

    if (option === 'auto') {
      this.player.configure({ abr: { enabled: true } });
      return;
    }

    // 1. Guardar pista de audio activa para no perderla al cambiar de video
    const activeAudio = this.player.getAudioTracks().find((t: any) => t.active);

    // 2. Desactivar ABR para forzar la calidad
    this.player.configure({ abr: { enabled: false } });

    // 3. Buscar candidatos y ordenar por mayor bitrate (mejor calidad dentro de esa resolución)
    const candidates = this.player.getVariantTracks()
      .filter((v: any) => v.height === option)
      .sort((a: any, b: any) => (b.bandwidth || 0) - (a.bandwidth || 0));

    if (!candidates.length) return;

    // 4. Verificar búfer adelantado para evitar glitch visual (técnica de YouTube)
    const video = this.videoElement;
    const buffered = video.buffered;
    const currentTime = video.currentTime || 0;
    let hasSafeBuffer = false;

    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) - currentTime >= 2.0) {
        hasSafeBuffer = true;
        break;
      }
    }

    // 5. Cambiar pista. false = no limpiar búfer (cambio instantáneo y suave)
    this.player.selectVariantTrack(candidates[0], !hasSafeBuffer);

    // 6. Restaurar pista de audio
    if (activeAudio) {
      this.player.selectAudioTrack(activeAudio, false);
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
        if (this.videoElement?.paused) this.videoElement.play().catch(() => { });
      }
    } catch (e: any) {
      pdbg('engine.audio', 'error', e?.message);
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

  // ─── Limpieza y Eventos ───
  public destroy() {
    pdbg('engine.destroy');
    this.loadToken++; // invalidar cargas en cola
    this._bufferingState = false;

    if (this.bwSaveIntervalId) { clearInterval(this.bwSaveIntervalId); this.bwSaveIntervalId = null; }
    if (this.perfCheckIntervalId) { clearInterval(this.perfCheckIntervalId); this.perfCheckIntervalId = null; }

    this.updateBandwidthMemory();

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
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event)!.push(callback);
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