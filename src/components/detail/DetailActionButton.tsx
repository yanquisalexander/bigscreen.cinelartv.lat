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
  secondary: 'bg-white/15 text-white font-semibold',
  ghost: 'bg-transparent text-white border border-white/20 font-semibold',
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
          ? 'px-[clamp(2.25rem,4.5vw,3.5rem)] py-[clamp(0.75rem,1.8vh,1.125rem)] text-[clamp(0.9375rem,1.4vw,1.1875rem)]'
          : 'px-[clamp(1.5rem,3vw,2.25rem)] py-[clamp(0.625rem,1.5vh,0.9375rem)] text-[clamp(0.8125rem,1.2vw,1rem)]',
        variantClasses[variant],
        focused && variant === 'primary' && 'scale-110 shadow-[0_0_24px_rgba(255,255,255,0.3)]',
        focused && variant === 'secondary' && 'scale-110 bg-white/25 shadow-[0_0_20px_rgba(255,255,255,0.15)]',
        focused && variant === 'ghost' && 'scale-110 border-white/50 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]',
        className,
      )}
    >
      {icon && <span className="inline-flex text-[1.1em] leading-none">{icon}</span>}
      <span>{label}</span>
    </div>
  );
});
