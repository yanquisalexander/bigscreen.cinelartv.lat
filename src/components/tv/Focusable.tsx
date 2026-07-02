import { useEffect, type ReactNode, type KeyboardEvent } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';

interface FocusableProps {
  children: ReactNode;
  focusKey?: string;
  onEnterPress?: () => void;
  onArrowPress?: (direction: string, details: unknown) => boolean;
  className?: string;
  focusedClassName?: string;
  autoFocus?: boolean;
  trackChildren?: boolean;
  tabIndex?: number;
}

export function Focusable({
  children,
  focusKey,
  onEnterPress,
  onArrowPress,
  className,
  focusedClassName,
  autoFocus = false,
  trackChildren = false,
  tabIndex = 0,
}: FocusableProps) {
  const { focusKey: resolvedKey, ref, focused, focusSelf } = useFocusable({
    focusKey,
    onEnterPress: onEnterPress ? () => { onEnterPress(); } : undefined,
    onArrowPress: onArrowPress as never,
    trackChildren,
  });

  useEffect(() => {
    if (autoFocus) {
      focusSelf();
    }
  }, [autoFocus, focusSelf]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && onEnterPress) {
      e.preventDefault();
      onEnterPress();
    }
  };

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      tabIndex={tabIndex}
      role="button"
      onKeyDown={handleKeyDown}
      data-focus-key={resolvedKey}
      data-focused={focused}
      className={classNames(
        'tv-no-select',
        focused && focusedClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
