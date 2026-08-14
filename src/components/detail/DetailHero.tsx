import { memo, useMemo } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { LucidePlay, LucideClapperboard, LucidePlus, LucideRotateCcw } from 'lucide-react';
import { formatTime, classNames, resolveBackdrop, resolvePoster, resolveLogo } from '@/utils/helpers';
import { DetailActionButton } from './DetailActionButton';
import type { ContentDetail } from '@/types/content';
import { isTVShow } from '@/types/content';

interface DetailHeroProps {
  content: ContentDetail;
  clientEndpoint?: string;
  canPlay: boolean;
  onPlay: () => void;
  onPlayTrailer?: () => void;
  onToggleList: () => void;
  onNavigateDown: (direction: string) => boolean;
  onNavigateLeft: (direction: string) => boolean;
  onNavigateUp: (direction: string) => boolean;
  onPlayFocus: () => void;
  onHeroFocus: () => void;
  firstEpisodeFocusKey?: string;
  firstSeasonFocusKey?: string;
}

function formatDuration(content: ContentDetail): string | null {
  if (content.duration) return formatTime(content.duration);
  if (content.seasons_count && content.episodes_count) {
    const s = content.seasons_count === 1 ? 'temporada' : 'temporadas';
    const e = content.episodes_count === 1 ? 'episodio' : 'episodios';
    return `${content.seasons_count} ${s} · ${content.episodes_count} ${e}`;
  }
  return null;
}

