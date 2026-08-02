import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';
import { memo } from 'react';

interface FocusableCardProps {
  title: string;
  image?: string | null;
  bannerImage?: string | null;
  description?: string;
  year?: number;
  subtitle?: string;
  progress?: number;
  onEnterPress: () => void;
  onArrowPress?: (direction: string) => boolean;
  onFocus?: () => void;
  className?: string;
  focusKey?: string;
  autoFocus?: boolean;
  variant?: 'row' | 'episode';
}

const PosterView = memo(({ title, image, subtitle, progress, variant }: { title: string; image?: string | null; subtitle?: string; progress?: number; variant: 'row' | 'episode' }) => (
  <div className={classNames(
    "relative w-full h-full bg-surface rounded-xl overflow-hidden",
    variant === 'row' ? 'aspect-[2/3]' : 'aspect-video'
  )}>
    {image ? (
      <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
        <span className="text-text-secondary text-xl font-bold">{title.charAt(0)}</span>
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <p className="text-white text-xs font-semibold truncate">{title}</p>
      {subtitle && <p className="text-text-secondary text-[10px] mt-0.5 truncate">{subtitle}</p>}
    </div>
    {progress != null && progress > 0 && (
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div className="h-full bg-white" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    )}
  </div>
));

const BannerView = memo(({ title, image, description, year, subtitle }: { title: string; image?: string | null; description?: string; year?: number; subtitle?: string }) => (
  <div className="relative w-full h-full bg-surface rounded-xl overflow-hidden flex items-end p-6">
    {image && <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover" loading="eager" />}
    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
    <div className="relative z-10 max-w-[50%]">
      <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
      <div className="flex gap-3 text-xs text-white mb-2">
        {year && <span>{year}</span>}
        {subtitle && <span>{subtitle}</span>}
      </div>
      {description && <p className="text-sm text-gray-200 line-clamp-2">{description}</p>}
    </div>
  </div>
));

export function FocusableCard({
  title,
  image,
  bannerImage,
  description,
  year,
  subtitle,
  progress,
  onEnterPress,
  onArrowPress,
  onFocus,
  className,
  focusKey,
  autoFocus = false,
  variant = 'row',
}: FocusableCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress,
    onArrowPress,
    onFocus,
    focusKey,
    autoFocus,
  });

  const isRowVariant = variant === 'row';

  return (
    <div
      ref={ref}
      data-focused={focused}
      className={classNames(
        'shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-300 ease-out focus:outline-none will-change-transform snap-start',
        isRowVariant
          ? (focused ? 'w-[500px] h-[281px] border-white opacity-100' : 'w-[180px] h-[270px] border-transparent opacity-80')
          : 'w-[230px] h-[130px] border-transparent scale-100',
        className,
      )}
    >
      {isRowVariant && focused ? (
        <BannerView title={title} image={bannerImage || image} description={description} year={year} subtitle={subtitle} />
      ) : (
        <PosterView title={title} image={image} subtitle={subtitle} progress={progress} variant={variant} />
      )}
    </div>
  );
}
