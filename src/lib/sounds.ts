import { useSettingsStore } from '@/stores/settingsStore';

export type InteractionSound = 'focus' | 'select' | 'back' | 'error';

/** WAV mono cortos (<150ms) servidos localmente: sin red, sin autoplay bloqueado. */
const SOUND_SOURCES: Record<InteractionSound, string> = {
  focus: '/resources/sounds/cursor.wav',
  select: '/resources/sounds/select.wav',
  back: '/resources/sounds/back.wav',
  error: '/resources/sounds/error.wav',
};

const SOUND_VOLUME: Record<InteractionSound, number> = {
  focus: 0.35,
  select: 0.4,
  back: 0.32,
  error: 0.3,
};

const sources = new Map<InteractionSound, HTMLAudioElement>();

/** Carga diferida: solo se crea el Audio cuando el sonido se usa por primera vez. */
function getSource(kind: InteractionSound): HTMLAudioElement | null {
  const cached = sources.get(kind);
  if (cached) return cached;

  try {
    const source = new Audio();
    source.src = SOUND_SOURCES[kind];
    source.preload = 'auto';
    source.volume = SOUND_VOLUME[kind];
    source.load();
    sources.set(kind, source);
    return source;
  } catch {
    // Algunos WebView antiguos lanzan al construir Audio — degradar en silencio.
    return null;
  }
}

export function playInteractionSound(kind: InteractionSound): void {
  if (!useSettingsStore.getState().navigationSoundEnabled) return;

  const source = getSource(kind);
  if (!source) return;

  try {
    const clone = source.cloneNode(true) as HTMLAudioElement;
    clone.volume = SOUND_VOLUME[kind];
    clone.play().catch(() => {});
  } catch {
    // cloneNode puede fallar en WebView — degradar en silencio.
  }
}

/** Alias conservado para los callers existentes. */
export function playFocusSound(): void {
  playInteractionSound('focus');
}
