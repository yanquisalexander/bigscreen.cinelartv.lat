import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getExplore } from '@/features/content/explore';
import { resolveImageUrl } from '@/utils/helpers';
import { HeroSection } from '@/components/home/HeroSection';
import { FocusableCard } from '@/components/tv/FocusableCard';
import { FocusableRow } from '@/components/tv/FocusableRow';
import type { ContentItem, ExploreResponse } from '@/types/content';

export function HomeScreen() {
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

  const bannerItems = data?.banner_content ?? [];
  const firstRowFirstItemId = data?.content?.[0]?.content?.[0]?.id;
  const firstRowFocusKey = firstRowFirstItemId != null ? `home-row-0-item-${firstRowFirstItemId}` : undefined;
  const preferredChildFocusKey = bannerItems.length > 0 ? 'hero-section' : 'home-row-0';
  const { ref, focusKey } = useFocusable({
    focusKey: 'home-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey,
  });

  const focusHeroFromFirstRow = useCallback((direction: string) => {
    if (direction !== 'up' || bannerItems.length === 0) return true;
    setFocus('hero-play');
    return false;
  }, [bannerItems.length]);

  const focusSidebarFromRowStart = useCallback((direction: string) => {
    if (direction !== 'left') return true;
    setFocus('nav-home');
    return false;
  }, []);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg"
      >
        <h1 className="fixed top-6 right-8 text-white text-3xl font-medium z-999">CinelarTV</h1>
        {loading ? (
          <div className="w-full h-full flex flex-col">
            <div className="w-full h-[70vh] min-h-[500px] bg-surface animate-pulse-slow" />
            <div className="px-24 py-8 space-y-8">
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
              <HeroSection
                items={bannerItems}
                onPlay={handlePlay}
                onInfo={handleInfo}
                clientEndpoint={clientEndpoint}
                firstRowFocusKey={firstRowFocusKey}
                sidebarFocusKey="nav-home"
              />
            )}

            <div className="-mt-20 relative z-10 pb-16">
              {data?.content?.map((category, catIdx) => (
                <FocusableRow
                  key={catIdx}
                  title={category.title}
                  focusKey={`home-row-${catIdx}`}
                  className="scroll-smooth"
                  preferredChildFocusKey={
                    category.content?.[0]?.id != null ? `home-row-${catIdx}-item-${category.content[0].id}` : undefined
                  }
                >
                  {category.content?.map((item, itemIdx) => (
                    <FocusableCard
                      key={item.id}
                      focusKey={`home-row-${catIdx}-item-${item.id}`}
                      title={item.title}
                      image={resolveImageUrl(
                        item.cover_resized ?? item.banner_resized,
                        clientEndpoint,
                      )}
                      subtitle={item.content_type === 'TVSHOW' ? 'Serie' : undefined}
                      progress={item.progress}
                      onArrowPress={(direction) => {
                        if (catIdx === 0 && direction === 'up') return focusHeroFromFirstRow(direction);
                        if (itemIdx === 0 && direction === 'left') return focusSidebarFromRowStart(direction);
                        return true;
                      }}
                      onEnterPress={() => handleInfo(item)}
                    />
                  ))}
                </FocusableRow>
              ))}
            </div>
          </>
        )}
      </div>
    </FocusContext.Provider>
  );
}
