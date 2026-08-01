import { useCallback, useEffect, useRef, useState } from 'react';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { Monitor, Volume2, Check } from 'lucide-react';

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

  useEffect(() => {
    if (!open) return;
    didFocusRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || didFocusRef.current) return;
    const first = quality
      ? 'player-settings-quality-auto'
      : audio && audio.length
        ? `player-settings-audio-${sanitize(audio[0].language)}-${sanitize(audio[0].role)}`
        : null;
    if (!first) return;
    didFocusRef.current = true;
    setFocus(first);
  }, [open, quality, audio]);

  if (!open) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="absolute top-[clamp(4.5rem,9vh,6rem)] right-[clamp(2rem,4vw,3rem)] w-[clamp(280px,25vw,400px)] max-h-[70vh] bg-[#1c1c1e] rounded-[clamp(1rem,2vw,1.5rem)] p-4 shadow-2xl z-50 overflow-y-auto"
      >
        <h2 className="text-white text-[clamp(1rem,1.5vw,1.25rem)] font-semibold mb-4 px-2">Configuración</h2>

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
            />
          ))
        ) : (
          <div className="px-4 py-2 text-[#8e8e93] text-sm">Sin pistas de audio</div>
        )}
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
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
  focusKey: string;
}) {
  return (
    <Focusable
      focusKey={focusKey}
      onEnterPress={onSelect}
      className="flex items-center justify-between p-3 my-1 rounded-xl cursor-pointer transition-all duration-200"
      focusedClassName="bg-white/10 scale-105"
    >
      <div className="flex items-center gap-4 text-white">
        <div className="text-[#8e8e93]">{icon}</div>
        <span className="text-[clamp(0.85rem,1.1vw,1rem)] font-medium">{label}</span>
      </div>
      {active && <Check className="w-4 h-4 text-white" />}
    </Focusable>
  );
}
