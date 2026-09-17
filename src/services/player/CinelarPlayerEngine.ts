import { pdbg } from './playerDebug';
import shaka from 'shaka-player'; // ✅ Importación estática limpia

type PlayerEvent =
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error'
  | 'timeupdate'
  | 'durationchange'
  | 'ended'
  | 'trackschanged'
  | 'avdesync'
  | 'driftsync'
  | 'livedrift'
  | 'recovery'
  | 'healthchange'
  | 'qualitychange';

type EventCallback = (data?: any) => void;

export type TvPlatform =
  | 'tizen'
  | 'webos'
  | 'vidaa'
  | 'androidtv'
  | 'firetv'
  | 'chromecast'
  | 'cobalt'
  | 'generic';

export interface TvPlayerProfile {
  platform: TvPlatform;
  displayMaxHeight: number;
  decoderMaxHeight: number;
  maxFps: number;
  codecs: { h264: boolean; hevc: boolean; vp9: boolean; av1: boolean };
  bandwidthEstimate: number;
  performanceCap?: { maxHeight: number; reason: string };
  isLowEndDevice: boolean;
  supportsPlaybackRateSlewing: boolean;
}

interface StoredPlayerPerformance {
  bandwidth?: number;
  performanceCapHeight?: number;
  performanceCapReason?: string;
  stabilityStreakMs?: number;
}

export interface SyncDiagnostics {
  platform: TvPlatform;
  isLowEnd: boolean;
  skewSeconds: number;
  effectiveRate: number;
  dropRatio: number;
  consecutiveWarnings: number;
  resyncCount: number;
}

export interface BufferHealthScore {
  overall: number;
  bufferSeconds: number;
  dropRate: number;
  effectiveRate: number;
  stallFrequency: number;
  recommendation: 'maintain' | 'downgrade' | 'upgrade';
  timestamp: number;
}

export interface PlaybackSessionSummary {
  totalStalls: number;
  totalResyncs: number;
  totalQualityChanges: number;
  avgDropRate: number;
  avgBufferHealth: number;
  peakQualityHeight: number;
  sessionDurationMs: number;
  recoveryAttempts: number;
  recoverySuccesses: number;
}

const PERF_STORAGE_KEY = 'cinelar_player_perf';

export class CinelarPlayerEngine {
  private player: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<PlayerEvent, EventCallback[]> = new Map();
  private _videoListeners: Array<[string, EventListener]> = [];
  private _bufferingState = false;
  private initialization: Promise<void> = Promise.resolve();
  private attachPromise: Promise<void> = Promise.resolve();

  private loadQueue: Promise<void> = Promise.resolve();
  private loadToken = 0;
  private playRetried = false;

  private profile: TvPlayerProfile | null = null;
  private stallRing: number[] = [];
  private stallRingIdx = 0;
  private stallRingSize = 16;
  private lastPlaybackQuality: { total: number; dropped: number } | null = null;
  private lastStallRecoveryAt = 0;
  private bwSaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private syncCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  // ─── A/V SYNC & DRIFT MONITOR (Técnicas de YouTube for TV) ───
  private lastMediaTime = 0;
  private lastWallClock = 0;
  private lastEffectiveRate = 1.0;
  private lastMeasuredSkew = 0;
  private lastDropRatio = 0;
  private consecutiveSkewWarnings = 0;
  private lastResyncAt = 0;
  private resyncCount = 0;
  private slewingActive = false;
  private slewingTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastProgressSync = 0;

  // ─── BUFFER HEALTH SCORE (YouTube TV: Health Score Multifactorial) ───
  private _lastBufferHealth: BufferHealthScore | null = null;
  private _stallTimestamps: number[] = [];
  private _qualityChangeCount = 0;
  private _peakQualityHeight = 0;
  private _sessionStartTime = 0;
  private _totalRecoveryAttempts = 0;
  private _totalRecoverySuccesses = 0;
  private _dropRateHistory: number[] = [];

  // ─── LIVE DRIFT MONITOR ───
  private _liveMode = false;
  private _liveDriftIntervalId: ReturnType<typeof setInterval> | null = null;
  private _liveCatchUpActive = false;

  // ─── MSE ERROR RECOVERY ───
  private _mseRecoveryAttempts = 0;
  private _maxMseRecoveryAttempts = 3;

  // ─── SOURCEBUFFER BACKPRESSURE ───
  private _backpressureActive = false;
  private _originalBufferingGoal = 20;

