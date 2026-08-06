import { useRef, useEffect, type ReactNode } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';

interface FocusableRowProps {
  title?: string;
  children: ReactNode;
  className?: string;
  focusKey?: string;
  preferredChildFocusKey?: string;
}

export function FocusableRow({ title, children, className = '', focusKey, preferredChildFocusKey }: FocusableRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const { ref, focusKey: resolvedFocusKey, hasFocusedChild } = useFocusable({
    focusKey,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey,
  });

  // Vertical: when focus enters this row (from a row above/below),
  // bring the row itself into view in whatever ancestor scrolls vertically.
  useEffect(() => {
    if (hasFocusedChild) {
      scrollRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, [hasFocusedChild]);

  // Horizontal: when the focused card changes within this row,
  // keep it centered in the row's own scroll container.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const focused = el.querySelector<HTMLElement>('[data-focused="true"]');
        if (!focused) return;

        // Calculamos la posición central exacta dentro del contenedor
        const containerWidth = el.clientWidth;
        const cardWidth = focused.clientWidth;
        const cardLeft = focused.offsetLeft;
        
        const scrollLeft = cardLeft - (containerWidth / 2) + (cardWidth / 2);
        
        el.scrollTo({
          left: scrollLeft,
          behavior: 'smooth',
        });
      });
    };

    const observer = new MutationObserver(handleScroll);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <FocusContext.Provider value={resolvedFocusKey}>
      <div className={`mb-[clamp(0.5rem,1.5vh,1rem)] ${className}`}>
        {title && <h2 className="text-[clamp(1rem,1.4vw,1.125rem)] font-bold text-text-primary mb-[clamp(0.25rem,0.6vh,0.5rem)] px-[clamp(3rem,7.5vw,6rem)]">{title}</h2>}
        <div
          ref={(node) => {
            (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className="flex gap-4 px-[clamp(3rem,7.5vw,6rem)] overflow-x-auto hide-scrollbar pt-1 pb-2 snap-x snap-start"
        >
          {children}
        </div>
      </div>
    </FocusContext.Provider>
  );
}
