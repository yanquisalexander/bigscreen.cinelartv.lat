import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { LucideSettings, LucideChevronRight } from 'lucide-react';
import { getPlatform, getAppVersion, getDeviceModel, getDeviceName, getModel, getNativeVersion, getNativeVersionName } from '@/services/NativeBridge';
import { Toggle } from '@/components/tv/Toggle';
import { useSettingsStore } from '@/stores/settingsStore';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)]">
      <span className="text-text-secondary text-[clamp(0.85rem,1.2vw,1rem)]">{label}</span>
      <span className="text-white text-[clamp(0.85rem,1.2vw,1rem)] font-medium text-right max-w-[clamp(12rem,25vw,20rem)] truncate">
        {value || '—'}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-text-tertiary text-[clamp(0.7rem,0.95vw,0.8rem)] font-semibold uppercase tracking-wider mb-[clamp(0.5rem,1vh,0.75rem)]">
      {children}
    </h2>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();

  const { ref, focusKey } = useFocusable({
    focusKey: 'settings-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'settings-back',
  });

  useEffect(() => {
    setFocus('settings-back');
  }, []);

  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (['Escape', 'Backspace', 'XF86Back', 'GoBack', 'BrowserBack'].includes(e.key)) {
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

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh flex flex-col bg-bg"
      >
        <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(3rem,7.5vw,6rem)] pt-[clamp(1.5rem,3vh,3rem)] pb-[clamp(1rem,2vh,1.5rem)] shrink-0">
          <div className="w-[clamp(2.5rem,4vw,3.5rem)] h-[clamp(2.5rem,4vw,3.5rem)] rounded-full bg-surface flex items-center justify-center shrink-0">
            <LucideSettings className="w-[clamp(1.25rem,2vw,1.75rem)] h-[clamp(1.25rem,2vw,1.75rem)] text-text-secondary" />
          </div>
          <h1 className="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-semibold">
            Ajustes
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(1.5rem,3vh,3rem)]">
          <div className="max-w-[clamp(320px,45vw,600px)] space-y-[clamp(1.5rem,3vh,2.5rem)]">
            <section className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.75rem,1.5vh,1rem)]">
              <SectionTitle>Información de la App</SectionTitle>
              <InfoRow label="Versión" value={appVersion} />
              <InfoRow label="Plataforma" value={platform} />
              <InfoRow label="Versión Nativa" value={nativeVersionName ? `${nativeVersionName} (${nativeVersion})` : '—'} />
            </section>

            <section className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.75rem,1.5vh,1rem)]">
              <SectionTitle>Dispositivo</SectionTitle>
              <InfoRow label="Nombre" value={deviceName ?? '—'} />
              <InfoRow label="Modelo" value={model} />
              <InfoRow label="Dispositivo" value={deviceModel} />
            </section>

            <section className="bg-surface rounded-2xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.5rem,1vh,0.75rem)]">
              <SectionTitle>Reproducción</SectionTitle>
              <Toggle
                focusKey="settings-modern-playback"
                label="Prefers modern playback"
                description="Usa siempre el reproductor web e ignora el reproductor nativo del dispositivo."
                checked={prefersModernPlayback}
                onChange={setPrefersModernPlayback}
              />
            </section>

            <div className="flex gap-[clamp(0.5rem,1vw,0.75rem)]">
              <Focusable
                focusKey="settings-back"
                onEnterPress={handleBack}
                onArrowPress={(direction) => {
                  if (direction !== 'left') return true;
                  setFocus('nav-home');
                  return false;
                }}
                focusedClassName="!bg-white !text-black scale-105"
                className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
              >
                <LucideChevronRight className="w-[clamp(1rem,1.5vw,1.25rem)] h-[clamp(1rem,1.5vw,1.25rem)] rotate-180" />
                Volver al inicio
              </Focusable>
            </div>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}