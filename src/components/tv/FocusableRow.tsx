import { useRef, useEffect, type ReactNode } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

interface FocusableRowProps {
  title?: string;
  children: ReactNode;
  className?: string;
  focusKey?: string;
  onArrowPress?: (direction: string) => boolean;
}

export function FocusableRow({ title, children, className = '', focusKey, onArrowPress }: FocusableRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const { ref } = useFocusable({
    focusKey,
    trackChildren: true,
    onArrowPress: (direction) => onArrowPress?.(direction) ?? true, // true = dejar que la navegación por defecto continúe
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const focused = el.querySelector('[data-focused="true"]');
      if (focused) {
        const card = focused as HTMLElement;
        const cardRect = card.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        const offset = cardRect.left - containerRect.left - (containerRect.width / 2) + (cardRect.width / 2);
        el.scrollBy({ left: offset, behavior: 'smooth' });
        rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    const observer = new MutationObserver(handleScroll);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rowRef} className={`mb-8 ${className}`}>
      {title && <h2 className="text-xl font-bold text-text-primary mb-4 px-16">{title}</h2>}
      <div
        ref={(node) => {
          (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className="flex gap-3 px-16 overflow-x-auto hide-scrollbar py-2"
      >
        {children}
      </div>
    </div>
  );
}