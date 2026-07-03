import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { LucideTv } from 'lucide-react';

export function LiveTVScreen() {
  const navigate = useNavigate();

  const { ref, focusKey } = useFocusable({
    focusKey: 'livetv-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'livetv-back',
  });

  useEffect(() => {
    setFocus('livetv-back');
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

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh flex flex-col items-center justify-center bg-bg px-[clamp(2rem,4vw,4rem)]"
      >
        <div className="flex flex-col items-center text-center max-w-[clamp(280px,40vw,500px)]">
          <div className="w-[clamp(4rem,8vw,6rem)] h-[clamp(4rem,8vw,6rem)] rounded-full bg-surface flex items-center justify-center mb-[clamp(1.5rem,3vh,2.5rem)]">
            <LucideTv className="w-[clamp(1.75rem,3.5vw,2.5rem)] h-[clamp(1.75rem,3.5vw,2.5rem)] text-text-secondary" />
          </div>
          <h1 className="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-semibold mb-[clamp(0.75rem,1.5vh,1rem)]">
            TV en Vivo
          </h1>
          <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)] leading-relaxed mb-[clamp(2rem,4vh,3rem)]">
            La funcionalidad de TV en vivo no está disponible para este dispositivo.
          </p>
          <Focusable
            focusKey="livetv-back"
            onEnterPress={() => navigate('/home')}
            onArrowPress={(direction) => {
              if (direction !== 'left') return true;
              setFocus('sidebar');
              return false;
            }}
            focusedClassName="!bg-white !text-black scale-105"
            className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer"
          >
            Volver al inicio
          </Focusable>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
