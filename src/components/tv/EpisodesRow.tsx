import { useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';
import { RailEpisodeItem, type FlatEpisode } from './RailEpisodeItem';

export type EpisodeWithThumb = { ep: FlatEpisode; thumbUrl: string | null | undefined };

/* ─── Episodes Row (carrusel horizontal siempre visible, estilo YouTube TV) ───
   Vive dentro del scrim inferior junto al resto de los controles: aparece y
   desaparece con ellos (showControls), no requiere un botón para abrirla.
   Memoizado: no debe re-renderizar cuando cambia playerState/currentTime. */

export const EpisodesRow = memo(function EpisodesRow({
    episodes,
    currentIndex,
    expanded,
    onSelect,
    onExpandChange,
    onFocusedEpisodeChange,
}: {
    episodes: EpisodeWithThumb[];
    currentIndex: number;
    expanded: boolean;
    onSelect: (epId: string | number) => void;
    onExpandChange: (expanded: boolean) => void;
    onFocusedEpisodeChange: (ep: FlatEpisode | null) => void;
}) {
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const railViewportRef = useRef<HTMLDivElement>(null);

    const { ref: rowRef, focusKey, hasFocusedChild } = useFocusable({
        focusKey: 'episodes-rail',
        trackChildren: true,
        saveLastFocusedChild: true,
        preferredChildFocusKey: currentIndex >= 0 ? `rail-ep-item-${episodes[currentIndex]?.ep.id}` : undefined,
    });

    // Reportar hacia arriba si el foco está dentro de la fila: esto es lo que
    // dispara el cross-fade seekbar <-> título/descripción en el padre.
    useEffect(() => {
        onExpandChange(hasFocusedChild);
        if (!hasFocusedChild) onFocusedEpisodeChange(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasFocusedChild]);

    const centerItem = useCallback((ep: FlatEpisode) => {
        const viewport = railViewportRef.current;
        const el = itemRefs.current.get(String(ep.id));
        if (viewport && el) {
            const viewportRect = viewport.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const scrollTarget = viewport.scrollLeft + (elRect.left - viewportRect.left) - (viewportRect.width - elRect.width) / 2;
            viewport.scrollTo({ left: scrollTarget, behavior: 'smooth' });
        }
        onFocusedEpisodeChange(ep);
    }, [onFocusedEpisodeChange]);

    // registerNode estable por id: evita romper la memoización de RailEpisodeItem.
    const registerNode = useCallback((id: string, node: HTMLDivElement | null) => {
        if (node) itemRefs.current.set(id, node);
        else itemRefs.current.delete(id);
    }, []);

    // Centrar el episodio actual al montar (sin animación, ya arranca centrado)
    useEffect(() => {
        if (currentIndex < 0) return;
        const ep = episodes[currentIndex]?.ep;
        if (!ep) return;
        const viewport = railViewportRef.current;
        const el = itemRefs.current.get(String(ep.id));
        if (viewport && el) {
            const viewportRect = viewport.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const scrollTarget = viewport.scrollLeft + (elRect.left - viewportRect.left) - (viewportRect.width - elRect.width) / 2;
            viewport.scrollTo({ left: scrollTarget, behavior: 'auto' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const seasonCount = useMemo(() => new Set(episodes.map((e) => e.ep.seasonNumber)).size, [episodes]);

    return (
        <FocusContext.Provider value={focusKey}>
            <div
                ref={rowRef as React.RefObject<HTMLDivElement>}
                data-episode-rail
                className={classNames('w-full transition-transform duration-300', expanded ? 'mt-[clamp(0.5rem,1.8vh,1rem)]' : 'mt-[clamp(1rem,3.5vh,2rem)]')}
            >
                <div
                    ref={railViewportRef}
                    className="w-full relative flex gap-[clamp(0.625rem,1.5vw,0.875rem)] overflow-x-auto p-[clamp(0.5rem,1.4vw,0.75rem)] snap-x snap-proximity hide-scrollbar scroll-smooth"
                    style={{ scrollPaddingInline: 'clamp(2rem, 4vw, 3rem)' }}
                >
                    {episodes.map(({ ep, thumbUrl }, index) => (
                        <RailEpisodeItem
                            key={ep.id}
                            episode={ep}
                            index={index}
                            isActive={index === currentIndex}
                            expanded={expanded}
                            showSeasonEyebrow={seasonCount > 1}
                            thumbUrl={thumbUrl}
                            onSelect={onSelect}
                            onCenter={centerItem}
                            registerNode={registerNode}
                        />
                    ))}
                </div>
            </div>
        </FocusContext.Provider>
    );
});