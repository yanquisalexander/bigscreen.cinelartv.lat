import { memo, useEffect } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';

interface DetailActionButtonProps {
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  focusKey?: string;
  autoFocus?: boolean;
  onEnterPress: () => void;
  onArrowPress?: (direction: string) => boolean;
  onFocus?: () => void;
  className?: string;
}

const variantClasses = {
  primary: 'bg-white text-black hover:bg-white/90',
  secondary: 'glass text-white',
  ghost: 'bg-white/10 text-white border border-white/20',
};

export const DetailActionButton = memo(function DetailActionButton({
  label,
  icon,
  variant = 'primary',
  focusKey,
  autoFocus = false,
  onEnterPress,
  onArrowPress,
  onFocus,
  className,
}: DetailActionButtonProps) {
  const { ref, focused, focusSelf } = useFocusable({
    focusKey,
    onEnterPress,
    onArrowPress,
    onFocus,
  });

  useEffect(() => {
    console.log('ActionButton mounted/updated', label, focusKey, focused);
    if (autoFocus) focusSelf();
  }, [autoFocus, focusSelf, label, focusKey]);

  return (
    <div
      ref={ref}
      data-focused={focused}
        className={classNames(
        'tv-no-select inline-flex items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)]',
        'rounded-full font-semibold cursor-pointer border-2 border-transparent',
        'transition-all duration-200 ease-out',
        variant === 'primary'
          ? 'px-[clamp(2rem,4vw,3rem)] py-[clamp(0.75rem,1.8vh,1.125rem)] text-[clamp(1rem,1.5vw,1.25rem)]'
          : 'px-[clamp(1.5rem,3vw,2.25rem)] py-[clamp(0.625rem,1.5vh,0.9375rem)] text-[clamp(0.875rem,1.3vw,1.0625rem)]',
        variantClasses[variant],
        focused && 'scale-110 !border-white shadow-2xl shadow-white/20',
        className,
      )}
    >
      {icon && <span className="text-[1.2em]">{icon}</span>}
      {label}
    </div>
  );
});
