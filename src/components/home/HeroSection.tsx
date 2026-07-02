import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { resolveImageUrl } from '@/utils/helpers';
import type { ContentItem } from '@/types/content';

interface HeroSectionProps {
  items: ContentItem[];
  onPlay: (item: ContentItem) => void;
  onInfo: (item: ContentItem) => void;
  clientEndpoint: string;
}

export function HeroSection({ items, onPlay, onInfo, clientEndpoint }: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { ref: heroRef, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'hero-section',
    trackChildren: true,
  });

  const currentItem = items[currentIndex];

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex((index + items.length) % items.length);
    },
    [items.length],
  );

  // Auto-avanza solo si nadie dentro del hero tiene el foco
  useEffect(() => {
    if (items.length <= 1 || hasFocusedChild) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length, hasFocusedChild]);

  if (!currentItem) return null;

  const imageUrl = resolveImageUrl(currentItem.banner ?? currentItem.cover, clientEndpoint);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={heroRef as React.RefObject<HTMLDivElement>}
        className="relative w-full h-[70vh] min-h-[500px] overflow-hidden"
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === currentIndex ? 1 : 0 }}
          >
            {item.banner || item.cover ? (
              <img src={imageUrl!} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/30 to-bg" />
            )}
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/30" />

        <div className="absolute bottom-20 left-16 max-w-xl z-10">
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-4 drop-shadow-lg">
            {currentItem.title}
          </h2>
          {currentItem.description && (
            <p className="text-lg text-text-secondary line-clamp-3 mb-6">
              {currentItem.description}
            </p>
          )}
          <div className="flex gap-4">
            <Focusable
              onEnterPress={() => onPlay(currentItem)}
              autoFocus
              focusKey="hero-play"
              focusedClassName="scale-105 shadow-lg shadow-black/40"
              className="px-10 py-4 bg-white text-black text-lg font-bold rounded-full transition-transform duration-200"
            >
              Reproducir
            </Focusable>
            <Focusable
              onEnterPress={() => onInfo(currentItem)}
              focusKey="hero-info"
              focusedClassName="scale-105 shadow-lg shadow-black/40"
              className="px-8 py-4 glass text-white text-lg font-medium rounded-full transition-transform duration-200"
            >
              Más info
            </Focusable>
          </div>
        </div>

        {items.length > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {items.map((_, i) => (
              <Focusable
                key={i}
                focusKey={`hero-dot-${i}`}
                onEnterPress={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-white w-6' : 'bg-white/40'
                  }`}
              >
                <span className="sr-only">Slide {i + 1}</span>
              </Focusable>
            ))}
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}