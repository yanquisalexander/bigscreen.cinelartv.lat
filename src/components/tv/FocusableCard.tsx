import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';
import { memo, useRef } from 'react';
import { useFocusSound } from '@/hooks/useNavigationSound';

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
  playSound?: boolean;
}

export const FocusableCard = memo(function FocusableCard({
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
  playSound = false,
}: FocusableCardProps) {
  const wrapFocus = useFocusSound();
  const bannerPreloaded = useRef(false);

  const { ref, focused } = useFocusable({
    onEnterPress,
    onArrowPress,
    onFocus: playSound
      ? wrapFocus(() => onFocus?.())
      : () => onFocus?.(),
    focusKey,
    autoFocus,
  });

  // Precarga suave del banner al enfocar
  if (focused && !bannerPreloaded.current && bannerImage) {
    bannerPreloaded.current = true;
    const img = new Image();
    img.src = bannerImage;
  }

  const isRowVariant = variant === 'row';

  return (
    <div
      ref={ref}
      data-focused={focused}
      /* 
        OPTIMIZACIÓN CRÍTICA PARA SMART TV:
        'willChange' promueve la tarjeta a una capa dedicada en la GPU.
        'contain' le indica al motor del navegador que aísle los re-calculos
        geométricos solo a esta tarjeta, evitando el reflow masivo en la pantalla.
      */
      style={{
        willChange: 'width, transform',
        contain: 'layout paint',
      }}
      className={classNames(
        'relative rounded-xl overflow-hidden border-2 transition-all duration-300 ease-out shrink-0 focus:outline-none snap-start',
        isRowVariant
          ? focused
            ? 'w-[clamp(340px,26vw,500px)] h-[clamp(195px,15vw,288px)] border-white z-20 shadow-xl shadow-black/60 scale-[1.02]'
            : 'w-[clamp(130px,10vw,192px)] h-[clamp(195px,15vw,288px)] border-transparent opacity-80 z-0 scale-100'
          : focused
            ? 'w-[280px] h-[158px] border-white z-20 shadow-xl scale-[1.02]'
            : 'w-[230px] h-[130px] border-transparent opacity-80 z-0 scale-100',
        className
      )}
    >
      {/* Mapeo de imagen según la variante y estado de foco */}
      {isRowVariant && focused && bannerImage ? (
        <div className="relative w-full h-full bg-surface">
          <img
            src={bannerImage}
            alt={title}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-4 max-w-[80%] z-10">
            <h3 className="text-white font-bold text-base truncate">{title}</h3>
            <div className="flex gap-2 text-[11px] text-white/80 my-1">
              {year && <span>{year}</span>}
              {subtitle && <span>• {subtitle}</span>}
            </div>
            {description && (
              <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full bg-surface">
          {image ? (
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
              <span className="text-text-secondary text-xl font-bold">
                {title.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
            <p className="text-white text-xs font-semibold truncate">{title}</p>
            {subtitle && (
              <p className="text-text-secondary text-[10px] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Barra de progreso */}
      {progress != null && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
});