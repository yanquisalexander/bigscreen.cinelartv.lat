import shaka from 'shaka-player/dist/shaka-player.compiled.js';

type PlayerEvent = 'playing' | 'paused' | 'buffering' | 'error' | 'timeupdate' | 'durationchange' | 'ended';
type EventCallback = (data?: any) => void;

export class CinelarPlayerEngine {
  private player: shaka.Player | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<PlayerEvent, EventCallback[]> = new Map();

  private attachPromise: Promise<void> | null = null;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    this.initShaka();
  }

  private initShaka() {
    if (!this.videoElement) return;

    // Instalar polyfills necesarios
    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      console.error('Shaka Player no es compatible con este navegador.');
      return;
    }

    // Crear el Player sin mediaElement y adjuntarlo con attach()
    // (inicializarlo con mediaElement está deprecado en Shaka moderno).
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
      console.error('Error de Shaka:', event.detail);
      this.emit('error', event.detail);
    });

    // Mapeo de eventos
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

    // Shaka Player solo maneja manifiestos adaptativos (HLS/DASH).
    // Para MP4 progresivo u otros formatos, usar reproducción nativa.
    if (this.player && this.isAdaptiveManifest(url)) {
      try {
        // Asegurar que attach() terminó antes de cargar.
        if (this.attachPromise) await this.attachPromise;
        // Pasar startTime a Shaka es la forma correcta de reanudar:
        // setear video.currentTime tras load() es sobrescrito por Shaka.
        await this.player.load(url, startTime && startTime > 0 ? startTime : undefined);
        return;
      } catch (e) {
        console.error('Error al cargar contenido en Shaka:', e);
        this.emit('error', e);
        return;
      }
    }

    // Fallback nativo: desconectar Shaka del elemento para evitar conflictos
    // con el MediaSource attach que hace Shaka en el constructor.
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
    // Nunca mutear como fallback: las apps de TV no tienen control de volumen
    // para reactivar el audio. En TVs el autoplay con sonido está permitido.
    this.videoElement?.play().catch(() => {});
  }

  public pause() {
    this.videoElement?.pause();
  }

  public seek(time: number) {
    if (this.videoElement) this.videoElement.currentTime = time;
  }

  // ---------- Playback settings (calidad + pistas de audio) ----------
  public getVariantTracksInfo(): {
    auto: boolean;
    activeHeight: number | null;
    tracks: { height: number; bandwidth: number; active: boolean }[];
  } | null {
    if (!this.player) return null;
    const cfg = this.player.getConfiguration();
    const auto = !!(cfg.abr && cfg.abr.enabled);
    const variants = this.player.getVariantTracks();
    // Distinct heights, highest first.
    const byHeight = new Map<number, { height: number; bandwidth: number; active: boolean }>();
    for (const v of variants) {
      if (!v.height) continue;
      const existing = byHeight.get(v.height);
      if (!existing || (v.bandwidth || 0) > existing.bandwidth) {
        byHeight.set(v.height, { height: v.height, bandwidth: v.bandwidth || 0, active: !!v.active });
      }
    }
    const tracks = Array.from(byHeight.values()).sort((a, b) => b.height - a.height);
    const active = variants.find((v) => v.active);
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
    const candidates = this.player.getVariantTracks().filter((v) => v.height === option);
    if (candidates.length) {
      candidates.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
      this.player.selectVariantTrack(candidates[0], /* clearBuffer */ true);
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
    } catch (e) {
      console.error('[CinelarPlayerEngine] selectAudioTrack error:', e);
    }
  }

  // Selecciona la pista de audio preferida del usuario al montar (si hay
  // varias). Específicamente útil en contenido multi-idioma (ej. doblaje/sub).
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
