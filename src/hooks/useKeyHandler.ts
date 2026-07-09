import { useCallback, useRef } from 'react';

export function useKeyHandler(handlers: {
  onBack?: () => void;
  onPlayPause?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'XF86Back' || e.key === 'Back') {
      e.preventDefault();
      handlersRef.current.onBack?.();
    }
  }, []);

  return { handleKeyDown };
}