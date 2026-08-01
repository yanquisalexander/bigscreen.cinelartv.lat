import { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useSettingsStore } from '@/stores/settingsStore';
import { getPlatform, getAppVersion, getDeviceName, getModel, getNativeVersion, getNativeVersionName } from '@/services/NativeBridge';
import { Focusable } from '@/components/tv/Focusable';
import { classNames } from '@/utils/helpers';
import { inputManager } from '@/services/InputManager';
import { Play, Volume2, Palette, Shield, Info } from 'lucide-react';

const SECTIONS = [
  { key: 'reproduccion', label: 'Reproducción', icon: Play, focusKey: 'settings-section-reproduccion-first' },
  { key: 'audio', label: 'Audio', icon: Volume2 },
  { key: 'apariencia', label: 'Apariencia', icon: Palette },
  { key: 'privacidad', label: 'Privacidad', icon: Shield },
  { key: 'informacion', label: 'Información', icon: Info },
];

export function SettingsScreen() {
  const navigate = useNavigate();

  const { ref, focusKey } = useFocusable({
    focusKey: 'settings-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'settings-nav-reproduccion',
  });

  const prefersModernPlayback = useSettingsStore((s) => s.prefersModernPlayback);
  const setPrefersModernPlayback = useSettingsStore((s) => s.setPrefersModernPlayback);

  const platform = getPlatform();
  const appVersion = getAppVersion();
  const deviceName = getDeviceName();
  const model = getModel();
  const nativeVersion = getNativeVersion();
  const nativeVersionName = getNativeVersionName();

  const handleBack = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  useEffect(() => {
    inputManager.on('back', handleBack);
    return () => inputManager.off('back', handleBack);
  }, [handleBack]);

  useEffect(() => {
    setFocus('settings-nav-reproduccion');
  }, []);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh bg-[#0a0a0a] flex overflow-hidden"
      >
        <SettingsSidebar />
        <SettingsContent
          prefersModernPlayback={prefersModernPlayback}
          setPrefersModernPlayback={setPrefersModernPlayback}
          platform={platform}
          appVersion={appVersion}
          deviceName={deviceName}
          model={model}
          nativeVersion={nativeVersion}
          nativeVersionName={nativeVersionName}
        />
      </div>
    </FocusContext.Provider>
  );
}

function SettingsSidebar() {
  const focusSidebar = useCallback(() => {
    setFocus('sidebar');
    return false;
  }, []);

  return (
    <nav className="flex-shrink-0 min-w-[clamp(140px,25vw,300px)] py-[clamp(3rem,8vh,4rem)] pl-[clamp(4rem,8vw,6rem)] pr-[clamp(2rem,4vw,3rem)] flex flex-col gap-[clamp(0.25rem,0.4vh,0.35rem)] overflow-y-auto scrollbar-none">
      <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] mb-[clamp(1.5rem,4vh,2rem)]">
        <div className="w-[clamp(2.25rem,3.5vw,3rem)] h-[clamp(2.25rem,3.5vw,3rem)] rounded-full bg-[#1c1c1e] flex items-center justify-center text-[#8e8e93] text-[clamp(1.15rem,1.8vw,1.5rem)]">
          ⚙
        </div>
        <h1 className="text-[clamp(1.35rem,2.6vw,2rem)] font-semibold text-white">Ajustes</h1>
      </div>

      {SECTIONS.map((section, idx) => (
        <Focusable
          key={section.key}
          focusKey={`settings-nav-${section.key}`}
          onEnterPress={() => {
            if (section.focusKey) setFocus(section.focusKey);
          }}
          onArrowPress={(direction) => {
            if (direction === 'right' && section.focusKey) {
              setFocus(section.focusKey);
              return false;
            }
            if (direction === 'left' && idx === 0) {
              return focusSidebar();
            }
            return true;
          }}
          focusedClassName="bg-white/10 !text-white"
          className={classNames(
            'flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.5rem,0.8vh,0.65rem)] rounded-xl text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium',
            'text-[#8e8e93] transition-colors cursor-pointer',
          )}
        >
          <section.icon className="text-[clamp(1.15rem,1.5vw,1.3rem)]" />
          <span className="whitespace-nowrap">{section.label}</span>
        </Focusable>
      ))}

      <Focusable
        onEnterPress={() => setFocus('settings-back')}
        onArrowPress={(direction) => {
          if (direction === 'right') {
            setFocus('settings-back');
            return false;
          }
          return true;
        }}
        focusedClassName="bg-white/10 !text-white"
        className={classNames(
          'flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.5rem,0.8vh,0.65rem)] mt-[clamp(2rem,4vh,3rem)] rounded-xl text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium',
          'text-[#8e8e93] transition-colors cursor-pointer',
        )}
      >
        <span className="text-[clamp(1.1rem,1.4vw,1.3rem)]">←</span>
        <span className="whitespace-nowrap">Volver al inicio</span>
      </Focusable>
    </nav>
  );
}

interface SettingsContentProps {
  prefersModernPlayback: boolean;
  setPrefersModernPlayback: (value: boolean) => void;
  platform: string;
  appVersion: string;
  deviceName: string | null;
  model: string;
  nativeVersion: string;
  nativeVersionName: string | null;
}