  // ─── DRIFT RECOVERY LEGACY (Para compatibilidad) ───
  private driftRecoveryMs: number | null = null;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    pdbg('engine.constructor', 'video element received');
    this.initShaka();
  }

  private _perfCache: StoredPlayerPerformance | null = null;
  private _perfCacheAt = 0;
  private static PERF_CACHE_TTL = 5000;

  private getStoredPerformance(): StoredPlayerPerformance | null {
    const now = performance.now();
    if (this._perfCache && (now - this._perfCacheAt) < CinelarPlayerEngine.PERF_CACHE_TTL) {
      return this._perfCache;
    }
    try {
      const raw = localStorage.getItem(PERF_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      this._perfCache = parsed;
      this._perfCacheAt = now;
      return parsed;
    } catch { return null; }
  }

  private saveStoredPerformance(data: Partial<StoredPlayerPerformance>) {
    try {
      const current = this.getStoredPerformance() || {};
      const merged = { ...current, ...data, updatedAt: Date.now() };
      localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(merged));
      this._perfCache = merged;
      this._perfCacheAt = performance.now();
    } catch { }
  }

  private detectTvPlatform(): TvPlatform {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    if (ua.includes('tizen') || (typeof window !== 'undefined' && ((window as any).tizen || (window as any).webapis))) return 'tizen';
    if (ua.includes('web0s') || ua.includes('webos') || (typeof window !== 'undefined' && (window as any).webOS)) return 'webos';
    if (ua.includes('vidaa') || ua.includes('hisense')) return 'vidaa';
    if (ua.includes('crkey') && !ua.includes('smartcast')) return 'chromecast';
    if (ua.includes('cobalt')) return 'cobalt';
    if (ua.includes('aft') || ua.includes('firetv')) return 'firetv';
    if (ua.includes('android') && (ua.includes('tv') || ua.includes('box') || ua.includes('large screen'))) return 'androidtv';
    return 'generic';
  }

  private async detectTvProfile(): Promise<TvPlayerProfile> {
    const platform = this.detectTvPlatform();
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
        if (res4k60?.supported) {
          decoderMaxHeight = 2160;
          maxFps = 60;
        } else {
          const res4k30 = await mc.decodingInfo({ type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 3840, height: 2160, bitrate: 15000000, framerate: 30 } });
          if (res4k30?.supported) {
            decoderMaxHeight = 2160;
            maxFps = 30;
          } else {
            const res1080p60 = await mc.decodingInfo({ type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 8000000, framerate: 60 } });
            if (res1080p60?.supported) {
              decoderMaxHeight = 1080;
              maxFps = 60;
            }
          }
        }
      }
    } catch { }

    const screenH = typeof screen !== 'undefined' ? Math.max(screen.height, screen.width) : 1080;
    let displayMaxHeight = 720;
    if (screenH >= 2160) displayMaxHeight = 2160;
    else if (screenH >= 1440) displayMaxHeight = 1440;
    else if (screenH >= 1080) displayMaxHeight = 1080;

    const cores = navigator.hardwareConcurrency ?? 2;
    const memory = (navigator as any).deviceMemory ?? 2;
    const isTvPlatform = platform !== 'generic';
    const isLowEndDevice = isTvPlatform || cores <= 2 || memory <= 2 || decoderMaxHeight < 1080;

    // En plataformas de TV con chips muy limitados (Tizen, webOS), el slewing de playbackRate provoca micro-saltos de audio
    const supportsPlaybackRateSlewing = !isTvPlatform || platform === 'androidtv' || platform === 'firetv';

    const bandwidthEstimate = stored?.bandwidth && stored.bandwidth > 1_000_000
      ? stored.bandwidth
      : (isLowEndDevice ? 5_000_000 : 10_000_000);

    const prof: TvPlayerProfile = {
      platform,
      displayMaxHeight,
      decoderMaxHeight,
      maxFps,
      codecs,
      bandwidthEstimate,
      isLowEndDevice,
      supportsPlaybackRateSlewing,
    };

    if (stored?.performanceCapHeight) {
      prof.performanceCap = { maxHeight: stored.performanceCapHeight, reason: stored.performanceCapReason || 'persisted_cap' };
    }
    return prof;
  }

  private getEffectiveMaxHeight(): number {
    if (!this.profile) return 1080;
    return Math.min(this.profile.displayMaxHeight, this.profile.decoderMaxHeight, this.profile.performanceCap?.maxHeight ?? 2160);
  }

  private applyPerformanceCap(newMaxHeight: number, reason: string) {
    if (!this.player || !this.profile) return;
    const currentCap = this.profile.performanceCap?.maxHeight ?? 2160;
    if (currentCap <= newMaxHeight) return;
    pdbg('engine.cap', `Rendimiento ajustado a ${newMaxHeight}p. Razón: ${reason}`);
    this.profile.performanceCap = { maxHeight: newMaxHeight, reason };
    this.saveStoredPerformance({ performanceCapHeight: newMaxHeight, performanceCapReason: reason, stabilityStreakMs: 0 });
    const effective = this.getEffectiveMaxHeight();
    try { this.player.configure({ abr: { restrictions: { maxHeight: effective } } }); } catch { }
  }

  private reduceQualityForInstability(reason: string) {
    const now = performance.now();
    if (now - this.lastStallRecoveryAt < 30_000) return;
    const effective = this.getEffectiveMaxHeight();
    if (effective <= 720) return;
    this.lastStallRecoveryAt = now;
    this.applyPerformanceCap(effective > 1080 ? 1080 : 720, reason);
  }

  private getBufferAhead(): number {
    const video = this.videoElement;
    if (!video) return 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
        return Math.max(0, video.buffered.end(i) - video.currentTime);
      }
    }
    return 0;
  }

  private noteStall() {
    const now = performance.now();
    if (this.stallRing.length < this.stallRingSize) {
      this.stallRing.push(now);
    } else {
      this.stallRing[this.stallRingIdx] = now;
    }
    this.stallRingIdx = (this.stallRingIdx + 1) % this.stallRingSize;
    this.noteStallForHealth();
    let recentCount = 0;
    for (let i = 0; i < this.stallRing.length; i++) {
      if (now - this.stallRing[i] <= 60_000) recentCount++;
    }
    pdbg('engine.health', 'stall', { recentStalls: recentCount, bufferAhead: this.getBufferAhead() });
    if (recentCount >= 3) this.reduceQualityForInstability('repeated_stalls');
  }

  // ═══════════════════════════════════════════════
  // DRIFT RECOVERY (Compatibilidad)
  // ═══════════════════════════════════════════════

  public setDriftRecoveryMs(ms: number) {
    this.driftRecoveryMs = ms;
    pdbg('engine.drift', `driftRecoveryMs set ${ms}ms`);
  }

  public handleAdBreakEnd() {
    if (this.driftRecoveryMs !== null && this.driftRecoveryMs > 0 && this.videoElement) {
      const safeRecoveryMs = Math.min(this.driftRecoveryMs, 100);
      const current = this.videoElement.currentTime;
      const target = Math.max(0, current - (safeRecoveryMs / 1000));

      if (Math.abs(current - target) > 0.05) {
        pdbg('engine.drift', `driftRecovery seek: ${current.toFixed(3)} -> ${target.toFixed(3)}`);
        this.seek(target);
      }
      this.driftRecoveryMs = null;
    }
  }

  // ═══════════════════════════════════════════════
  // MONITOR ACTIVO DE SINCRONIZACIÓN Y RENDIMIENTO (YouTube TV)
  // ═══════════════════════════════════════════════

  private checkAvSyncAndHealth() {
    const video = this.videoElement;
    if (!video || video.paused || !this.player || this._bufferingState) {
      this.lastWallClock = 0;
      this.lastMediaTime = 0;
      return;
    }

    const now = performance.now();
    const currentTime = video.currentTime;

    // 1. Clock drift check (Medición de effectiveRate inspirada en YouTube for TV)
    if (this.lastWallClock > 0 && this.lastMediaTime > 0) {
      const wallDelta = (now - this.lastWallClock) / 1000;
      const mediaDelta = currentTime - this.lastMediaTime;
      if (wallDelta >= 1.5 && wallDelta <= 5.0 && video.playbackRate === 1.0) {
        const effectiveRate = mediaDelta / wallDelta;
        this.lastEffectiveRate = effectiveRate;
        // Si el avance del video es notablemente menor al reloj de pared
        if (effectiveRate < 0.85 && mediaDelta > 0.05) {
          pdbg('engine.sync', `Effective playback rate bajo: ${effectiveRate.toFixed(3)} (mediaDelta=${mediaDelta.toFixed(3)}s, wallDelta=${wallDelta.toFixed(3)}s)`);
        }
      }
    }
    this.lastMediaTime = currentTime;
    this.lastWallClock = now;

    // 2. Buffer Skew Check vía Shaka getBufferedInfo()
    try {
      const bufInfo = this.player.getBufferedInfo?.();
      if (bufInfo && Array.isArray(bufInfo.audio) && Array.isArray(bufInfo.video) && bufInfo.audio.length > 0 && bufInfo.video.length > 0) {
        const audioRange = bufInfo.audio.find((r: any) => r.start <= currentTime + 0.5 && r.end >= currentTime - 0.1);
        const videoRange = bufInfo.video.find((r: any) => r.start <= currentTime + 0.5 && r.end >= currentTime - 0.1);

        if (audioRange && videoRange) {
          const audioAhead = Math.max(0, audioRange.end - currentTime);
          const videoAhead = Math.max(0, videoRange.end - currentTime);
          const skew = audioAhead - videoAhead; // Positivo: audio adelantado con más buffer, video rezagado
          this.lastMeasuredSkew = skew;

          if (Math.abs(skew) > 0.35) {
            this.consecutiveSkewWarnings++;
            pdbg('engine.sync', `Buffer skew detectado: ${skew.toFixed(3)}s (audioAhead=${audioAhead.toFixed(2)}s, videoAhead=${videoAhead.toFixed(2)}s, warnCount=${this.consecutiveSkewWarnings})`);
            this.emit('avdesync', { skew, audioAhead, videoAhead });

            if (this.consecutiveSkewWarnings >= 2) {
              this.recoverFromDesync(skew, 'buffer_skew');
            }
          } else {
            this.consecutiveSkewWarnings = Math.max(0, this.consecutiveSkewWarnings - 1);
          }
        }
      }
    } catch { }

    // 3. Chequeo de cuadros caídos
    this.checkDroppedFramesAndEvaluate();

    // 4. Buffer Health Score (cada chequeo)
    const health = this.calculateBufferHealthScore();
    if (health.recommendation === 'downgrade') {
      this.reduceQualityForInstability(`health_score_${health.overall}`);
    }
    this.emit('healthchange', health);

    // 5. Backpressure evaluation
    this.evaluateBackpressure();
  }

  private recoverFromDesync(skew: number, reason: string) {
    const now = performance.now();
    // Enfriamiento de 8 segundos entre resincronizaciones para evitar bucles
    if (now - this.lastResyncAt < 8000) return;
    const video = this.videoElement;
    if (!video || !this.player || video.paused) return;

    this.lastResyncAt = now;
    this.consecutiveSkewWarnings = 0;
    this.resyncCount++;
    pdbg('engine.sync', `Ejecutando auto-recuperación A/V (razón: ${reason}, skew: ${skew.toFixed(3)}s, total: ${this.resyncCount})`);

    // TIER 1: Micro-playbackRate Nudge (si la TV lo admite y el drift es suave: 50ms - 250ms)
    if (this.profile?.supportsPlaybackRateSlewing && Math.abs(skew) <= 0.25 && Math.abs(skew) >= 0.05 && !this.slewingActive) {
      this.slewingActive = true;
      const targetRate = skew > 0 ? 1.04 : 0.96;
      video.playbackRate = targetRate;
      pdbg('engine.sync', `Micro-slewing playbackRate a ${targetRate}`);

      if (this.slewingTimeout) clearTimeout(this.slewingTimeout);
      this.slewingTimeout = setTimeout(() => {
        if (this.videoElement) {
          this.videoElement.playbackRate = 1.0;
        }
        this.slewingActive = false;
        pdbg('engine.sync', 'Micro-slewing completado -> playbackRate 1.0');
      }, 400);

      this.emit('driftsync', { type: 'micro_slew', rate: targetRate, skew });
      return;
    }

    // TIER 2: Keyframe Micro-Seek Resync
    // Un seek al punto actual purga el decodificador de hardware y bloquea el PTS/DTS al keyframe más cercano
    try {
      const cur = video.currentTime;
      let target = cur;
      const seekRange = this.player.seekRange?.();
      if (seekRange && Number.isFinite(seekRange.start) && Number.isFinite(seekRange.end)) {
        target = Math.max(seekRange.start, Math.min(seekRange.end - 0.5, cur));
      }
      video.currentTime = target;
      pdbg('engine.sync', `Micro-seek resync ejecutado en ${target.toFixed(3)}s`);
      this.emit('driftsync', { type: 'micro_seek', time: target, skew });
    } catch (err: any) {
      pdbg('engine.sync', 'Micro-seek resync falló', err?.message);
    }
  }

  private checkDroppedFramesAndEvaluate() {
    const video = this.videoElement;
    if (!video || typeof video.getVideoPlaybackQuality !== 'function' || video.paused) return;
    try {
      const q = video.getVideoPlaybackQuality();
      if (q) {
        const previous = this.lastPlaybackQuality;
        this.lastPlaybackQuality = { total: q.totalVideoFrames, dropped: q.droppedVideoFrames };
        if (!previous) return;
        const renderedSinceLastCheck = q.totalVideoFrames - previous.total;
        const droppedSinceLastCheck = q.droppedVideoFrames - previous.dropped;
        if (renderedSinceLastCheck <= 0 || droppedSinceLastCheck < 0) return;
        const dropRatio = droppedSinceLastCheck / renderedSinceLastCheck;
        this.lastDropRatio = dropRatio;

        // Track drop rate history for session avg
        this._dropRateHistory.push(dropRatio);
        if (this._dropRateHistory.length > 60) this._dropRateHistory.shift();

        const effective = this.getEffectiveMaxHeight();

        // ── Compositor vs Decoder Drop Classification ──
        // corruptedVideoFrames: frames corrupted by the decoder (hardware issues)
        // droppedVideoFrames: frames dropped by the compositor/browser (rendering overload)
        const corrupted = (q as any).corruptedVideoFrames ?? 0;
        const previousCorrupted = (this._lastCorruptedFrames ?? 0);
        this._lastCorruptedFrames = corrupted;
        const corruptedDelta = corrupted - previousCorrupted;

        if (renderedSinceLastCheck >= 60 && dropRatio > 0.15 && effective > 720) {
          // Classic drop threshold exceeded
          this.reduceQualityForInstability(`frame_drops_${Math.round(dropRatio * 100)}%`);
        } else if (corruptedDelta > 5 && corruptedDelta > droppedSinceLastCheck) {
          // Decoder-level corruption — hardware can't keep up with codec/resolution
          pdbg('engine.health', 'Decoder corruption detected', { corrupted: corruptedDelta, dropped: droppedSinceLastCheck });
          this.reduceQualityForInstability(`decoder_corruption_${corruptedDelta}`);
        } else if (droppedSinceLastCheck > 10 && corruptedDelta === 0) {
          // Drops without corruption = compositor/GPU overload (UI too heavy)
          pdbg('engine.health', 'Compositor overload suspected', { dropped: droppedSinceLastCheck, corrupted: 0 });
          this.emit('healthchange', { ...this._lastBufferHealth, compositorOverload: true });
        }

        // Stability streak for quality upgrade testing
        if (dropRatio < 0.02 && this.profile?.performanceCap) {
          const stored = this.getStoredPerformance() || {};
          const newStreak = (stored.stabilityStreakMs || 0) + 5000;
          this.saveStoredPerformance({ stabilityStreakMs: newStreak });
          if (newStreak > 300000) {
            const nextTestCap = this.profile.performanceCap.maxHeight >= 1080 ? 2160 : 1080;
            pdbg('engine.cap', `Probando resolución superior: ${nextTestCap}p tras estabilidad`);
            this.noteQualityChange(this.profile.performanceCap.maxHeight, nextTestCap);
            this.profile.performanceCap = { maxHeight: nextTestCap, reason: 'stability_recovery_test' };
            this.saveStoredPerformance({ performanceCapHeight: nextTestCap, performanceCapReason: 'stability_recovery_test', stabilityStreakMs: 0 });
            this.player?.configure({ abr: { restrictions: { maxHeight: nextTestCap } } });
          }
        }
      }
    } catch { }
  }

  private _lastCorruptedFrames: number | null = null;

  private updateBandwidthMemory() {
    if (!this.player) return;
    try {
      const stats = this.player.getStats();
      const bw = stats?.estimatedBandwidth;
      if (bw && bw > 500_000 && bw < 100_000_000) this.saveStoredPerformance({ bandwidth: Math.round(bw) });
    } catch { }
  }

  // ═══════════════════════════════════════════════
  // BUFFER HEALTH SCORE (YouTube TV: Health Score Multifactorial)
  // ═══════════════════════════════════════════════

  private calculateBufferHealthScore(): BufferHealthScore {
    const bufferAhead = this.getBufferAhead();
    const dropRate = this.lastDropRatio;
    const effectiveRate = this.lastEffectiveRate;

    // Stall frequency: stalls per minute
    const now = performance.now();
    this._stallTimestamps = this._stallTimestamps.filter(t => now - t < 60_000);
    const stallFrequency = this._stallTimestamps.length;

    // ── Sub-scores (0-100) ──

    // Buffer score: 0s = 0, 20s+ = 100
    const bufferScore = Math.min(100, (bufferAhead / 20) * 100);

    // Drop rate score: 0% = 100, 10%+ = 0
    const dropScore = Math.max(0, 100 - (dropRate * 1000));

    // Effective rate score: 1.0 = 100, <0.85 or >1.15 = 0
    const rateDeviation = Math.abs(effectiveRate - 1.0);
    const rateScore = Math.max(0, 100 - (rateDeviation * 667));

    // Stall frequency score: 0/min = 100, 5+/min = 0
    const stallScore = Math.max(0, 100 - (stallFrequency * 20));

    // Weighted composite
    const overall = Math.round(
      bufferScore * 0.40 +
      dropScore * 0.30 +
      rateScore * 0.20 +
      stallScore * 0.10
    );

    // Recommendation
    let recommendation: BufferHealthScore['recommendation'] = 'maintain';
    if (overall < 30) recommendation = 'downgrade';
    else if (overall > 80 && this.profile?.performanceCap) recommendation = 'upgrade';

    const score: BufferHealthScore = {
      overall,
      bufferSeconds: Number(bufferAhead.toFixed(2)),
      dropRate: Number(dropRate.toFixed(4)),
      effectiveRate: Number(effectiveRate.toFixed(3)),
      stallFrequency,
      recommendation,
      timestamp: now,
    };

    this._lastBufferHealth = score;
    return score;
  }

  private noteStallForHealth() {
    this._stallTimestamps.push(performance.now());
  }

  private noteQualityChange(fromHeight: number, toHeight: number) {
    this._qualityChangeCount++;
    if (toHeight > this._peakQualityHeight) this._peakQualityHeight = toHeight;
  }

  public getBufferHealthScore(): BufferHealthScore | null {
    return this._lastBufferHealth;
  }

  public getSessionSummary(): PlaybackSessionSummary {
    const dropRates = this._dropRateHistory;
    const avgDropRate = dropRates.length > 0
      ? dropRates.reduce((a, b) => a + b, 0) / dropRates.length
      : 0;
    const avgBufferHealth = this._lastBufferHealth?.overall ?? 50;

    return {
      totalStalls: this._stallTimestamps.length,
      totalResyncs: this.resyncCount,
      totalQualityChanges: this._qualityChangeCount,
      avgDropRate: Number(avgDropRate.toFixed(4)),
      avgBufferHealth: Math.round(avgBufferHealth),
      peakQualityHeight: this._peakQualityHeight,
      sessionDurationMs: this._sessionStartTime > 0 ? performance.now() - this._sessionStartTime : 0,
      recoveryAttempts: this._totalRecoveryAttempts,
      recoverySuccesses: this._totalRecoverySuccesses,
    };
  }

  // ═══════════════════════════════════════════════
  // LIVE DRIFT CATCH-UP (YouTube TV: Live Drift Correction)
  // ═══════════════════════════════════════════════

  public setLiveMode(enabled: boolean) {
    if (this._liveMode === enabled) return;
    this._liveMode = enabled;
    pdbg('engine.live', `liveMode ${enabled ? 'ENABLED' : 'DISABLED'}`);

    if (enabled) {
      this._sessionStartTime = performance.now();
      this.startLiveDriftMonitor();
    } else {
      this.stopLiveDriftMonitor();
      this.resetLiveCatchUp();
    }
  }

  private startLiveDriftMonitor() {
    this.stopLiveDriftMonitor();
    this._liveDriftIntervalId = setInterval(() => this.checkLiveDrift(), 3000);
  }

  private stopLiveDriftMonitor() {
    if (this._liveDriftIntervalId) {
      clearInterval(this._liveDriftIntervalId);
      this._liveDriftIntervalId = null;
    }
  }

  private checkLiveDrift() {
    const video = this.videoElement;
    if (!video || !this.player || video.paused || this._bufferingState) return;

    try {
      const seekRange = this.player.seekRange?.();
      if (!seekRange || !Number.isFinite(seekRange.start) || !Number.isFinite(seekRange.end)) return;

      const liveEdge = seekRange.end;
      const currentTime = video.currentTime;
      const drift = liveEdge - currentTime;

      // Live Drift thresholds (YouTube TV: vcu module)
      const CATCH_UP_THRESHOLD = 3.0;   // Start catch-up if > 3s behind
      const CATCH_UP_TARGET = 1.0;      // Target: within 1s of live edge
      const CATCH_UP_RATE = 1.05;        // Playback rate during catch-up

      if (drift > CATCH_UP_THRESHOLD && !this._liveCatchUpActive) {
        // Start catch-up
        this._liveCatchUpActive = true;
        if (this.profile?.supportsPlaybackRateSlewing) {
          video.playbackRate = CATCH_UP_RATE;
          pdbg('engine.live', `Catch-up started: drift=${drift.toFixed(2)}s, rate=${CATCH_UP_RATE}`);
        }
        this.emit('livedrift', { drift, action: 'catchup_start', rate: CATCH_UP_RATE });
      } else if (this._liveCatchUpActive && drift <= CATCH_UP_TARGET) {
        this.resetLiveCatchUp();
        pdbg('engine.live', `Catch-up completed: drift=${drift.toFixed(2)}s`);
        this.emit('livedrift', { drift, action: 'catchup_complete' });
      } else if (this._liveCatchUpActive && drift > CATCH_UP_THRESHOLD + 5) {
        // Drift grew too large (network issue), fall back to seek
        this.resetLiveCatchUp();
        this.seek(liveEdge - 2);
        pdbg('engine.live', `Emergency seek: drift=${drift.toFixed(2)}s`);
        this.emit('livedrift', { drift, action: 'emergency_seek' });
      }
    } catch { }
  }

  private resetLiveCatchUp() {
    if (this._liveCatchUpActive && this.videoElement) {
      this.videoElement.playbackRate = 1.0;
    }
    this._liveCatchUpActive = false;
  }

  public getLiveDriftInfo(): { drift: number; isCatchingUp: boolean } | null {
    if (!this._liveMode || !this.player) return null;
    try {
      const seekRange = this.player.seekRange?.();
      if (!seekRange || !Number.isFinite(seekRange.end) || !this.videoElement) return null;
      return {
        drift: Number((seekRange.end - this.videoElement.currentTime).toFixed(2)),
        isCatchingUp: this._liveCatchUpActive,
      };
    } catch { return null; }
  }

  // ═══════════════════════════════════════════════
  // MSE ERROR SURGICAL RECOVERY (YouTube TV: Rollback without Restart)
  // ═══════════════════════════════════════════════

  private attemptMseRecovery(error: any): boolean {
    if (this._mseRecoveryAttempts >= this._maxMseRecoveryAttempts) {
      pdbg('engine.recovery', `Max MSE recovery attempts reached (${this._maxMseRecoveryAttempts})`);
      return false;
    }

    const severity = error?.severity ?? 2;
    const code = error?.code ?? 0;
    const category = error?.category ?? 0;

    // Only attempt recovery for RECOVERABLE errors
    if (severity !== 1) return false;

    this._mseRecoveryAttempts++;
    this._totalRecoveryAttempts++;
    pdbg('engine.recovery', `MSE recovery attempt ${this._mseRecoveryAttempts}/${this._maxMseRecoveryAttempts}`, { code, category });

    try {
      const video = this.videoElement;
      if (!video || !this.player) return false;

      // Strategy 1: For MEDIA errors, try removing the faulty buffer range
      if (category === 3) { // MEDIA category
        const currentTime = video.currentTime;
        // Remove a small window around current time and let Shaka refill
        try {
          // Use Shaka's internal MSE engine to remove buffer
          const buffered = video.buffered;
          for (let i = buffered.length - 1; i >= 0; i--) {
            if (buffered.start(i) >= currentTime - 0.5 && buffered.start(i) <= currentTime + 5) {
              // Found a range near the error point - let Shaka handle recovery
              this.player.retryStreaming();
              this._totalRecoverySuccesses++;
              pdbg('engine.recovery', 'Shaka retryStreaming after media error');
              return true;
            }
          }
        } catch { }
      }

      // Strategy 2: For NETWORK errors, just retry
      if (category === 1) { // NETWORK category
        this.player.retryStreaming();
        this._totalRecoverySuccesses++;
        pdbg('engine.recovery', 'Shaka retryStreaming after network error');
        return true;
      }

      // Strategy 3: For STREAMING errors with recoverable severity, try disabling/re-enabling variant
      if (category === 5) { // STREAMING category
        const currentTime = video.currentTime;
        this.player.retryStreaming();
        // Small seek to force rebuffer from a clean point
        video.currentTime = Math.max(0, currentTime - 0.1);
        this._totalRecoverySuccesses++;
        pdbg('engine.recovery', 'Shaka retryStreaming + micro-seek after streaming error');
        return true;
      }

    } catch (e: any) {
      pdbg('engine.recovery', 'MSE recovery attempt failed', e?.message);
    }

    return false;
  }

  // ═══════════════════════════════════════════════
  // SOURCEBUFFER BACKPRESSURE (YouTube TV: NeedMoreInputBackpressure)
  // ═══════════════════════════════════════════════

  private evaluateBackpressure() {
    const video = this.videoElement;
    if (!video || !this.profile) return;

    const health = this._lastBufferHealth;
    if (!health) return;

    // Activate backpressure if health is poor and we have a lot of buffer
    if (health.overall < 30 && health.bufferSeconds > 10 && !this._backpressureActive) {
      this._backpressureActive = true;
      // Reduce buffering goal to prevent decoder overload
      const reducedGoal = Math.max(5, Math.floor(this._originalBufferingGoal * 0.5));
      try {
        this.player?.configure({ streaming: { bufferingGoal: reducedGoal } });
        pdbg('engine.backpressure', `Activated: reduced bufferingGoal to ${reducedGoal}s (health=${health.overall})`);
      } catch { }
    } else if (this._backpressureActive && health.overall >= 60) {
      this._backpressureActive = false;
      try {
        this.player?.configure({ streaming: { bufferingGoal: this._originalBufferingGoal } });
        pdbg('engine.backpressure', `Deactivated: restored bufferingGoal to ${this._originalBufferingGoal}s`);
      } catch { }
    }
  }

  private initBackpressure() {
    if (!this.player) return;
    try {
      const cfg = this.player.getConfiguration();
      this._originalBufferingGoal = cfg?.streaming?.bufferingGoal ?? 20;
    } catch { }
  }

  public getProfile(): TvPlayerProfile | null { return this.profile; }

  public getSyncDiagnostics(): SyncDiagnostics {
    return {
      platform: this.profile?.platform ?? 'generic',
      isLowEnd: this.profile?.isLowEndDevice ?? false,
      skewSeconds: Number(this.lastMeasuredSkew.toFixed(3)),
      effectiveRate: Number(this.lastEffectiveRate.toFixed(2)),
      dropRatio: Number(this.lastDropRatio.toFixed(3)),
      consecutiveWarnings: this.consecutiveSkewWarnings,
      resyncCount: this.resyncCount,
    };
  }

  private initShaka() {
    if (!this.videoElement) return;

    try {
      shaka.polyfill.installAll();
      this.player = new shaka.Player();

      this.initialization = this.detectTvProfile().then((prof) => {
        if (!this.player) return;
        this.profile = prof;
        const maxH = this.getEffectiveMaxHeight();
        const isLowEnd = prof.isLowEndDevice;
        pdbg('engine.initShaka', 'TV profile initialized', {
          platform: prof.platform,
          effectiveMaxHeight: maxH,
          isLowEndDevice: isLowEnd,
        });

        // ✅ CONFIGURACIÓN ÓPTIMA PARA TV (Técnicas de YouTube for TV + Shaka TV Profiles)
        this.player.configure({
          streaming: {
            // Buffer adaptativo para TV: evita sobrecargar la memoria MSE (30-50MB en Smart TVs)
            bufferingGoal: isLowEnd ? 12 : 15,
            rebufferingGoal: 2,
            bufferBehind: isLowEnd ? 10 : 10,
            evictionGoal: 1,
            safeSeekOffset: 2,
            safeSeekEndOffset: 0.5,
            stallEnabled: true,
            stallThreshold: 3.0,
            // 🛡️ CRUCIAL: stallSkip = 0 elimina micro-saltos de 100ms que rompen los GOPs en decodificadores de TV
            stallSkip: 0,
            // 🛡️ CRUCIAL: Corrige dinámicamente la deriva de timestamps PTS/DTS entre audio y video
            shouldFixTimestampOffset: true,
            gapPadding: 2,
            gapDetectionThreshold: 0.5,
            gapJumpTimerTime: 0.25,
            durationBackoff: 1,
            segmentPrefetchLimit: 1,
            avoidEvictionOnQuotaExceededError: true,
            clearDecodingCache: true,
            clampAppendWindowToDuration: true,
            allowMediaSourceRecoveries: true,
            minTimeBetweenRecoveries: 5,
            maxDisabledTime: 30,
            inaccurateManifestTolerance: 2,
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 8000 },
          },
          abr: {
            enabled: true,
            switchInterval: 8,
            bandwidthUpgradeTarget: 0.85,
            bandwidthDowngradeTarget: 0.65,
            defaultBandwidthEstimate: prof.bandwidthEstimate,
            restrictions: { maxHeight: maxH, maxFrameRate: prof.maxFps },
            minTimeToSwitch: 5,
            advanced: {
              droppedFramesThreshold: 0.18,
              droppedFramesInterval: 3,
              droppedFramesBanDuration: 45,
            },
          },
          preferredAudioLanguage: 'es',
          preferredAudio: [{ language: 'es' }],
          manifest: {
            retryParameters: { maxAttempts: 4, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 0 },
            dash: {
              autoCorrectDrift: true,
              ignoreMinBufferTime: false,
            },
            hls: {
              ignoreManifestProgramDateTime: false,
              sequenceMode: false,
            },
          },
          mediaSource: {
            forceTransmux: false,
            insertFakeEncryptionInInit: true,
            repairIFrames: true,
            durationReductionEmitsUpdateEnd: true,
          },
        });

        this.player.addEventListener('error', (event: any) => {
          const error = event?.detail;
          pdbg('engine.shaka-error', `code=${error?.code}`, error?.message);

          // Attempt surgical MSE recovery for recoverable errors
          if (error && error.severity === 1) {
            const recovered = this.attemptMseRecovery(error);
            if (recovered) {
              this.emit('recovery', { type: 'mse_surgical', success: true, code: error.code });
              return; // Don't propagate to user — recovery succeeded
            }
          }

          this.emit('error', error);
        });
        this.player.addEventListener('trackschanged', () => this.emit('trackschanged'));

        // Initialize backpressure monitoring
        this.initBackpressure();
      }).catch((error: any) => {
        pdbg('engine.initShaka', 'profile setup FAILED', error?.message);
      });

      this.attachPromise = this.player.attach(this.videoElement).catch((e: any) => {
        pdbg('engine.attach', 'attach() FAILED', e);
        try { this.player?.detach(); } catch { }
        this.player = null;
      });

      const emitBuffering = (val: boolean) => {
        if (this._bufferingState !== val) {
          this._bufferingState = val;
          this.emit('buffering', val);
        }
      };

      this._videoListeners = [
        ['play', () => { this.emit('playing'); }],
        ['pause', () => { this.updateBandwidthMemory(); this.emit('paused'); }],
        ['waiting', () => { emitBuffering(true); this.noteStall(); }],
        ['stalled', () => { emitBuffering(true); this.noteStall(); }],
        ['playing', () => emitBuffering(false)],
        ['canplay', () => emitBuffering(false)],
        ['canplaythrough', () => emitBuffering(false)],
        ['timeupdate', () => {
          const now = performance.now();
          if (now - this.lastProgressSync > 250) {
            this.lastProgressSync = now;
            this.emit('timeupdate', this.videoElement?.currentTime);
          }
        }],
        ['durationchange', () => this.emit('durationchange', this.videoElement?.duration)],
        ['ended', () => { this.updateBandwidthMemory(); this.emit('ended'); }],
      ];

      for (const [event, handler] of this._videoListeners) {
        this.videoElement.addEventListener(event, handler);
      }

      // Chequeo periódico de sincronización A/V y rendimiento cada 2.5 segundos
      this.syncCheckIntervalId = setInterval(() => this.checkAvSyncAndHealth(), 2500);
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

  public load(url: string, startTime?: number, preferredAudioLang?: string): Promise<void> {
    const token = ++this.loadToken;
    pdbg('engine.load', 'queued', { url, startTime, token, preferredAudioLang });
    const run = this.loadQueue.then(async () => {
      if (token !== this.loadToken) {
        pdbg('engine.load', 'skipped (superseded)', token);
        return;
      }
      await this.doLoad(url, startTime, preferredAudioLang);
    });
    this.loadQueue = run.catch(() => { });
    return run;
  }

  private async doLoad(url: string, startTime?: number, preferredAudioLang?: string): Promise<void> {
    const video = this.videoElement;
    if (!video) return;
    await this.initialization;
    await this.attachPromise;
    const resumeSec = (startTime && startTime > 0) ? startTime : undefined;

    if (this.player && this.isAdaptiveManifest(url)) {
      // 🛡️ SINCRONIZACIÓN DE AUDIO TEMPRANA: Configurar el idioma preferido ANTES de parsear el manifiesto
      if (preferredAudioLang) {
        try {
          const lang = preferredAudioLang.toLowerCase().split('-')[0];
          this.player.configure({
            preferredAudioLanguage: lang,
            preferredAudio: [{ language: lang }],
          });
          pdbg('engine.load', `Pre-configured preferred audio language: ${lang}`);
        } catch { }
      }

      pdbg('engine.load', 'starting shaka load', { url, resumeSec, preferredAudioLang });
      try {
        await this.player.load(url, resumeSec);
        pdbg('engine.load', 'shaka load OK');
        return;
      } catch (e: any) {
        pdbg('engine.load', 'shaka load FAILED', e);
        this.emit('error', e);
        throw e;
      }
    }
    if (this.player) { try { await this.player.detach(); } catch { } }
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
    if (!this.videoElement) return;
    let target = time;
    if (this.player) {
      try {
        const seekRange = this.player.seekRange?.();
        if (seekRange && Number.isFinite(seekRange.start) && Number.isFinite(seekRange.end)) {
          target = Math.max(seekRange.start, Math.min(seekRange.end - 0.5, time));
        }
      } catch { }
    }
    this.videoElement.currentTime = target;
  }

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

  public selectQuality(option: number | 'auto') {
    if (!this.player || !this.videoElement) return;
    if (option === 'auto') {
      this.player.configure({ abr: { enabled: true } });
      return;
    }
    const activeAudio = this.player.getAudioTracks().find((t: any) => t.active);
    this.player.configure({ abr: { enabled: false } });
    const candidates = this.player.getVariantTracks().filter((v: any) => v.height === option).sort((a: any, b: any) => (b.bandwidth || 0) - (a.bandwidth || 0));
    if (!candidates.length) return;

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

    // 🛡️ SINCRONIZACIÓN DE AUDIO: Elegir variante que coincida con el idioma de audio activo
    const matchingLang = activeAudio ? candidates.find((v: any) => v.language === activeAudio.language) : null;
    const targetVariant = matchingLang || candidates[0];

    // Seleccionar variante limpiamente UNA SOLA VEZ sin segunda llamada destructiva a selectAudioTrack
    this.player.selectVariantTrack(targetVariant, !hasSafeBuffer);
  }

  public selectAudioTrack(language: string, role?: string, index?: number) {
    if (!this.player) return;
    try {
      const tracks = this.player.getAudioTracks();
      let target: any = null;
      if (typeof index === 'number' && index >= 0 && index < tracks.length) target = tracks[index];
      else target = tracks.find((t: any) => { const langMatch = t.language === language; if (role) return langMatch && (t.roles || []).includes(role); return langMatch; });
      if (target) {
        // En Shaka, el segundo argumento de selectAudioTrack es safeMargin (número de segundos), no boolean
        this.player.selectAudioTrack(target, 2);
        if (this.videoElement?.paused) this.videoElement.play().catch(() => { });
      }
    } catch (e: any) { pdbg('engine.audio', 'error', e?.message); }
  }

  public applyPreferredAudioLanguage(preferred?: string) {
    if (!this.player || !preferred) return;
    const tracks = this.getAudioTracksInfo();
    if (!tracks || tracks.length <= 1) return;
    const lang = preferred.toLowerCase().split('-')[0];
    const match = tracks.find((t: any) => t.language.toLowerCase().startsWith(lang));
    if (match && !match.active) this.selectAudioTrack(match.language, match.role || undefined);
  }

  public destroy() {
    pdbg('engine.destroy');
    this.loadToken++;
    this._bufferingState = false;
    this.lastPlaybackQuality = null;
    if (this.slewingTimeout) { clearTimeout(this.slewingTimeout); this.slewingTimeout = null; }
    if (this.bwSaveIntervalId) { clearInterval(this.bwSaveIntervalId); this.bwSaveIntervalId = null; }
    if (this.syncCheckIntervalId) { clearInterval(this.syncCheckIntervalId); this.syncCheckIntervalId = null; }
    this.stopLiveDriftMonitor();
    this.resetLiveCatchUp();
    this.updateBandwidthMemory();
    if (this.videoElement) {
      for (const [event, handler] of this._videoListeners) this.videoElement.removeEventListener(event, handler);
      this._videoListeners = [];
    }
    if (this.player) { this.player.destroy(); this.player = null; }
    this.eventListeners.clear();
  }

  public on(event: PlayerEvent, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event)!.push(callback);
    return () => {
      const list = this.eventListeners.get(event);
      if (list) { const idx = list.indexOf(callback); if (idx >= 0) list.splice(idx, 1); }
    };
  }

  private emit(event: PlayerEvent, data?: any) {
    this.eventListeners.get(event)?.forEach((cb) => cb(data));
  }
}