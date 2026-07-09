import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import {
  LucideSettings, LucideChevronRight, LucideMonitor, LucideHeadphones, LucideShield,
  LucideInfo, LucidePaintbrush,
} from 'lucide-react';
import { getPlatform, getAppVersion, getDeviceModel, getDeviceName, getModel, getNativeVersion, getNativeVersionName } from '@/services/NativeBridge';
import { Toggle } from '@/components/tv/Toggle';
import { useSettingsStore } from '@/stores/settingsStore';

const SECTIONS = [
  { key: 'reproduccion', label: 'Reproducción', icon: LucideMonitor },
  { key: 'audio', label: 'Audio', icon: LucideHeadphones },
  { key: 'apariencia', label: 'Apariencia', icon: LucidePaintbrush },
  { key: 'privacidad', label: 'Privacidad', icon: LucideShield },
  { key: 'informacion', label: 'Información', icon: LucideInfo },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-text-tertiary text-[clamp(0.65rem,0.85vw,0.75rem)] font-semibold uppercase tracking-wider mb-[clamp(0.75rem,1.2vh,1rem)]">
      {children}
    </h2>
  );
}

const ROW_BASE = 'flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)]';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={ROW_BASE}>
      <span className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">{label}</span>
      <span className="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium text-right max-w-[clamp(10rem,22vw,18rem)] truncate">
        {value || '—'}
      </span>
    </div>
  );
}

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

  useEffect(() => {
    setFocus('settings-nav-reproduccion');
  }, []);

  const focusSectionFirstItem = useCallback((section: SectionKey) => {
    return (dir: string) => {
      if (dir !== 'right') return true;
      setFocus(`settings-section-${section}-first`);
      return false;
    };
  }, []);

  const focusSidebarItem = useCallback((section: SectionKey) => {
    return (dir: string) => {
      if (dir !== 'left') return true;
      setFocus(`settings-nav-${section}`);
      return false;
    };
  }, []);

  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (['Escape', 'Backspace', 'XF86Back', 'GoBack', 'BrowserBack', 'Back'].includes(e.key)) {
        e.preventDefault();
        navigate('/home');
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [navigate]);

  const handleBack = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  const platform = getPlatform();
  const appVersion = getAppVersion();
  const deviceName = getDeviceName();
  const deviceModel = getDeviceModel();
  const model = getModel();
  const nativeVersion = getNativeVersion();
  const nativeVersionName = getNativeVersionName();

  const prefersModernPlayback = useSettingsStore((s) => s.prefersModernPlayback);
  const setPrefersModernPlayback = useSettingsStore((s) => s.setPrefersModernPlayback);

  const sectionContent = () => {
    switch (activeSection) {
      case 'reproduccion':
        return (
          <section>
            <SectionTitle>Reproducción</SectionTitle>
            <div className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.5rem,1vh,0.75rem)]">
              <Focusable
                focusKey="settings-section-reproduccion-first"
                onEnterPress={() => setPrefersModernPlayback(!prefersModernPlayback)}
                focusedClassName="bg-white/10"
                className="rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between py-[clamp(0.75rem,1.5vh,1rem)] px-[clamp(0.75rem,1.5vw,1rem)] pointer-events-none">
                  <div className="flex flex-col pr-4">
                    <span className="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">Reproductor moderno</span>
                    <span className="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">Usa el reproductor web en lugar del nativo del dispositivo.</span>
                  </div>
                  <div
                    className={`relative w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 transition-colors duration-200 ${prefersModernPlayback ? 'bg-accent' : 'bg-white/20'
                      }`}
                  >
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-white shadow-md transition-all duration-200 ${prefersModernPlayback ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'
                        }`}
                    />
                  </div>
                </div>
              </Focusable>
            </div>
          </section>
        );
      case 'audio':
        return (
          <section>
            <SectionTitle>Audio</SectionTitle>
            <div className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(1rem,2vh,1.25rem)]">
              <div className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-4">
                Próximamente
              </div>
            </div>
          </section>
        );
      case 'apariencia':
        return (
          <section>
            <SectionTitle>Apariencia</SectionTitle>
            <div className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(1rem,2vh,1.25rem)]">
              <div className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-4">
                Próximamente
              </div>
            </div>
          </section>
        );
      case 'privacidad':
        return (
          <section>
            <SectionTitle>Privacidad</SectionTitle>
            <div className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(1rem,2vh,1.25rem)]">
              <div className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-4">
                Próximamente
              </div>
            </div>
          </section>
        );
      case 'informacion':
        return (
          <section>
            <SectionTitle>Información</SectionTitle>
            <div className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.75rem,1.5vh,1rem)]">
              <InfoRow label="Versión" value={appVersion} />
              <InfoRow label="Dispositivo" value={deviceName ?? '—'} />
              <InfoRow label="Modelo" value={model} />
              <InfoRow label="Plataforma" value={platform} />
              <InfoRow label="Versión Nativa" value={nativeVersionName ? `${nativeVersionName} (${nativeVersion})` : '—'} />
            </div>
          </section>
        );
    }
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh flex flex-col bg-bg"
      >
        {/* Header */}
        <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(2rem,4vw,4rem)] pt-[clamp(1.5rem,3vh,3rem)] pb-[clamp(0.75rem,1.5vh,1.25rem)] shrink-0">
          <div className="w-[clamp(2.25rem,3.5vw,3rem)] h-[clamp(2.25rem,3.5vw,3rem)] rounded-full bg-surface flex items-center justify-center shrink-0">
            <LucideSettings className="w-[clamp(1.15rem,1.8vw,1.5rem)] h-[clamp(1.15rem,1.8vw,1.5rem)] text-text-secondary" />
          </div>
          <h1 className="text-white text-[clamp(1.35rem,2.6vw,2rem)] font-semibold">
            Ajustes
          </h1>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex-1 flex overflow-hidden pb-[clamp(1.5rem,3vh,3rem)]">
          {/* Sidebar */}
          <nav className="flex flex-col gap-[clamp(0.25rem,0.4vh,0.35rem)] min-w-[clamp(140px,25vw,300px)] shrink-0 pl-[clamp(5rem,4vw,4rem)] pt-1">
            {SECTIONS.map((entry) => {
              return (
                <Focusable
                  key={entry.key}
                  focusKey={`settings-nav-${entry.key}`}
                  onEnterPress={() => setActiveSection(entry.key)}
                  onArrowPress={focusSectionFirstItem(entry.key)}
                  focusedClassName="!bg-white/15 !text-white"
                  className={`flex items-center gap-3 px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.5rem,0.8vh,0.65rem)] rounded-xl transition-all duration-150 cursor-pointer ${activeSection === entry.key ? 'bg-white/8 text-white' : 'text-text-secondary'
                    }`}
                >
                  <entry.icon className="w-[clamp(1.1rem,1.4vw,1.3rem)] h-[clamp(1.1rem,1.4vw,1.3rem)] shrink-0" />
                  <span className="text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium">{entry.label}</span>
                </Focusable>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto hide-scrollbar pl-[clamp(2rem,4vw,4rem)] pr-[clamp(2rem,4vw,4rem)]">
            <div className="max-w-[clamp(320px,40vw,560px)]">
              {sectionContent()}

              <div className="mt-[clamp(2rem,4vh,3rem)]">
                <Focusable
                  focusKey="settings-back"
                  onEnterPress={handleBack}
                  onArrowPress={(direction) => {
                    if (direction !== 'left') return true;
                    const currentSection = activeSection;
                    setFocus(`settings-nav-${currentSection}`);
                    return false;
                  }}
                  focusedClassName="!bg-white !text-black scale-105"
                  className="h-[clamp(2.25rem,3.5vh,2.75rem)] px-[clamp(1.25rem,2.5vw,2rem)] rounded-full bg-surface text-white text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  <LucideChevronRight className="w-[clamp(0.9rem,1.3vw,1.1rem)] h-[clamp(0.9rem,1.3vw,1.1rem)] rotate-180" />
                  Volver al inicio
                </Focusable>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}