import { useSettingsStore } from '@/stores/settingsStore';

const SOUND_SRC = '/resources/sounds/cursor.wav';

const sourceAudio = new Audio();
sourceAudio.src = SOUND_SRC;
sourceAudio.preload = 'auto';
sourceAudio.volume = 0.5;
sourceAudio.load();

export function playFocusSound(): void {
  if (!useSettingsStore.getState().navigationSoundEnabled) return;
  try {
    const clone = sourceAudio.cloneNode(true) as HTMLAudioElement;
    clone.play().catch(() => {});
  } catch {
    // cloneNode can fail in some WebView environments — degrade silently
  }
}
