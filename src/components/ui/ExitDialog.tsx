import { useEffect } from 'react';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';

interface ExitDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExitDialog({ onConfirm, onCancel }: ExitDialogProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'exit-dialog',
    trackChildren: true,
    preferredChildFocusKey: 'exit-cancel',
  });

  useEffect(() => {
    setFocus('exit-cancel');
  }, []);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-bg">
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="flex flex-col items-center text-center w-[clamp(420px,55vw,720px)]"
        >
          <h2 className="text-white text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight">
            Salir de CinelarTV
          </h2>
          <p className="text-text-secondary text-[clamp(1rem,1.6vw,1.25rem)] mt-[clamp(1rem,2vh,1.5rem)] max-w-[clamp(420px,50vw,600px)] leading-relaxed">
            ¿Quieres cerrar la aplicación? Se detendrá cualquier reproducción en curso.
          </p>
          <div className="flex items-center gap-[clamp(1rem,2vw,1.5rem)] mt-[clamp(2.5rem,6vh,4rem)]">
            <Focusable
              onEnterPress={onCancel}
              focusKey="exit-cancel"
              focusedClassName="!bg-white !text-black scale-105"
              className="h-[clamp(3rem,5.5vh,3.75rem)] px-[clamp(2.5rem,5vw,4rem)] rounded-full bg-white/10 text-white text-[clamp(1rem,1.5vw,1.25rem)] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
              playSound
            >
              Cancelar
            </Focusable>
            <Focusable
              onEnterPress={onConfirm}
              focusKey="exit-confirm"
              focusedClassName="!bg-white !text-black scale-105"
              className="h-[clamp(3rem,5.5vh,3.75rem)] px-[clamp(2.5rem,5vw,4rem)] rounded-full bg-live text-white text-[clamp(1rem,1.5vw,1.25rem)] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
              playSound
            >
              Salir
            </Focusable>
          </div>
          <p className="text-text-tertiary text-[clamp(0.8rem,1.1vw,0.95rem)] mt-[clamp(2rem,4vh,3rem)]">
            Pulsa ATRÁS para seguir viendo CinelarTV
          </p>
        </div>
      </FocusContext.Provider>
    </div>
  );
}
