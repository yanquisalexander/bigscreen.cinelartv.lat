import { useEffect } from 'react';
import { useNavigate, useRouteError } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { useToastStore } from '@/stores/toastStore';

export function FallbackScreen() {
  const navigate = useNavigate();
  const error = useRouteError();

  useEffect(() => {
    useToastStore.getState().show(
      'Error inesperado. Intenta de nuevo.',
      'error',
      5000,
    );
  }, []);

  const { ref, focusKey } = useFocusable({
    focusKey: 'fallback-root',
    trackChildren: true,
    preferredChildFocusKey: 'fallback-retry',
  });

  useEffect(() => {
    setFocus('fallback-retry');
  }, []);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh flex flex-col items-center justify-center gap-8 px-8 bg-bg"
      >
        <p className="text-text-secondary text-[clamp(1rem,1.4vw,1.25rem)] text-center max-w-md">
          Algo salió mal. Por favor, intenta de nuevo.
        </p>
        <Focusable
          onEnterPress={() => navigate('/home')}
          focusKey="fallback-retry"
          focusedClassName="!bg-white !text-black scale-105"
          className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(2rem,3vw,3rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
        >
          Reintentar
        </Focusable>
      </div>
    </FocusContext.Provider>
  );
}
