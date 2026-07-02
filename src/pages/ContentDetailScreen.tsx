import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getContentById } from '@/features/content/api';
import { resolveImageUrl } from '@/utils/helpers';
import { FocusableButton } from '@/components/tv/FocusableButton';
import { Focusable } from '@/components/tv/Focusable';
import type { ContentDetail, Season } from '@/types/content';
import "@m3e/web/loading-indicator";
import { M3eLoadingIndicator } from "@m3e/react/loading-indicator";


export function ContentDetailScreen() {
  useSpatialNavInit();
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(0);

  useEffect(() => {
    if (!tokens || !contentId) return;
    setLoading(true);
    getContentById(tokens.accessToken, contentId)
      .then(setContent)
      .finally(() => setLoading(false));
  }, [tokens, contentId]);

  const handlePlay = useCallback(() => {
    if (!content) return;
    const episodeId = content.continue_watching?.episode_id;
    if (episodeId) {
      navigate(`/watch/${content.id}/${episodeId}`);
    } else {
      navigate(`/watch/${content.id}`);
    }
  }, [content, navigate]);

  const handlePlayEpisode = useCallback(
    (episodeId: string | number) => {
      navigate(`/watch/${contentId}/${episodeId}`);
    },
    [contentId, navigate],
  );

  if (loading) {
    return (
      <div className="w-full h-full bg-bg flex items-center justify-center">
        {/* @ts-ignore */}
        <M3eLoadingIndicator style={{
          "--m3e-loading-indicator-active-indicator-color": "#ddd",
        }} />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="w-full h-full bg-bg flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary text-xl">Contenido no encontrado</p>
        <FocusableButton onEnterPress={() => navigate('/home')} autoFocus>
          Volver al inicio
        </FocusableButton>
      </div>
    );
  }

  const backdropUrl = resolveImageUrl(content.banner ?? content.cover, clientEndpoint);
  const seasons = content.seasons ?? [];
  const categories = content.categories ?? [];

  return (
    <div className="w-full h-full overflow-y-auto bg-bg">
      <div className="relative w-full h-[50vh] min-h-[400px]">
        {backdropUrl ? (
          <img src={backdropUrl} alt={content.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/30 to-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />

        <Focusable
          onEnterPress={() => navigate(-1)}
          className="absolute top-8 left-8 z-20"
          autoFocus
        >
          <div className="glass rounded-full px-4 py-2 text-white flex items-center gap-2">
            <span className="text-xl">&larr;</span>
            <span>Volver</span>
          </div>
        </Focusable>
      </div>

      <div className="px-16 -mt-32 relative z-10 pb-16">
        <h1 className="text-5xl font-extrabold text-white mb-4">{content.title}</h1>

        <div className="flex items-center gap-4 text-text-secondary text-lg mb-6">
          {content.year && <span>{content.year}</span>}
          {content.liked && (
            <span className="text-accent-light">&hearts;</span>
          )}
          {content.content_type && (
            <span className="px-2 py-0.5 border border-text-secondary rounded text-sm">
              {content.content_type === 'TVSHOW' ? 'Serie' : 'Película'}
            </span>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 mb-6">
            {categories.map((cat) => (
              <span key={cat.id} className="px-3 py-1 bg-surface rounded-full text-sm text-text-secondary">
                {cat.name}
              </span>
            ))}
          </div>
        )}

        {content.description && (
          <p className="text-lg text-text-secondary max-w-3xl mb-8 leading-relaxed">
            {content.description}
          </p>
        )}

        <div className="flex gap-4 mb-12">
          <FocusableButton onEnterPress={handlePlay} autoFocus variant="primary" size="lg">
            Reproducir
          </FocusableButton>
          <FocusableButton onEnterPress={() => { }} variant="secondary" size="lg">
            + Mi Lista
          </FocusableButton>
        </div>

        {seasons.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-white mb-6">Temporadas</h2>
            <div className="flex gap-3 mb-6">
              {seasons.map((season: Season, i: number) => (
                <Focusable
                  key={season.id}
                  onEnterPress={() => setSelectedSeason(i)}
                  className={`px-5 py-2.5 rounded-full text-lg font-medium transition-colors ${selectedSeason === i
                    ? 'bg-white text-black'
                    : 'bg-surface text-text-secondary'
                    }`}
                >
                  {season.title}
                </Focusable>
              ))}
            </div>

            <div className="space-y-3">
              {seasons[selectedSeason]?.episodes?.map((episode) => {
                const epThumb = resolveImageUrl(episode.thumbnail ?? episode.thumbnail_resized, clientEndpoint);

                return (
                  <Focusable
                    key={episode.id}
                    onEnterPress={() => handlePlayEpisode(episode.id)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface hover:bg-surface-elevated transition-colors"
                  >
                    <span className="text-text-tertiary text-lg w-8">{episode.position ?? '—'}</span>
                    {epThumb && (
                      <img
                        src={epThumb}
                        alt={episode.title}
                        className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{episode.title}</p>
                      {episode.description && (
                        <p className="text-text-secondary text-sm line-clamp-2 mt-1">
                          {episode.description}
                        </p>
                      )}
                    </div>
                    {episode.continue_watching && (
                      <span className="text-text-secondary text-sm flex-shrink-0">
                        {Math.round(
                          (episode.continue_watching.progress / episode.continue_watching.duration) * 100,
                        )}%
                      </span>
                    )}
                  </Focusable>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