function SettingsContent({
  prefersModernPlayback,
  setPrefersModernPlayback,
  platform,
  appVersion,
  deviceName,
  model,
  nativeVersion,
  nativeVersionName,
}: SettingsContentProps) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-none py-[clamp(3rem,8vh,4rem)] px-[clamp(3rem,7.5vw,6rem)]">
      <ReproducionSection
        prefersModernPlayback={prefersModernPlayback}
        setPrefersModernPlayback={setPrefersModernPlayback}
      />
      <AudioSection />
      <AparienciaSection />
      <PrivacidadSection />
      <InformacionSection
        platform={platform}
        appVersion={appVersion}
        deviceName={deviceName}
        model={model}
        nativeVersion={nativeVersion}
        nativeVersionName={nativeVersionName}
      />

      <Focusable
        onEnterPress={() => setFocus('settings-nav-reproduccion')}
        onArrowPress={(direction) => {
          if (direction === 'left') {
            setFocus('settings-nav-reproduccion');
            return false;
          }
          return true;
        }}
        focusedClassName="bg-white text-black scale-105"
        className="inline-flex items-center gap-[clamp(0.5rem,1vw,0.75rem)] h-[clamp(2.25rem,3.5vh,2.75rem)] px-[clamp(1.25rem,2.5vw,2rem)] rounded-full bg-[#1c1c1e] text-white text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium transition-all mt-[clamp(2rem,4vh,3rem)] cursor-pointer"
      >
        <span className="text-lg">→</span>
        Volver al inicio
      </Focusable>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-[#8e8e93] mb-[clamp(0.75rem,1.2vh,1rem)]">
      {children}
    </h3>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1c1c1e] rounded-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(1rem,2vw,1.5rem)] mb-[clamp(1.5rem,4vh,2rem)]">
      {children}
    </div>
  );
}

function SettingsRow({
  focusKey,
  label,
  description,
  children,
  onEnterPress,
  onArrowLeft,
}: {
  focusKey: string;
  label: string;
  description?: string;
  children?: React.ReactNode;
  onEnterPress?: () => void;
  onArrowLeft?: () => void;
}) {
  return (
    <Focusable
      focusKey={focusKey}
      onEnterPress={onEnterPress}
      onArrowPress={(direction) => {
        if (direction === 'left' && onArrowLeft) {
          onArrowLeft();
          return false;
        }
        return true;
      }}
      focusedClassName="bg-white/5"
      className="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)] border-b border-white/5 last:border-b-0 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
    >
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">{label}</span>
        {description && (
          <span className="text-[#8e8e93] text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">{description}</span>
        )}
      </div>
      {children}
    </Focusable>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div
      className={classNames(
        'relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full transition-colors flex-shrink-0 cursor-pointer',
        checked ? 'bg-[#181881]' : 'bg-white/20',
      )}
      onClick={() => onChange(!checked)}
    >
      <div
        className={classNames(
          'absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-white shadow-lg transition-all',
          checked ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]',
        )}
      />
    </div>
  );
}

function ReproducionSection({
  prefersModernPlayback,
  setPrefersModernPlayback,
}: {
  prefersModernPlayback: boolean;
  setPrefersModernPlayback: (value: boolean) => void;
}) {
  return (
    <div>
      <SectionTitle>Reproducción</SectionTitle>
      <SectionCard>
        <SettingsRow
          focusKey="settings-section-reproduccion-first"
          label="Reproductor moderno"
          description="Usa el reproductor web en lugar del nativo del dispositivo."
          onEnterPress={() => setPrefersModernPlayback(!prefersModernPlayback)}
          onArrowLeft={() => setFocus('settings-nav-reproduccion')}
        >
          <Toggle checked={prefersModernPlayback} onChange={setPrefersModernPlayback} />
        </SettingsRow>
      </SectionCard>
    </div>
  );
}

function AudioSection() {
  return (
    <div>
      <SectionTitle>Audio</SectionTitle>
      <SectionCard>
        <p className="text-[#8e8e93] text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
          Próximamente
        </p>
      </SectionCard>
    </div>
  );
}

function AparienciaSection() {
  return (
    <div>
      <SectionTitle>Apariencia</SectionTitle>
      <SectionCard>
        <p className="text-[#8e8e93] text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
          Próximamente
        </p>
      </SectionCard>
    </div>
  );
}

function PrivacidadSection() {
  return (
    <div>
      <SectionTitle>Privacidad</SectionTitle>
      <SectionCard>
        <p className="text-[#8e8e93] text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
          Próximamente
        </p>
      </SectionCard>
    </div>
  );
}

function InformacionSection({
  platform,
  appVersion,
  deviceName,
  model,
  nativeVersion,
  nativeVersionName,
}: {
  platform: string;
  appVersion: string;
  deviceName: string | null;
  model: string;
  nativeVersion: string;
  nativeVersionName: string | null;
}) {
  const rows = useMemo(() => [
    { label: 'Versión', value: appVersion },
    { label: 'Dispositivo', value: deviceName ?? '—' },
    { label: 'Modelo', value: model },
    { label: 'Plataforma', value: platform },
    { label: 'Versión Nativa', value: nativeVersionName ? `${nativeVersionName} (${nativeVersion})` : '—' },
  ], [appVersion, deviceName, model, platform, nativeVersion, nativeVersionName]);

  return (
    <div>
      <SectionTitle>Información</SectionTitle>
      <SectionCard>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)] border-b border-white/5 last:border-b-0">
            <span className="text-[#8e8e93] text-[clamp(0.8rem,1.1vw,0.95rem)]">{row.label}</span>
            <span className="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium text-right max-w-[clamp(10rem,22vw,18rem)] overflow-hidden text-ellipsis">
              {row.value}
            </span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
