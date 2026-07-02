import { Focusable } from './Focusable';
import { classNames } from '@/utils/helpers';

interface FocusableButtonProps {
  children: string;
  onEnterPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  autoFocus?: boolean;
  focusKey?: string;
  onArrowPress?: (direction: string) => boolean;
}

const variantStyles = {
  primary: 'bg-white text-black',
  secondary: 'glass text-white',
  ghost: 'bg-transparent text-white border border-white/20',
};

const sizeStyles = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
};

export function FocusableButton({
  children,
  onEnterPress,
  variant = 'primary',
  size = 'md',
  className,
  autoFocus = false,
  focusKey,
  onArrowPress,
}: FocusableButtonProps) {
  return (
    <Focusable
      onEnterPress={onEnterPress}
      onArrowPress={onArrowPress}
      autoFocus={autoFocus}
      focusKey={focusKey}
      focusedClassName="scale-105 shadow-lg shadow-black/40"
      className={classNames(
        'inline-flex items-center justify-center rounded-full font-semibold',
        'transition-all duration-200 ease-out',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </Focusable>
  );
}
