import { Focusable } from './Focusable';
import { classNames } from '@/utils/helpers';

interface FocusableCardProps {
  title: string;
  image?: string | null;
  subtitle?: string;
  progress?: number;
  onEnterPress: () => void;
  onArrowPress?: (direction: string) => boolean;
  className?: string;
  focusKey?: string;
  autoFocus?: boolean;
  cardWidth?: number | string;
  cardHeight?: number | string;
}

export function FocusableCard({
  title,
  image,
  subtitle,
  progress,
  onEnterPress,
  onArrowPress,
  className,
  focusKey,
  autoFocus = false,
  cardWidth = 'clamp(156px,18vw,230px)',
  cardHeight = 'clamp(88px,10.2vw,130px)',
}: FocusableCardProps) {
  return (
    <Focusable
      onEnterPress={onEnterPress}
      onArrowPress={onArrowPress}
      focusKey={focusKey}
      autoFocus={autoFocus}
      focusedClassName="!scale-105 !shadow-[0_8px_32px_rgba(0,0,0,0.6)] !border-white/50"
      className={classNames(
        'rounded-xl overflow-hidden shrink-0',
        'transition-transform duration-200 ease-out border-2 border-transparent focus:outline-none',
        className,
      )}
    >
      <div className="relative bg-surface rounded-xl overflow-hidden" style={{ width: cardWidth, height: cardHeight }}>
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
            <span className="text-text-secondary text-3xl font-bold">
              {title.charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-[clamp(0.5rem,1.2vw,0.75rem)]">
          <p className="text-white text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold truncate">{title}</p>
          {subtitle && (
            <p className="text-text-secondary text-[clamp(0.6875rem,0.95vw,0.75rem)] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        {progress != null && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-white"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>
    </Focusable>
  );
}
