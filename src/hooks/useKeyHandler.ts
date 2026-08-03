import { useCallback, useRef } from 'react';
import { isBackKey } from '@/utils/helpers';

export function useKeyHandler(handlers: {
  onBack?: () => void;
  onPlayPause?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isBackKey(e)) {
      e.preventDefault();
      handlersRef.current.onBack?.();
    }
  }, []);

  return { handleKeyDown };
}