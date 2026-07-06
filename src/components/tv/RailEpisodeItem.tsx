import { memo, useCallback } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';
import { LucidePlay } from 'lucide-react';
import type { WatchEpisode } from '@/types/content';

const ACCENT = '#FFFFFF';

export type FlatEpisode = WatchEpisode & { seasonNumber: number };

/* ─── Tarjeta individual del carrusel de episodios ───
   Usa useFocusable directamente (en vez del wrapper Focusable) porque
   necesitamos el callback onFocus real de norigin-spatial-navigation
   para centrar el scroll cuando el foco llega vía mando (flechas),
   no solo al hacer click/enter.
   Memoizado: con onSelect/onCenter/registerNode estables, esta card no
   vuelve a renderizar salvo que cambien sus propias props. */

export const RailEpisodeItem = memo(function RailEpisodeItem({
    episode: ep,
    index,
    isActive,
    expanded,
    showSeasonEyebrow,
    thumbUrl,
    onSelect,
    onCenter,
    registerNode,
}: {
    episode: FlatEpisode;
    index: number;
    isActive: boolean;
    expanded: boolean;
    showSeasonEyebrow: boolean;
    thumbUrl: string | null | undefined;
    onSelect: (epId: string | number) => void;
    onCenter: (ep: FlatEpisode) => void;
    registerNode: (id: string, node: HTMLDivElement | null) => void;
}) {
    const handleSelect = useCallback(() => onSelect(ep.id), [onSelect, ep.id]);
    const handleCenter = useCallback(() => onCenter(ep), [onCenter, ep]);
    const handleRegisterNode = useCallback(
        (node: HTMLDivElement | null) => registerNode(String(ep.id), node),
        [registerNode, ep.id],
    );

    const { ref, focused } = useFocusable({
        focusKey: `rail-ep-item-${ep.id}`,
        onEnterPress: handleSelect,
        onFocus: handleCenter,
    });

    const cardWidth = expanded ? 'clamp(180px, 13.5vw, 260px)' : 'clamp(156px, 11.5vw, 220px)';
    const cardHeight = expanded ? 'clamp(101px, 7.6vw, 146px)' : 'clamp(88px, 6.5vw, 124px)';

    return (
        <div
            ref={ref as React.RefObject<HTMLDivElement>}
            onClick={handleSelect}
            className={classNames(
                'snap-center flex-shrink-0 transition-all duration-300 cursor-pointer',
                focused && 'scale-105',
            )}
            style={{ width: cardWidth }}
        >
            <div
                ref={handleRegisterNode}
                className={classNames(
                    'relative bg-neutral-900 transition-all duration-300 rounded-xl overflow-hidden',
                    focused && 'ring-2 ring-white/80 shadow-lg shadow-black/40',
                )}
                style={{
                    width: cardWidth,
                    height: cardHeight,
                }}
            >
                {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                        <LucidePlay size={22} className="text-neutral-600" />
                    </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Active indicator */}
                {isActive && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                            <div className="flex items-end gap-[2px] h-3.5">
                                <div className="w-[2.5px] h-2 rounded-full animate-pulse" style={{ backgroundColor: '#000' }} />
                                <div className="w-[2.5px] h-3.5 rounded-full animate-pulse [animation-delay:0.15s]" style={{ backgroundColor: '#000' }} />
                                <div className="w-[2.5px] h-2.5 rounded-full animate-pulse [animation-delay:0.3s]" style={{ backgroundColor: '#000' }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Episode number badge */}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-semibold text-white/80 tabular-nums">
                    {showSeasonEyebrow ? `T${ep.seasonNumber} · ` : ''}E{index + 1}
                </div>
            </div>

            <div className="mt-2 px-0.5">
                <p className={classNames(
                    'text-[13px] font-medium leading-snug truncate transition-colors duration-200',
                    isActive ? 'text-white' : focused ? 'text-white/90' : 'text-white/65',
                )}>
                    {ep.title}
                </p>
                {isActive && (
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: ACCENT }}>
                        Reproduciendo
                    </p>
                )}
            </div>
        </div>
    );
});