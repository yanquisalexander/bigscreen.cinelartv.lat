import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  getPlatform,
  getAppVersion,
  getDeviceName,
  getModel,
  getNativeVersion,
  getNativeVersionName,
} from '@/services/NativeBridge';
import { Focusable } from '@/components/tv/Focusable';
import { classNames } from '@/utils/helpers';
import { inputManager } from '@/services/InputManager';
import { Play, Volume2, Palette, Shield, Info, LucideRotateCcw } from 'lucide-react';
import { buttonItem, showPanel } from "@/services/overlayPanel";

/* ─── Section definitions ──────────────────────────────────────── */

const SECTIONS: readonly {
  key: string;
  label: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  { key: 'reproduccion', label: 'Reproducción', icon: Play },
  { key: 'audio', label: 'Audio', icon: Volume2 },
  { key: 'apariencia', label: 'Apariencia', icon: Palette },
  { key: 'privacidad', label: 'Privacidad', icon: Shield },
  { key: 'informacion', label: 'Información', icon: Info },
  { key: 'reiniciar', label: 'Reiniciar', icon: LucideRotateCcw },
  { key: 'factory-reset', label: 'Restablecer app' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/* ─── Main screen ──────────────────────────────────────────────── */

export function SettingsScreen() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionKey>('reproduccion');

  const { ref, focusKey } = useFocusable({
    focusKey: 'settings-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'settings-nav-reproduccion',
  });

  const prefersModernPlayback = useSettingsStore((s) => s.prefersModernPlayback);
  const setPrefersModernPlayback = useSettingsStore((s) => s.setPrefersModernPlayback);
  const navigationSoundEnabled = useSettingsStore((s) => s.navigationSoundEnabled);
  const setNavigationSoundEnabled = useSettingsStore((s) => s.setNavigationSoundEnabled);

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
        className="w-full h-dvh bg-bg flex overflow-hidden"
      >
        {/* left panel */}
        <SettingsSidebar
          activeSection={activeSection}
          onSectionFocus={setActiveSection}
        />

        {/* right panel */}
        <div className="flex-1 overflow-y-auto hide-scrollbar py-[clamp(3rem,8vh,4rem)] px-[clamp(3rem,7.5vw,6rem)]">
          {activeSection === 'reproduccion' && (
            <ReproduccionContent
              prefersModernPlayback={prefersModernPlayback}
              setPrefersModernPlayback={setPrefersModernPlayback}
              onBackToSidebar={() => setFocus('settings-nav-reproduccion')}
            />
          )}
          {activeSection === 'audio' && (
            <AudioContent
              navigationSoundEnabled={navigationSoundEnabled}
              setNavigationSoundEnabled={setNavigationSoundEnabled}
              onBackToSidebar={() => setFocus('settings-nav-audio')}
            />
          )}
          {activeSection === 'apariencia' && <AparienciaContent />}
          {activeSection === 'privacidad' && <PrivacidadContent />}
          {activeSection === 'reiniciar' && <ReiniciarContent />}
          {activeSection === 'factory-reset' && <FactoryResetContent />}
          {activeSection === 'informacion' && (
            <InformacionContent
              platform={platform}
              appVersion={appVersion}
              deviceName={deviceName!}
              model={model}
              nativeVersion={nativeVersion}
              nativeVersionName={nativeVersionName}
            />
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────────── */

function SettingsSidebar({
  activeSection,
  onSectionFocus,
}: {
  activeSection: SectionKey;
  onSectionFocus: (key: SectionKey) => void;
}) {
  const focusSidebar = useCallback(() => {
    setFocus('sidebar');
    return false;
  }, []);

  return (
    <nav className="flex-shrink-0 min-w-[clamp(140px,25vw,300px)] py-[clamp(3rem,8vh,4rem)] pl-[clamp(4rem,8vw,6rem)] pr-[clamp(2rem,4vw,3rem)] flex flex-col gap-[clamp(0.25rem,0.4vh,0.35rem)] overflow-y-auto scrollbar-none">
      {/* header */}
      <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] mb-[clamp(1.5rem,4vh,2rem)]">
        <div className="w-[clamp(2.25rem,3.5vw,3rem)] h-[clamp(2.25rem,3.5vw,3rem)] rounded-full bg-surface flex items-center justify-center text-text-secondary text-[clamp(1.15rem,1.8vw,1.5rem)]">
          ⚙
        </div>
        <h1 className="text-[clamp(1.35rem,2.6vw,2rem)] font-semibold text-white">
          Configuración
        </h1>
      </div>

      {/* categories */}
      {SECTIONS.map((section, idx) => {
        const isActive = activeSection === section.key;
        return (
          <Focusable
            key={section.key}
            focusKey={`settings-nav-${section.key}`}
            onFocus={() => onSectionFocus(section.key)}
            onEnterPress={() => {
              const firstItem = document.querySelector(
                `[data-settings-section="${section.key}"] [data-focusable]`,
              ) as HTMLElement | null;
              if (firstItem) {
                const fk = firstItem.getAttribute('data-focus-key');
                if (fk) setFocus(fk);
              }
            }}
            onArrowPress={(direction) => {
              if (direction === 'left' && idx === 0) {
                return focusSidebar();
              }
              return true;
            }}
            focusedClassName={classNames(
              '!bg-white !text-black',
            )}
            className={classNames(
              'flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.5rem,0.8vh,0.65rem)] rounded-xl text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium cursor-pointer',
              isActive ? 'text-white bg-white/10' : 'text-text-secondary',
            )}
          >
            {
              section.icon && <section.icon className="text-[clamp(1.15rem,1.5vw,1.3rem)]" />
            }
            <span className="whitespace-nowrap">{section.label}</span>
          </Focusable>
        );
      })}


    </nav>
  );
}

/* ─── Shared helpers ───────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
      {children}
    </h3>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(1rem,2vw,1.5rem)]">
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  focusKey,
  onArrowLeft,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  focusKey?: string;
  onArrowLeft?: () => void;
}) {
  return (
    <Focusable
      focusKey={focusKey}
      onEnterPress={() => onChange(!checked)}
      onArrowPress={(direction) => {
        if (direction === 'left' && onArrowLeft) {
          onArrowLeft();
          return false;
        }
        return true;
      }}
      className={classNames(
        'relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 cursor-pointer',
        checked ? 'bg-white' : 'bg-white/20',
      )}
    >
      <div
        className={classNames(
          'absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-black transition-all',
          checked ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]',
        )}
      />
    </Focusable>
  );
}

/* ─── Section content panels ───────────────────────────────────── */

function ReproduccionContent({
  prefersModernPlayback,
  setPrefersModernPlayback,
  onBackToSidebar,
}: {
  prefersModernPlayback: boolean;
  setPrefersModernPlayback: (v: boolean) => void;
  onBackToSidebar: () => void;
}) {
  return (
    <div data-settings-section="reproduccion">
      <SectionTitle>Reproducción</SectionTitle>
      <SectionCard>
        <div className="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)]">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
              Reproductor moderno
            </span>
            <span className="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
              Usa el reproductor web en lugar del nativo del dispositivo.
            </span>
          </div>
          <Toggle
            checked={prefersModernPlayback}
            onChange={setPrefersModernPlayback}
            focusKey="settings-toggle-modern"
            onArrowLeft={onBackToSidebar}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function AudioContent({
  navigationSoundEnabled,
  setNavigationSoundEnabled,
  onBackToSidebar,
}: {
  navigationSoundEnabled: boolean;
  setNavigationSoundEnabled: (v: boolean) => void;
  onBackToSidebar: () => void;
}) {
  return (
    <div data-settings-section="audio">
      <SectionTitle>Audio</SectionTitle>
      <SectionCard>
        <div className="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)]">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
              Sonido de navegación
            </span>
            <span className="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
              Reproduce un sonido al cambiar el foco entre elementos.
            </span>
          </div>
          <Toggle
            checked={navigationSoundEnabled}
            onChange={setNavigationSoundEnabled}
            focusKey="settings-toggle-nav-sound"
            onArrowLeft={onBackToSidebar}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function AparienciaContent() {
  return (
    <div data-settings-section="apariencia">
      <SectionTitle>Apariencia</SectionTitle>
      <SectionCard>
        <p className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
          Próximamente
        </p>
      </SectionCard>
    </div>
  );
}

function ReiniciarContent() {
  const navigate = useNavigate();

  return (
    <div data-settings-section="reiniciar" className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-[clamp(4rem,7vw,5.5rem)] h-[clamp(4rem,7vw,5.5rem)] rounded-2xl bg-accent/20 flex items-center justify-center mb-[clamp(1.5rem,3vh,2.5rem)]">
        <LucideRotateCcw className="w-[clamp(2rem,3.5vw,3rem)] h-[clamp(2rem,3.5vw,3rem)] text-accent-light" />
      </div>

      <h2 className="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-bold mb-[clamp(0.75rem,1.5vh,1rem)]">
        Reiniciar app
      </h2>

      <p className="text-text-secondary text-[clamp(0.85rem,1.2vw,1.05rem)] leading-relaxed max-w-[clamp(300px,40vw,500px)] mb-[clamp(2rem,4vh,3rem)]">
        Vuelve a cargar la aplicación y regresa a la pantalla de inicio. Esto puede ayudar a corregir problemas temporales.
      </p>

      <Focusable
        focusKey="settings-reiniciar-btn"
        onEnterPress={() => window.location.href = '/'}
        onArrowPress={(direction) => {
          if (direction === 'left') {
            setFocus('settings-nav-reiniciar');
            return false;
          }
          return true;
        }}
        focusedClassName="!bg-white !text-black"
        className="inline-flex items-center justify-center px-[clamp(2rem,4vw,3rem)] py-[clamp(0.625rem,1.4vh,0.875rem)] rounded-full bg-surface text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-semibold border border-white/10 cursor-pointer"
      >
        Reiniciar app
      </Focusable>
    </div>
  );
}

function FactoryResetContent() {
  const navigate = useNavigate();

  return (
    <div data-settings-section="factory-reset" className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-[clamp(4rem,7vw,5.5rem)] h-[clamp(4rem,7vw,5.5rem)] rounded-2xl bg-red-500/20 flex items-center justify-center mb-[clamp(1.5rem,3vh,2.5rem)]">
        <LucideRotateCcw className="w-[clamp(2rem,3.5vw,3rem)] h-[clamp(2rem,3.5vw,3rem)] text-red-500" />
      </div>

      <h2 className="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-bold mb-[clamp(0.75rem,1.5vh,1rem)]">
        Restablecer app
      </h2>

      <p className="text-text-secondary text-[clamp(0.85rem,1.2vw,1.05rem)] leading-relaxed max-w-[clamp(300px,40vw,500px)] mb-[clamp(2rem,4vh,3rem)]">
        Esto borrará todos los datos de la aplicación y la devolverá a su estado original. Úsalo solo si es necesario.
      </p>

      <Focusable
        focusKey="settings-factory-reset-btn"
        onEnterPress={() => {
          showPanel({
            title: "Restablecer app",
            subtitle: "¿Estás seguro de que quieres borrar todos los datos y restablecer la aplicación? Esta acción no se puede deshacer.",

            items: [
              buttonItem({ title: 'Restablecer app', subtitle: 'Borrar todos los datos y volver a la pantalla de inicio', icon: 'trash' }),
              buttonItem({ title: 'Volver', subtitle: 'Cancelar y regresar a la configuración', icon: 'x' })
            ],
          })
        }}
        onArrowPress={(direction) => {
          if (direction === 'left') {
            setFocus('settings-nav-factory-reset');
            return false;
          }
          return true;
        }}
        focusedClassName="!bg-white !text-black"
        className="inline-flex items-center justify-center px-[clamp(2rem,4vw,3rem)] py-[clamp(0.625rem,1.4vh,0.875rem)] rounded-full bg-red-500 text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-semibold border border-red-500/50 cursor-pointer"
      >
        Restablecer app
      </Focusable>
    </div>
  );
}

function PrivacidadContent() {
  return (
    <div data-settings-section="privacidad">
      <SectionTitle>Privacidad</SectionTitle>
      <SectionCard>
        <p className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
          Próximamente
        </p>
      </SectionCard>
    </div>
  );
}

function InformacionContent({
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
  const rows = useMemo(
    () => [
      { label: 'Versión', value: appVersion },
      { label: 'Dispositivo', value: deviceName ?? '—' },
      { label: 'Modelo', value: model },
      { label: 'Plataforma', value: platform },
      {
        label: 'Versión Nativa',
        value: nativeVersionName
          ? `${nativeVersionName} (${nativeVersion})`
          : '—',
      },
    ],
    [appVersion, deviceName, model, platform, nativeVersion, nativeVersionName],
  );

  return (
    <div data-settings-section="informacion">
      <SectionTitle>Información</SectionTitle>
      <SectionCard>
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)] border-b border-white/5 last:border-b-0"
          >
            <span className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">
              {row.label}
            </span>
            <span className="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium text-right max-w-[clamp(10rem,22vw,18rem)] overflow-hidden text-ellipsis">
              {row.value}
            </span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
