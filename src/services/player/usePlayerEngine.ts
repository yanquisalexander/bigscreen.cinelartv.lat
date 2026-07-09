import { useEffect, useRef, useState, useCallback } from 'react';
import { CinelarPlayerEngine } from './CinelarPlayerEngine';

export function usePlayerEngine() {
  const engineRef = useRef<CinelarPlayerEngine | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onEndedRef = useRef<() => void>(() => {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [duration, setDuration] = useState(0);

  // Callback ref: el engine se crea justo cuando el <video> se monta en el DOM.
  // Usar videoRef.current directamente no funciona porque los refs no
  // disparan re-render, así que el engine nunca recibía el elemento real.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el === videoRef.current) return;
    videoRef.current = el;

    if (el && !engineRef.current) {
      const engine = new CinelarPlayerEngine(el);
      engineRef.current = engine;

      engine.on('playing', () => setIsPlaying(true));
      engine.on('paused', () => setIsPlaying(false));
      engine.on('buffering', (b) => setIsBuffering(b !== false));
      engine.on('durationchange', (d) => setDuration(d ?? 0));
      engine.on('ended', () => onEndedRef.current());
    }
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const load = useCallback((url: string, startTime?: number) => {
    return engineRef.current?.load(url, startTime) ?? Promise.resolve();
  }, []);

  const play = useCallback(() => engineRef.current?.play(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const seek = useCallback((time: number) => engineRef.current?.seek(time), []);
  const setOnEnded = useCallback((fn: () => void) => { onEndedRef.current = fn; }, []);

  return { attachVideo, videoRef, load, play, pause, seek, setOnEnded, isPlaying, isBuffering, duration };
}
