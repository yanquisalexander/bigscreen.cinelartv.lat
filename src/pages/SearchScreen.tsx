import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { FocusableRow } from '@/components/tv/FocusableRow';
import { FocusableCard } from '@/components/tv/FocusableCard';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { searchContent } from '@/features/content/search';
import { resolveImageUrl, classNames } from '@/utils/helpers';
import { LucideSearch, LucideX } from 'lucide-react';
import type { ContentItem } from '@/types/content';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const DEBOUNCE_MS = 300;

export function SearchScreen() {
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { ref, focusKey } = useFocusable({
    focusKey: 'search-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'sk-A',
  });

  const doSearch = useCallback(async (q: string) => {
    if (!tokens || !q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchContent(tokens.accessToken, q);
      const all = data.data ?? [];
      setResults(all);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleKeyPress = useCallback((char: string) => {
    setQuery((prev) => prev + char.toLowerCase());
  }, []);

  const handleBackspace = useCallback(() => {
    setQuery((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, []);

  const handleSpace = useCallback(() => {
    handleKeyPress(' ');
  }, [handleKeyPress]);

  const handleInfo = useCallback((item: ContentItem) => {
    navigate(`/content/${item.id}`);
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (['XF86Back', 'GoBack', 'BrowserBack', 'Escape'].includes(e.key)) {
        e.preventDefault();
        navigate('/home');
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (query) {
          handleBackspace();
        } else {
          navigate('/home');
        }
        return;
      }
      if (e.key === 'Enter') return;
      if (e.key === ' ') {
        e.preventDefault();
        handleSpace();
        return;
      }
      if (e.key.length === 1 && /^[a-zA-Z0-9ñÑáéíóúü ]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [query, navigate, handleKeyPress, handleBackspace, handleSpace]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg px-[clamp(2rem,4vw,4rem)] py-[clamp(1.5rem,3vh,2.5rem)]"
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <LucideSearch size={22} className="text-white/50 flex-shrink-0" />
            <div className="flex-1 text-white text-[clamp(1.125rem,1.6vw,1.5rem)] font-semibold tracking-wide min-h-[1.8em] border-b border-white/20 pb-1.5 break-all">
              {query || <span className="text-white/25 font-normal">Buscar películas y series…</span>}
              <span className="inline-block w-[2px] h-[1em] bg-accent ml-0.5 animate-pulse align-middle" />
            </div>
            {query && (
              <Focusable
                onEnterPress={handleClear}
                focusKey="sk-clear-btn"
                focusedClassName="bg-white/20"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 transition-colors flex-shrink-0"
              >
                <LucideX size={18} />
              </Focusable>
            )}
          </div>

          <div className="space-y-1.5 mb-6">
            {KEYBOARD_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex justify-center gap-[clamp(0.2rem,0.35vw,0.4rem)]">
                {row.map((char, charIdx) => (
                  <Focusable
                    key={char}
                    focusKey={`sk-${char}`}
                    onEnterPress={() => handleKeyPress(char)}
                    onArrowPress={(direction) => {
                      if (direction !== 'left' || charIdx !== 0) return true;
                      setFocus('nav-home');
                      return false;
                    }}
                    focusedClassName="!bg-white !text-black scale-110"
                    className={classNames(
                      'w-[clamp(2rem,2.8vw,2.8rem)] h-[clamp(2rem,2.8vw,2.8rem)]',
                      'rounded-lg flex items-center justify-center',
                      'text-[clamp(0.875rem,1.2vw,1.125rem)] font-semibold',
                      'bg-white/15 text-white transition-all duration-100',
                      'cursor-pointer select-none',
                    )}
                  >
                    {char}
                  </Focusable>
                ))}
              </div>
            ))}

            <div className="flex justify-center gap-[clamp(0.2rem,0.35vw,0.4rem)]">
              <Focusable
                focusKey="sk-space"
                onEnterPress={handleSpace}
                onArrowPress={(direction) => {
                  if (direction !== 'left') return true;
                  setFocus('nav-home');
                  return false;
                }}
                focusedClassName="bg-white text-black scale-105"
                className={classNames(
                  'w-[clamp(6rem,10vw,8rem)] h-[clamp(2rem,2.8vw,2.8rem)]',
                  'rounded-lg flex items-center justify-center',
                  'text-[clamp(0.75rem,1vw,0.875rem)] font-medium',
                  'bg-white/15 text-white/70 transition-all duration-100',
                  'cursor-pointer select-none',
                )}
              >
                Espacio
              </Focusable>
              <Focusable
                focusKey="sk-bs"
                onEnterPress={handleBackspace}
                focusedClassName="bg-white text-black scale-105"
                className={classNames(
                  'w-[clamp(2.5rem,3.5vw,3.5rem)] h-[clamp(2rem,2.8vw,2.8rem)]',
                  'rounded-lg flex items-center justify-center',
                  'text-[clamp(0.875rem,1.2vw,1.125rem)] font-semibold',
                  'bg-white/15 text-white transition-all duration-100',
                  'cursor-pointer select-none',
                )}
              >
                ⌫
              </Focusable>
              <Focusable
                focusKey="sk-clear"
                onEnterPress={handleClear}
                focusedClassName="bg-white/30 text-white scale-105"
                className={classNames(
                  'w-[clamp(3rem,4.5vw,4.5rem)] h-[clamp(2rem,2.8vw,2.8rem)]',
                  'rounded-lg flex items-center justify-center',
                  'text-[clamp(0.65rem,0.9vw,0.8rem)] font-semibold',
                  'bg-white/15 text-white/50 transition-all duration-100',
                  'cursor-pointer select-none',
                )}
              >
                Limpiar
              </Focusable>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && query.trim() && (
          <div className="text-center py-16">
            <p className="text-white/40 text-lg">Sin resultados para "{query}"</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <FocusableRow title="Resultados" focusKey="search-results">
            {results.map((item) => (
              <FocusableCard
                key={item.id}
                title={item.title}
                image={resolveImageUrl(item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover, clientEndpoint)}
                subtitle={item.content_type === 'TVSHOW' ? 'Serie' : undefined}
                onEnterPress={() => handleInfo(item)}
                focusKey={`search-result-${item.id}`}
              />
            ))}
          </FocusableRow>
        )}
      </div>
    </FocusContext.Provider>
  );
}
