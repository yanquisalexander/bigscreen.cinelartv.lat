import { useEffect, type ReactNode, type KeyboardEvent } from 'react';
import { useFocusable as useNoriginFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';

interface TVFocusableProps {
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
  parentFocusKey?: string;
  focusBoundary?: boolean;
}

export function TVFocusable({
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
  parentFocusKey,
  focusBoundary = false,
}: TVFocusableProps) {
  const { ref, focused, focusSelf } = useNoriginFocusable({
    focusKey,
    focusable,
    onEnterPress: onEnterPress,
    onArrowPress: onArrowPress ? (direction, _props, details) => onArrowPress(direction, details) : undefined,
    onFocus: onFocus,
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
      data-focus-key={focusKey}
      data-focused={focused}
      data-parent-focus-key={parentFocusKey}
      data-track-children={trackChildren}
      data-save-last-focused-child={saveLastFocusedChild}
      data-preferred-child-focus-key={preferredChildFocusKey}
      data-focus-boundary={focusBoundary}
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
