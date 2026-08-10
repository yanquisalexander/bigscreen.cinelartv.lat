import { useEffect, useState } from 'react';
import { useToastStore } from '@/stores/toastStore';

export function TVToast() {
  const { visible, message, title, hide } = useToastStore();
  const [animState, setAnimState] = useState<'in' | 'out' | 'hidden'>('hidden');

  useEffect(() => {
    if (visible) {
      setAnimState('in');
    } else if (animState === 'in') {
      setAnimState('out');
      const timer = setTimeout(() => setAnimState('hidden'), 250);
      return () => clearTimeout(timer);
    }
  }, [visible, animState]);

  if (animState === 'hidden') return null;

  const hasTitle = Boolean(title);

  return (
    <div
      className={classNames(
        'fixed top-0 right-0 z-[9999]',
        animState === 'in' ? 'animate-toast-in' : 'animate-toast-out',
      )}
      style={{
        marginTop: 'clamp(1.5rem, 3.5vh, 3rem)',
        marginRight: 'clamp(1.5rem, 3.5vw, 3rem)',
      }}
    >
      <div
        className="shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        style={{
          backgroundColor: '#181818',
          borderRadius: '0.75rem',
          maxWidth: '23rem',
          width: 'auto',
          padding: 'clamp(0.875rem, 1.8vh, 1.125rem) clamp(1rem, 1.8vw, 1.25rem)',
        }}
      >
        {hasTitle ? (
          <>
            <p
              className="text-white font-semibold leading-snug"
              style={{ fontSize: 'clamp(0.9375rem, 1.2vw, 1rem)', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
            >
              {title}
            </p>
            <p
              className="text-white/70 leading-snug"
              style={{ fontSize: 'clamp(0.8125rem, 1vw, 0.875rem)', marginTop: 'clamp(0.25rem, 0.6vh, 0.375rem)', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
            >
              {message}
            </p>
          </>
        ) : (
          <p
            className="text-white/80 leading-snug"
            style={{ fontSize: 'clamp(0.875rem, 1.1vw, 0.9375rem)', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