export const DetailHero = memo(function DetailHero({
  content,
  clientEndpoint,
  canPlay,
  onPlay,
  onPlayTrailer,
  onToggleList,
  onNavigateDown,
  onNavigateLeft,
  onNavigateUp,
  onPlayFocus,
  onHeroFocus,
}: DetailHeroProps) {
  const backdropUrl = resolveBackdrop(content.images, content.banner_resized ?? content.banner ?? content.cover_resized ?? content.cover, clientEndpoint, 'xlarge');
  const posterUrl = resolvePoster(content.images, content.cover_resized ?? content.cover, clientEndpoint);
  const logoUrl = resolveLogo(content.images, clientEndpoint);

  const { ref: heroRef, focusKey: heroFocusKey } = useFocusable({
    focusKey: 'detail-hero',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'detail-hero-play',
  });

  const duration = useMemo(() => formatDuration(content), [content]);

  const hasTrailer = !!(content.trailer_sources?.length || content.trailer_video_sources?.length);

  const continuePercent = useMemo(() => {
    if (!content.continue_watching) return null;
    const { progress, duration: d } = content.continue_watching;
    if (!d) return null;
    return Math.min(100, Math.round((progress / d) * 100));
  }, [content.continue_watching]);

  const contentType = useMemo(() => {
    if (isTVShow(content)) return 'Serie';
    if (content.content_type || content.contentType) return 'Película';
    return null;
  }, [content]);

  const metadataParts = useMemo(() => {
    const parts: string[] = [];
    if (content.year) parts.push(String(content.year));
    if (duration) parts.push(duration);
    if (content.seasons_count && content.episodes_count) {
      const s = content.seasons_count === 1 ? '1 temporada' : `${content.seasons_count} temporadas`;
      const e = content.episodes_count === 1 ? '1 episodio' : `${content.episodes_count} episodios`;
      parts.push(`${s} · ${e}`);
    }
    return parts;
  }, [content.year, duration, content.seasons_count, content.episodes_count]);

  const genreTags = useMemo(
    () => (content.categories ?? []).slice(0, 4).map((c) => c.name),
    [content.categories],
  );

  return (
    <div className="relative w-full overflow-hidden min-h-[clamp(36rem,86vh,60rem)] bg-bg">
      {/* Fondo optimizado: sin blur, menos capas de degradados */}
      <div className="absolute inset-0 content-detail-backdrop">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        {/* Un único degradado horizontal robusto para garantizar la legibilidad del texto */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
      </div>

      {/* Grid de contenido */}
      <div
        className="relative h-full grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_clamp(14rem,22vw,22rem)] items-center
          gap-[clamp(1rem,3vw,3rem)]
          px-[clamp(2rem,5vw,6rem)]
          pt-[clamp(4rem,10vh,8.5rem)]
          pb-[clamp(2rem,5vh,4.5rem)]
          min-h-[clamp(30rem,75vh,60rem)]"
      >
        <FocusContext.Provider value={heroFocusKey}>
          <div
            ref={heroRef as React.RefObject<HTMLDivElement>}
            className="flex flex-col items-start max-w-[46rem]"
          >
            {/* Eyebrow */}
            {contentType && (
              <span className="inline-flex items-center gap-[0.45em] text-accent text-[clamp(0.6875rem,0.85vw,0.75rem)] font-bold uppercase tracking-[0.22em] mb-[clamp(0.75rem,1.6vh,1.125rem)]">
                <span className="w-[6px] h-[6px] rounded-full bg-accent" />
                {contentType}
              </span>
            )}

            {/* Logo / Title (Sin drop-shadows pesados) */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={content.title}
                className="h-[clamp(3rem,7vh,5rem)] max-w-[80%] object-contain object-left mb-[clamp(0.875rem,1.8vh,1.25rem)]"
              />
            ) : (
              <h1
                className={classNames(
                  'font-black text-white leading-[0.98] tracking-[-0.03em]',
                  'text-[clamp(2.5rem,5.2vw,4.25rem)]',
                  'mb-[clamp(0.875rem,1.8vh,1.25rem)]',
                  'max-w-[85%]'
                )}
              >
                {content.title}
              </h1>
            )}

            {/* Chips de Metadatos (Bordes simples, fondo sin blur) */}
            {metadataParts.length > 0 && (
              <div className="flex items-center gap-[clamp(0.5rem,1vw,0.625rem)] mb-[clamp(0.75rem,1.6vh,1rem)] flex-wrap">
                {metadataParts.map((part, i) => (
                  <span
                    key={i}
                    className="px-[clamp(0.625rem,1vw,0.75rem)] py-[clamp(0.25rem,0.5vh,0.3125rem)] rounded bg-black/40 border border-white/20 text-white/90 text-[clamp(0.75rem,1vw,0.8125rem)] font-semibold"
                  >
                    {part}
                  </span>
                ))}
              </div>
            )}

            {/* Géneros */}
            {genreTags.length > 0 && (
              <p className="text-[clamp(0.8125rem,1.05vw,0.9375rem)] text-white/50 mb-[clamp(1rem,2.2vh,1.5rem)] max-w-[clamp(28rem,40vw,44rem)] truncate tracking-wide">
                {genreTags.join('   ·   ')}
              </p>
            )}

            {/* Descripción */}
            {content.description && (
              <p
                className={classNames(
                  'text-[clamp(1rem,1.4vw,1.1875rem)] text-white/80 font-normal',
                  'max-w-[clamp(36rem,48vw,54rem)] leading-[1.5]',
                  'mb-[clamp(1.5rem,3.4vh,2.25rem)]',
                  'line-clamp-3'
                )}
              >
                {content.description}
              </p>
            )}

            {/* Continue watching (Sin backdrop-blur) */}
            {continuePercent != null && (
              <div className="flex items-center gap-[clamp(0.75rem,1.4vw,1rem)] mb-[clamp(1.5rem,3.4vh,2.25rem)] pl-[clamp(0.75rem,1.4vw,1rem)] pr-[clamp(1.25rem,2vw,1.5rem)] py-[clamp(0.625rem,1.2vh,0.8125rem)] rounded-xl bg-black/40 border border-white/10 max-w-[clamp(22rem,32vw,28rem)]">
                <div className="shrink-0 w-[clamp(2rem,4vh,2.5rem)] h-[clamp(2rem,4vh,2.5rem)] rounded-full bg-accent/20 flex items-center justify-center">
                  <LucideRotateCcw size={16} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-[0.3125rem]">
                    <span className="text-[clamp(0.6875rem,0.85vw,0.75rem)] text-white/70 font-semibold uppercase tracking-wide">
                      Continuar viendo
                    </span>
                    <span className="text-[clamp(0.6875rem,0.85vw,0.75rem)] text-white/90 font-bold">
                      {continuePercent}%
                    </span>
                  </div>
                  <div className="h-[4px] bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${continuePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1.125rem)]">
              {canPlay && (
                <DetailActionButton
                  focusKey="detail-hero-play"
                  autoFocus
                  variant="primary"
                  label={
                    content.continue_watching
                      ? 'Reanudar'
                      : isTVShow(content)
                        ? 'Episodio 1'
                        : 'Reproducir'
                  }
                  icon={<LucidePlay size={20} fill="currentColor" />}
                  onEnterPress={onPlay}
                  onFocus={() => {
                    onPlayFocus();
                    onHeroFocus();
                  }}
                  onArrowPress={(dir) => {
                    if (dir === 'left') return onNavigateLeft(dir);
                    if (dir === 'up') return onNavigateUp(dir);
                    if (dir === 'down') return onNavigateDown(dir);
                    return true;
                  }}
                />
              )}
              {hasTrailer && onPlayTrailer && (
                <DetailActionButton
                  focusKey="detail-hero-trailer"
                  variant="secondary"
                  label="Tráiler"
                  icon={<LucideClapperboard size={16} />}
                  onEnterPress={onPlayTrailer}
                  onFocus={onHeroFocus}
                  onArrowPress={(dir) => {
                    if (dir === 'left') return true;
                    if (dir === 'up') return onNavigateUp(dir);
                    if (dir === 'down') return onNavigateDown(dir);
                    return true;
                  }}
                />
              )}
              <DetailActionButton
                focusKey="detail-hero-list"
                variant="ghost"
                label="Mi Lista"
                icon={<LucidePlus size={16} />}
                onEnterPress={onToggleList}
                onFocus={onHeroFocus}
                onArrowPress={(dir) => {
                  if (dir === 'left') return true;
                  if (dir === 'up') return onNavigateUp(dir);
                  if (dir === 'down') return onNavigateDown(dir);
                  return true;
                }}
              />
            </div>
          </div>
        </FocusContext.Provider>

        {/* Panel flotante de arte (Sin sombras pesadas ni reflejos innecesarios) */}
        <div className="hidden md:flex justify-end relative">
          <div
            className="relative rounded-[1.5rem] overflow-hidden border border-white/15 w-[clamp(12rem,18vw,20rem)] aspect-[3/4] bg-surface"
          >
            {(posterUrl ?? backdropUrl) ? (
              <img src={posterUrl ?? backdropUrl} alt="" aria-hidden className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-surface" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        </div>
      </div>

      {/* Fusión con el fondo de la página */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
});