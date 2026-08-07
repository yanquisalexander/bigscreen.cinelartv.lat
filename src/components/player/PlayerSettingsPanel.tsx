import { useCallback, useEffect, useRef, useState } from 'react';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { Monitor, Volume2, Check } from 'lucide-react';

function scrollToFocused(container: HTMLDivElement | null) {
  if (!container) return;
  const tryScroll = () => {
    const focused = container.querySelector('[data-focused="true"]') as HTMLElement | null;
    if (focused) {
      focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    return false;
  };
  // Try immediately in case focus is already applied
  if (tryScroll()) return;
  // Otherwise observe until data-focused flips to true
  const observer = new MutationObserver(() => {
    if (tryScroll()) observer.disconnect();
  });
  observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });
  setTimeout(() => observer.disconnect(), 1000);
}

interface QualityInfo {
  auto: boolean;
  activeHeight: number | null;
  tracks: { height: number; bandwidth: number; active: boolean }[];
}

interface AudioInfo {
  language: string;
  role: string;
  label: string;
  active: boolean;
}

interface EngineLike {
  getVariantTracksInfo(): QualityInfo | null;
  getAudioTracksInfo(): AudioInfo[] | null;
  selectQuality(option: number | 'auto'): void;
  selectAudioTrack(language: string, role?: string): void;
  onTracksChanged?: (fn: () => void) => void;
}

interface Props {
  engine: EngineLike | null;
  open: boolean;
}

export function PlayerSettingsPanel({ engine, open }: Props) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'player-settings',
    focusable: false,
    trackChildren: true,
    isFocusBoundary: true,
  });

  const [quality, setQuality] = useState<QualityInfo | null>(null);
  const [audio, setAudio] = useState<AudioInfo[] | null>(null);
  const didFocusRef = useRef(false);

  const refresh = useCallback(() => {
    if (!engine) return;
    setQuality(engine.getVariantTracksInfo());
    setAudio(engine.getAudioTracksInfo());
  }, [engine]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Update quality list when Shaka signals tracks changed
  useEffect(() => {
    if (!open || !engine?.onTracksChanged) return;
    return engine.onTracksChanged(refresh);
  }, [open, engine, refresh]);

  useEffect(() => {
    if (!open) return;
    didFocusRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || didFocusRef.current) return;
    const activeKey = quality
      ? (quality.auto
          ? 'player-settings-quality-auto'
          : quality.activeHeight
            ? `player-settings-quality-${quality.activeHeight}`
            : 'player-settings-quality-auto')
      : audio && audio.length
        ? `player-settings-audio-${sanitize(audio[0].language)}-${sanitize(audio[0].role)}`
        : null;
    if (!activeKey) return;
    didFocusRef.current = true;
    setFocus(activeKey);
    scrollToFocused(ref.current);
  }, [open, quality, audio, ref]);

  if (!open) return null;

  const scrollOnFocus = () => scrollToFocused(ref.current);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        className="absolute top-[clamp(4.5rem,9vh,6rem)] right-[clamp(2rem,4vw,3rem)] w-[clamp(280px,25vw,400px)] max-h-[70vh] bg-[#1c1c1e] rounded-[clamp(1rem,2vw,1.5rem)] shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        <h2 className="shrink-0 px-4 pt-4 pb-2 text-white text-[clamp(1rem,1.5vw,1.25rem)] font-semibold border-b border-white/10">Configuración</h2>

        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="flex-1 overflow-y-auto p-4"
        >

        <div className="text-[#8e8e93] text-[clamp(0.7rem,1vw,0.85rem)] font-bold uppercase tracking-wider mb-2 px-2">Calidad</div>
        {quality ? (
          <>
            <SettingsItem
              label="Auto"
              active={quality.auto}
              icon={<Monitor className="w-5 h-5" />}
              onSelect={() => {
                engine?.selectQuality('auto');
                refresh();
              }}
              focusKey="player-settings-quality-auto"
              onFocusScroll={scrollOnFocus}
            />
            {quality.tracks.map((t) => (
              <SettingsItem
                key={t.height}
                label={`${t.height}p`}
                active={quality.activeHeight === t.height && !quality.auto}
                icon={<Monitor className="w-5 h-5" />}
                onSelect={() => {
                  engine?.selectQuality(t.height);
                  refresh();
                }}
                focusKey={`player-settings-quality-${t.height}`}
                onFocusScroll={scrollOnFocus}
              />
            ))}
          </>
        ) : (
          <div className="px-4 py-2 text-[#8e8e93] text-sm">Sin opciones de calidad</div>
        )}

        <div className="text-[#8e8e93] text-[clamp(0.7rem,1vw,0.85rem)] font-bold uppercase tracking-wider mb-2 px-2 mt-4">Audio</div>
        {audio && audio.length > 0 ? (
          audio.map((a) => (
            <SettingsItem
              key={`${a.language}-${a.role}`}
              label={a.label}
              active={a.active}
              icon={<Volume2 className="w-5 h-5" />}
              onSelect={() => {
                engine?.selectAudioTrack(a.language, a.role || undefined);
                refresh();
              }}
              focusKey={`player-settings-audio-${sanitize(a.language)}-${sanitize(a.role)}`}
              onFocusScroll={scrollOnFocus}
            />
          ))
        ) : (
          <div className="px-4 py-2 text-[#8e8e93] text-sm">Sin pistas de audio</div>
        )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

function sanitize(s: string): string {
  return (s || 'und').replace(/[^a-z0-9]/gi, '');
}

function SettingsItem({
  label,
  active,
  icon,
  onSelect,
  focusKey,
  onFocusScroll,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
  focusKey: string;
  onFocusScroll?: () => void;
}) {
  return (
    <Focusable
      focusKey={focusKey}
      onEnterPress={onSelect}
      onFocus={onFocusScroll}
      className="flex items-center justify-between p-3 my-1 rounded-xl cursor-pointer transition-all duration-200"
      focusedClassName="bg-white/10 scale-105"
      playSound
    >
      <div className="flex items-center gap-4 text-white">
        <div className="text-[#8e8e93]">{icon}</div>
        <span className="text-[clamp(0.85rem,1.1vw,1rem)] font-medium">{label}</span>
      </div>
      {active && <Check className="w-4 h-4 text-white" />}
    </Focusable>
  );
}
