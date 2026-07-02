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
}

export function HeroSection({ items, onPlay, onInfo, clientEndpoint, firstRowFocusKey, sidebarFocusKey }: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { ref: heroRef, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'hero-section',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'hero-play',
  });

  const currentItem = items[currentIndex];

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex((index + items.length) % items.length);
    },
    [items.length],
  );

  const focusFirstRowFromHero = useCallback((direction: string) => {
    if (direction !== 'down' || !firstRowFocusKey) return true;
    setFocus(firstRowFocusKey);
    return false;
  }, [firstRowFocusKey]);

  const focusSidebarFromHero = useCallback((direction: string) => {
    if (direction !== 'left' || !sidebarFocusKey) return true;
    setFocus(sidebarFocusKey);
    return false;
  }, [sidebarFocusKey]);

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

  if (!currentItem) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={heroRef as React.RefObject<HTMLDivElement>}
        className="relative w-full h-[clamp(360px,70vh,680px)] overflow-hidden"
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === currentIndex ? 1 : 0 }}
          >
            {item.banner || item.cover ? (
              <img
                src={resolveImageUrl(item.banner ?? item.cover, clientEndpoint)!}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/30 to-bg" />
            )}
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/30" />

        <div className="absolute bottom-[clamp(3rem,9vh,5rem)] left-[clamp(3rem,7.5vw,6rem)] max-w-[clamp(28rem,46vw,36rem)] z-10">
          <h2 className="text-[clamp(2rem,3.2vw,2.5rem)] font-extrabold text-white leading-tight mb-[clamp(0.75rem,2vh,1rem)] drop-shadow-lg">
            {currentItem.title}
          </h2>
          {currentItem.description && (
            <p className="text-[clamp(1rem,1.45vw,1.125rem)] text-text-secondary line-clamp-3 mb-[clamp(1rem,3vh,1.5rem)]">
              {currentItem.description}
            </p>
          )}
          <div className="flex gap-[clamp(0.75rem,1.5vw,1rem)]">
            <Focusable
              onEnterPress={() => onPlay(currentItem)}
              onArrowPress={(direction) => {
                if (direction === 'left') return focusSidebarFromHero(direction);
                return focusFirstRowFromHero(direction);
              }}
              autoFocus
              focusKey="hero-play"
              focusedClassName="scale-105 shadow-lg shadow-black/40"
              className="px-[clamp(1.5rem,3vw,2rem)] py-[clamp(0.625rem,1.4vh,0.75rem)] bg-white text-black text-[clamp(0.875rem,1.25vw,1rem)] font-bold rounded-full transition-transform duration-200"
            >
              Reproducir
            </Focusable>
            <Focusable
              onEnterPress={() => onInfo(currentItem)}
              onArrowPress={focusFirstRowFromHero}
              focusKey="hero-info"
              focusedClassName="scale-105 shadow-lg shadow-black/40"
              className="px-[clamp(1.25rem,2.5vw,1.5rem)] py-[clamp(0.625rem,1.4vh,0.75rem)] glass text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium rounded-full transition-transform duration-200"
            >
              Más info
            </Focusable>
          </div>
        </div>

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
