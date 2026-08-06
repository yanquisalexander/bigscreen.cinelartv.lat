import { memo, useEffect } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';

interface DetailActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  focusKey?: string;
  autoFocus?: boolean;
  onEnterPress: () => void;
  onArrowPress?: (direction: string) => boolean;
  onFocus?: () => void;
  className?: string;
}

const variantClasses = {
  primary: 'bg-white text-black font-bold',
  secondary: 'bg-white/[0.08] text-white font-semibold ring-1 ring-white/10',
  ghost: 'bg-transparent text-white/80 font-semibold ring-1 ring-white/15',
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
    if (autoFocus) focusSelf();
  }, [autoFocus, focusSelf]);

  return (
    <div
      ref={ref}
      data-focused={focused}
      className={classNames(
        'tv-no-select inline-flex items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)]',
        'rounded-full cursor-pointer',
        'transition-all duration-200 ease-out',
        variant === 'primary'
          ? 'px-[clamp(2rem,4vw,3.25rem)] py-[clamp(0.75rem,1.7vh,1.0625rem)] text-[clamp(0.9375rem,1.35vw,1.125rem)]'
          : 'px-[clamp(1.375rem,2.6vw,2rem)] py-[clamp(0.625rem,1.4vh,0.875rem)] text-[clamp(0.8125rem,1.15vw,0.9375rem)]',
        variantClasses[variant],
        focused && variant === 'primary' && 'scale-[1.06] shadow-[0_10px_28px_-6px_rgba(255,255,255,0.35)]',
        focused && variant === 'secondary' && 'scale-[1.06] bg-white/[0.16] ring-white/20 shadow-[0_8px_22px_-6px_rgba(0,0,0,0.5)]',
        focused && variant === 'ghost' && 'scale-[1.06] bg-white/10 ring-white/30 text-white',
        className,
      )}
    >
      {icon && <span className="inline-flex text-[1.1em] leading-none">{icon}</span>}
      <span>{label}</span>
    </div>
  );
});