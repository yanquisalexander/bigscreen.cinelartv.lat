import { useState, useEffect, useCallback, useRef } from 'react';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { resolveImageUrl } from '@/utils/helpers';
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

export function HeroSection({ items, onPlay: _onPlay, onInfo, clientEndpoint, firstRowFocusKey, sidebarFocusKey, onImmersiveChange }: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [descSpace, setDescSpace] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);

  const { ref: heroRef, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'hero-section',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'hero-view-more',
  });

  const currentItem = items[currentIndex];
  const hasTrailer = !!(currentItem?.trailer_sources?.length);
  const trailerUrl = hasTrailer ? currentItem.trailer_sources![0].url : null;

  const goTo = useCallback(
    (index: number) => {
      setShowTrailer(false);
      setCurrentIndex((index + items.length) % items.length);
    },
    [items.length],
  );

  const focusSidebarFromHero = useCallback((direction: string) => {
    if (direction !== 'left' || !sidebarFocusKey) return true;
    setFocus(sidebarFocusKey);
    return false;
  }, [sidebarFocusKey]);

  const handleTrailerEnded = useCallback(() => {
    setShowTrailer(false);
  }, []);

  // Auto-avanza solo si nadie dentro del hero tiene el foco
  useEffect(() => {
    if (hasFocusedChild) {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hasFocusedChild, heroRef]);

  useEffect(() => {
    if (items.length <= 1 || hasFocusedChild) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const advance = () => {
      setCurrentIndex(prev => (prev + 1) % items.length);
    };

    const schedule = () => {
      if (items.length <= 1) return;
      timerRef.current = setTimeout(() => {
        advance();
        schedule();
      }, 7000);
    };

    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [items.length, hasFocusedChild]);

  // Manejar fade del trailer cuando cambia foco o slide
  useEffect(() => {
    if (!hasTrailer) {
      setShowTrailer(false);
      return;
    }

    if (hasFocusedChild) {
      const timer = setTimeout(() => {
        setShowTrailer(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowTrailer(false);
    }
  }, [hasFocusedChild, currentItem?.id, hasTrailer]);

  // Controlar reproducción del video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (showTrailer) {
      video.currentTime = 0;
      video.play().catch(() => { });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [showTrailer]);

  // Modo inmersivo: 3s después de mostrar el trailer, ocultar descripción y reducir overlays
  useEffect(() => {
    if (!showTrailer) {
      setImmersiveMode(false);
      return;
    }
    const timer = setTimeout(() => setImmersiveMode(true), 3_000);
    return () => { clearTimeout(timer); setImmersiveMode(false); };
  }, [showTrailer]);

  // Notificar al padre cuando cambia el modo inmersivo
  useEffect(() => {
    onImmersiveChange?.(immersiveMode);
  }, [immersiveMode, onImmersiveChange]);

  // Medir el espacio real de la descripción (altura + margin) para el translate del título
  useEffect(() => {
    const el = descRef.current;
    if (!el || !currentItem?.description) {
      setDescSpace(0);
      return;
    }

    const measure = () => {
      const style = getComputedStyle(el);
      const mb = parseFloat(style.marginBottom) || 0;
      setDescSpace(el.offsetHeight + mb);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentItem?.id, currentItem?.description]);

  if (!currentItem) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={heroRef as React.RefObject<HTMLDivElement>}
        className={`relative w-full overflow-hidden transition-all duration-700 ease-in-out ${immersiveMode ? 'h-screen' : 'h-[clamp(360px,70vh,680px)]'}`}
        style={{ willChange: 'height' }}
      >
        {/* Capa 1: Banner images */}
        {items.map((item, i) => (
          <div
            key={item.id}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out will-change-opacity"
            style={{ opacity: i === currentIndex && !showTrailer ? 1 : 0 }}
          >
            {item.banner || item.cover ? (
              <img
                src={resolveImageUrl(item.banner ?? item.cover, clientEndpoint)!}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/30 to-bg" />
            )}
          </div>
        ))}

        {/* Capa 2: Trailer video */}
        {hasTrailer && (
          <div
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out will-change-opacity"
            style={{ opacity: showTrailer ? 1 : 0 }}
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

        {/* Capa 3: Gradientes siempre visibles */}
        <div className={`absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent pointer-events-none transition-opacity duration-700 will-change-opacity ${immersiveMode ? 'opacity-20' : ''}`} />
        <div className={`absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/30 pointer-events-none transition-opacity duration-700 will-change-opacity ${immersiveMode ? 'opacity-40' : ''}`} />

        {/* Capa 4: Contenido (título, descripción, botón) */}
        <div className="absolute bottom-[clamp(3rem,9vh,5rem)] left-[clamp(3rem,7.5vw,6rem)] max-w-[clamp(28rem,46vw,36rem)] z-10">
          <h2
            className="text-[clamp(2rem,3.2vw,2.5rem)] font-extrabold text-white leading-tight mb-[clamp(0.75rem,2vh,1rem)] drop-shadow-lg transition-all duration-700 will-change-transform"
            style={{ transform: immersiveMode && descSpace > 0 ? `translateY(${descSpace}px)` : undefined }}
          >
            {currentItem.title}
          </h2>
          {currentItem.description && (
            <p ref={descRef} className={`text-[clamp(1rem,1.45vw,1.125rem)] text-text-secondary line-clamp-3 mb-[clamp(1rem,3vh,1.5rem)] transition-all duration-700 will-change-transform will-change-opacity ${immersiveMode ? 'opacity-0 translate-y-4 pointer-events-none' : ''}`}>
              {currentItem.description}
            </p>
          )}
          <div className="flex gap-[clamp(0.75rem,1.5vw,1rem)]">
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
                  if (immersiveMode) {
                    setShowTrailer(false);
                    setTimeout(() => {
                      if (firstRowFocusKey) setFocus(firstRowFocusKey);
                    }, 700);
                    return false;
                  }
                  if (firstRowFocusKey) {
                    setFocus(firstRowFocusKey);
                    return false;
                  }
                  return true;
                }
                return true;
              }}
              autoFocus
              focusKey="hero-view-more"
              focusedClassName="scale-105 shadow-lg shadow-black/40"
              className="px-[clamp(1.5rem,3vw,2rem)] py-[clamp(0.625rem,1.4vh,0.75rem)] bg-white text-black text-[clamp(0.875rem,1.25vw,1rem)] font-bold rounded-full transition-transform duration-200"
            >
              Ver más
            </Focusable>
          </div>
        </div>

        {/* Capa 5: Indicadores de slide */}
        {items.length > 1 && (
          <div className="absolute bottom-[clamp(1.25rem,4vh,2rem)] left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                aria-label={`Slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-white w-6' : 'bg-white/40'
                  }`}
              />
            ))}
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}
