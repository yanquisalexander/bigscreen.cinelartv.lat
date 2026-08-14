import { CinelarPlayerEngine } from './CinelarPlayerEngine';
import { pdbg } from './playerDebug';

export function createPlayerEngine() {
  let engine = $state<CinelarPlayerEngine | null>(null);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let isPlaying = $state(false);
  let isBuffering = $state(false);
  let duration = $state(0);
  let engineReady = $state(false);
  let onEndedCallback: (() => void) | null = null;

  function attachVideo(el: HTMLVideoElement | null) {
    if (el === videoEl) return;
    videoEl = el;

    if (el && !engine) {
      pdbg('engine.attachVideo', 'video mounted → creating engine');
      const newEngine = new CinelarPlayerEngine(el);
      engine = newEngine;
      engineReady = true;
      pdbg('engine.attachVideo', 'engineReady=true');

      newEngine.on('playing', () => { isPlaying = true; });
      newEngine.on('paused', () => { isPlaying = false; });
      newEngine.on('buffering', (b) => { isBuffering = b !== false; });
      newEngine.on('durationchange', (d) => { duration = d ?? 0; });
      newEngine.on('ended', () => { onEndedCallback?.(); });
    } else if (!el && engine) {
      pdbg('engine.attachVideo', 'video unmounted → destroying engine');
      engine.destroy();
      engine = null;
      engineReady = false;
      isPlaying = false;
      isBuffering = false;
    }
  }

  function destroy() {
    pdbg('engine.destroy', 'destroying engine');
    engine?.destroy();
    engine = null;
    engineReady = false;
    isPlaying = false;
    isBuffering = false;
  }

  return {
    get isPlaying() { return isPlaying; },
    get isBuffering() { return isBuffering; },
    get duration() { return duration; },
    get engineReady() { return engineReady; },
    get engine() { return engine; },
    get videoEl() { return videoEl; },
    attachVideo,
    destroy,
    load: (url: string, startTime?: number) => {
      pdbg('engine.load', { url, startTime, hasEngine: !!engine });
      return engine?.load(url, startTime) ?? Promise.resolve();
    },
    play: () => {
      pdbg('engine.play', { hasEngine: !!engine });
      engine?.play();
    },
    pause: () => engine?.pause(),
    seek: (time: number) => engine?.seek(time),
    setOnEnded: (fn: () => void) => { onEndedCallback = fn; },
    getEngine: () => engine,
    getVariantTracksInfo: () => engine?.getVariantTracksInfo() ?? null,
    getAudioTracksInfo: () => engine?.getAudioTracksInfo() ?? null,
    selectQuality: (option: number | 'auto') => engine?.selectQuality(option),
    selectAudioTrack: (language: string, role?: string) => engine?.selectAudioTrack(language, role),
    applyPreferredAudioLanguage: (lang?: string) => engine?.applyPreferredAudioLanguage(lang),
    onTracksChanged: (fn: () => void): (() => void) => {
      return engine?.on('trackschanged', fn) ?? (() => {});
    },
  };
}
