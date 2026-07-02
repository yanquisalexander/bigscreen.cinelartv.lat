import { useEffect, type ReactNode, type KeyboardEvent } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';

interface FocusableProps {
  children: ReactNode;
  focusKey?: string;
  onEnterPress?: () => void;
  onArrowPress?: (direction: string, details: unknown) => boolean;
  onFocus?: () => void;
  className?: string;
  focusedClassName?: string;
  autoFocus?: boolean;
  trackChildren?: boolean;
  saveLastFocusedChild?: boolean;
  preferredChildFocusKey?: string;
  focusable?: boolean;
  tabIndex?: number;
}

export function Focusable({
  children,
  focusKey,
  onEnterPress,
  onArrowPress,
  onFocus,
  className,
  focusedClassName,
  autoFocus = false,
  trackChildren = false,
  saveLastFocusedChild = false,
  preferredChildFocusKey,
  focusable = true,
  tabIndex = 0,
}: FocusableProps) {
  const { focusKey: resolvedKey, ref, focused, focusSelf } = useFocusable({
    focusKey,
    focusable,
    onEnterPress: onEnterPress ? () => { onEnterPress(); } : undefined,
    onArrowPress: onArrowPress ? (direction, _props, details) => onArrowPress(direction, details) : undefined,
    onFocus: onFocus ? () => { onFocus(); } : undefined,
    trackChildren,
    saveLastFocusedChild,
    preferredChildFocusKey,
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
