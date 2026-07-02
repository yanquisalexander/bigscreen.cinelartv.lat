import { Focusable } from './Focusable';
import { classNames } from '@/utils/helpers';

interface FocusableCardProps {
  title: string;
  image?: string | null;
  subtitle?: string;
  progress?: number;
  onEnterPress: () => void;
  className?: string;
  focusKey?: string;
  autoFocus?: boolean;
  cardWidth?: number;
  cardHeight?: number;
}

export function FocusableCard({
  title,
  image,
  subtitle,
  progress,
  onEnterPress,
  className,
  focusKey,
  autoFocus = false,
  cardWidth = 280,
  cardHeight = 160,
}: FocusableCardProps) {
  return (
    <Focusable
      onEnterPress={onEnterPress}
      focusKey={focusKey}
      autoFocus={autoFocus}
      focusedClassName="scale-105 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
      className={classNames(
        'rounded-xl overflow-hidden flex-shrink-0',
        'transition-transform duration-200 ease-out',
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

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white text-sm font-semibold truncate">{title}</p>
          {subtitle && (
            <p className="text-text-secondary text-xs mt-0.5 truncate">{subtitle}</p>
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
