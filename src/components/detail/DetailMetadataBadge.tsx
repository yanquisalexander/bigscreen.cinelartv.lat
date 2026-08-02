import { memo } from 'react';
import { classNames } from '@/utils/helpers';

interface DetailMetadataBadgeProps {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}

export const DetailMetadataBadge = memo(function DetailMetadataBadge({
  children,
  accent = false,
  className,
}: DetailMetadataBadgeProps) {
  return (
    <span
      className={classNames(
        'inline-flex items-center',
        'px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.125rem,0.4vh,0.25rem)]',
        'rounded text-[clamp(0.75rem,1.1vw,0.875rem)] font-medium',
        accent
          ? 'bg-accent-light/20 text-accent-light'
          : 'bg-white/10 text-text-secondary',
        className,
      )}
    >
      {children}
    </span>
  );
});
