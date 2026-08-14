import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { resolveBackdrop, resolveLogo } from '@/utils/helpers';
import type { ContentItem } from '@/types/content';

interface HeroSectionProps {
  items: ContentItem[];
  onPlay: (item: ContentItem) => void;
  onInfo: (item: ContentItem) => void;
  clientEndpoint: string;
  firstRowFocusKey?: string;
  sidebarFocusKey?: string;
  onImmersiveChange?: (immersive: boolean) => void;
}

export function HeroSection({
  items,
  onInfo,
  clientEndpoint,
  firstRowFocusKey,
  sidebarFocusKey,
  onImmersiveChange,
}: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [prevBannerUrl, setPrevBannerUrl] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { ref: heroRef, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'hero-section',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'hero-view-more',
  });

  const currentItem = items[currentIndex];
  const hasTrailer = !!(currentItem?.trailer_sources?.length);
  const trailerUrl = hasTrailer ? currentItem.trailer_sources![0].url : null;

  // Banner actual
  const currentBannerUrl = useMemo(() => {
    if (!currentItem) return null;
    return resolveBackdrop(
      currentItem.images,
      currentItem.banner_resized ?? currentItem.banner ?? currentItem.cover_resized ?? currentItem.cover,
      clientEndpoint,
      'xlarge'
    );
  }, [currentItem, clientEndpoint]);

  // Guardar la imagen anterior para el Crossfade
  useEffect(() => {
    if (currentBannerUrl) {
      const timer = setTimeout(() => {
        setPrevBannerUrl(currentBannerUrl);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [currentBannerUrl]);

  // Logo actual
  const currentLogoUrl = useMemo(() => {
    if (!currentItem) return null;
    return resolveLogo(currentItem.images, clientEndpoint);
  }, [currentItem, clientEndpoint]);

  const goTo = useCallback(
    (index: number) => {
      setShowTrailer(false);
      setCurrentIndex((index + items.length) % items.length);
    },
    [items.length]
  );

  const focusSidebarFromHero = useCallback(
    (direction: string) => {
      if (direction !== 'left' || !sidebarFocusKey) return true;
      setFocus(sidebarFocusKey);
      return false;
    },
    [sidebarFocusKey]
  );

  const handleTrailerEnded = useCallback(() => {
    setShowTrailer(false);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (items.length <= 1 || hasFocusedChild || showTrailer) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items.length, hasFocusedChild, currentIndex, showTrailer]);

  // Timer para iniciar el tráiler
  useEffect(() => {
    if (!hasTrailer || !hasFocusedChild) {
      setShowTrailer(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowTrailer(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [hasFocusedChild, currentItem?.id, hasTrailer]);

  // Reproducción de video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (showTrailer) {
      video.currentTime = 0;
      video.play().catch(() => { });
    } else {
      video.pause();
    }
  }, [showTrailer]);

  useEffect(() => {
    onImmersiveChange?.(showTrailer);
  }, [showTrailer, onImmersiveChange]);

  if (!currentItem) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      {/* 
        EXPANSIÓN A 100dvh:
        Al activar showTrailer pasa a 'h-[100dvh]' expandiéndose suavemente.
      */}
      <div
        ref={heroRef as React.RefObject<HTMLDivElement>}
        className={`relative w-full overflow-hidden bg-black transition-[height] duration-700 ease-in-out ${showTrailer ? 'h-[100dvh]' : 'h-[clamp(420px,68vh,660px)]'
          }`}
      >
        {/* CAPA 1: IMÁGENES DE FONDO (CROSSFADE) */}
        <div className="absolute inset-0">
          {prevBannerUrl && (
            <img
              src={prevBannerUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {currentBannerUrl && (
            <img
              key={currentBannerUrl}
              src={currentBannerUrl}
              alt={currentItem.title}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${showTrailer ? 'opacity-0' : 'opacity-100'
                }`}
              loading="eager"
            />
          )}
        </div>

        {/* CAPA 2: VIDEO TRÁILER */}
        {hasTrailer && (
          <div
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${showTrailer ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
          >
            <video
              key={`trailer-${currentItem.id}`}
              ref={videoRef}
              src={trailerUrl!}
              className="w-full h-full object-cover"
              playsInline
              onEnded={handleTrailerEnded}
            />
          </div>
        )}

        {/* CAPA 3: GRADIENTES DE CONTRASTE */}
        <div
          className={`absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent pointer-events-none transition-opacity duration-700 z-20 ${showTrailer ? 'opacity-20' : 'opacity-100'
            }`}
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/30 pointer-events-none transition-opacity duration-700 z-20 ${showTrailer ? 'opacity-30' : 'opacity-100'
            }`}
        />

        {/* CAPA 4: CONTENIDO (Alineado a la Izquierda) */}
        <div className="absolute bottom-[clamp(2.5rem,7vh,4.5rem)] left-[clamp(2.5rem,5vw,5rem)] max-w-[clamp(26rem,42vw,36rem)] z-30 flex flex-col items-start text-left">

          {/* Metadatos */}
          <div className="flex items-center gap-3 mb-3 text-xs font-semibold text-text-secondary">
            {currentItem.year && (
              <span className="px-2 py-0.5 rounded bg-white/10 text-white backdrop-blur-md">
                {currentItem.year}
              </span>
            )}
            {currentItem.duration && <span>{currentItem.duration} min</span>}
            <span className="border border-white/30 px-1.5 py-0.2 rounded text-[10px] text-white">
              HD
            </span>
          </div>

          {/* Logo o Título (Siempre Visible) */}
          {currentLogoUrl ? (
            <img
              src={currentLogoUrl}
              alt={currentItem.title}
              className="h-[clamp(3.5rem,8vh,5.5rem)] max-w-[85%] object-contain object-left mb-3 drop-shadow-2xl"
            />
          ) : (
            <h1 className="text-[clamp(2rem,3.2vw,2.8rem)] font-black text-white leading-tight mb-3 drop-shadow-lg tracking-tight text-left">
              {currentItem.title}
            </h1>
          )}

          {/* Descripción (Plegado animado) */}
          <div
            className={`transition-all duration-700 ease-in-out overflow-hidden w-full ${showTrailer ? 'max-h-0 opacity-0 mb-0' : 'max-h-36 opacity-100 mb-6'
              }`}
          >
            {currentItem.description && (
              <p className="text-[clamp(0.95rem,1.2vw,1.05rem)] text-gray-300 line-clamp-3 leading-relaxed font-normal drop-shadow text-left">
                {currentItem.description}
              </p>
            )}
          </div>

          {/* Botón Ver detalles (Siempre Visible) */}
          <div className="flex items-center gap-4">
            <Focusable
              onEnterPress={() => onInfo(currentItem)}
              onArrowPress={(direction) => {
                if (direction === 'left') {
                  if (currentIndex === 0) return focusSidebarFromHero(direction);
                  goTo(currentIndex - 1);
                  return false;
                }
                if (direction === 'right') {
                  goTo(currentIndex + 1);
                  return false;
                }
                if (direction === 'down') {
                  if (firstRowFocusKey) {
                    setFocus(firstRowFocusKey);
                    return false;
                  }
                }
                return true;
              }}
              autoFocus
              focusKey="hero-view-more"
              focusedClassName="scale-105 bg-white text-black shadow-2xl shadow-white/20 ring-4 ring-white/50"
              className="px-7 py-3 bg-white/20 backdrop-blur-md text-white text-sm font-bold rounded-xl transition-all duration-200 border border-white/20 cursor-pointer"
              playSound
            >
              Ver detalles
            </Focusable>
          </div>
        </div>

        {/* CAPA 5: INDICADORES */}
        {items.length > 1 && (
          <div
            className={`absolute bottom-6 right-[clamp(2.5rem,5vw,5rem)] flex items-center gap-2 z-30 transition-opacity duration-500 ${showTrailer ? 'opacity-20' : 'opacity-100'
              }`}
          >
            {items.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'
                  }`}
              />
            ))}
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}