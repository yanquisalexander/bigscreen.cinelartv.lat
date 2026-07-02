import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getExplore } from '@/features/content/explore';
import { resolveImageUrl } from '@/utils/helpers';
import { HeroSection } from '@/components/home/HeroSection';
import { FocusableCard } from '@/components/tv/FocusableCard';
import { FocusableRow } from '@/components/tv/FocusableRow';
import type { ContentItem, ExploreResponse } from '@/types/content';

export function HomeScreen() {
  useSpatialNavInit();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tokens) return;
    try {
      const explore = await getExplore(tokens.accessToken);
      setData(explore);
    } catch {
      // silently fail, show empty state
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePlay = (item: ContentItem) => {
    navigate(`/watch/${item.id}`);
  };

  const handleInfo = (item: ContentItem) => {
    navigate(`/content/${item.id}`);
  };

  const handleRowUp = useCallback((direction: string) => {
    if (direction === 'up') {
      setFocus('hero-section');
      return false; // bloqueamos el default, nosotros ya movimos el foco
    }
    return true; // resto de direcciones: comportamiento normal
  }, []);

  const bannerItems = data?.banner_content ?? [];

  return (
    <div className="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg">
      {loading ? (
        <div className="w-full h-full flex flex-col">
          <div className="w-full h-[70vh] min-h-[500px] bg-surface animate-pulse-slow" />
          <div className="px-16 py-8 space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-6 w-48 bg-surface rounded mb-4 animate-pulse-slow" />
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="w-[280px] h-[160px] bg-surface rounded-xl animate-pulse-slow" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {bannerItems.length > 0 && (
            <HeroSection items={bannerItems} onPlay={handlePlay} onInfo={handleInfo} clientEndpoint={clientEndpoint} />
          )}

          <div className="-mt-20 relative z-10 pb-16">
            {data?.content?.map((category, catIdx) => (
              <FocusableRow key={catIdx} title={category.title} onArrowPress={catIdx === 0 ? handleRowUp : undefined}>
                {category.content?.map((item, itemIdx) => (
                  <FocusableCard
                    key={item.id}
                    title={item.title}
                    image={resolveImageUrl(
                      item.cover ?? item.banner,
                      clientEndpoint,
                    )}
                    subtitle={item.content_type === 'TVSHOW' ? 'Serie' : undefined}
                    progress={item.progress}
                    onEnterPress={() => handleInfo(item)}
                    autoFocus={catIdx === 0 && itemIdx === 0}
                  />
                ))}
              </FocusableRow>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
