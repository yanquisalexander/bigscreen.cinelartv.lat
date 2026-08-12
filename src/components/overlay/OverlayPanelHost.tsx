import { useEffect, useRef, useState } from 'react';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useOverlayPanelStore, type PanelConfig, type PanelItem } from '@/stores/overlayPanelStore';
import { closePanel, backPanel } from '@/services/overlayPanel';
import { Focusable } from '@/components/tv/Focusable';
import { isBackKey } from '@/utils/helpers';
import {
  Info,
  Settings,
  Play,
  Volume2,
  Shield,
  Palette,
  LucideRotateCcw,
  LogIn,
  User,
  Tv,
  Star,
  Search,
  Check,
  X,
  ChevronRight,
  Download,
  RefreshCw,
  MapPin,
} from 'lucide-react';

const ICON_MAP: Record<string, typeof Info> = {
  info: Info,
  settings: Settings,
  play: Play,
  volume: Volume2,
  shield: Shield,
  palette: Palette,
  rotate: LucideRotateCcw,
  login: LogIn,
  user: User,
  tv: Tv,
  star: Star,
  search: Search,
  check: Check,
  x: X,
  chevronRight: ChevronRight,
  download: Download,
  refresh: RefreshCw,
  mapPin: MapPin,
};

// Registered at module load (before any React render, so before any screen
// registers its back handlers via InputManager or window listeners). Capture
// phase + stopImmediatePropagation guarantee that while a panel is open, back
// only closes the panel and nothing else (no navigation, no sidebar focus).
let backListenerRegistered = false;

function ensureBackListener() {
  if (backListenerRegistered) return;
  backListenerRegistered = true;

  const handleBack = (e: KeyboardEvent) => {
    if (!isBackKey(e)) return;
    if (!useOverlayPanelStore.getState().panel) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    backPanel();
  };

  window.addEventListener('keydown', handleBack, true);
}

ensureBackListener();

export function OverlayPanelHost() {
  const panel = useOverlayPanelStore((s) => s.panel);
  const [animState, setAnimState] = useState<'in' | 'out' | 'hidden'>('hidden');
  const [lastPanel, setLastPanel] = useState<PanelConfig | null>(null);

  useEffect(() => {
    if (panel) {
      setLastPanel(panel);
      setAnimState('in');
    } else if (animState === 'in') {
      setAnimState('out');
      const timer = setTimeout(() => setAnimState('hidden'), 220);
      return () => clearTimeout(timer);
    }
  }, [panel, animState]);

  if (animState === 'hidden' || !lastPanel) return null;

  return (
    <div
      className={classNames(
        'fixed top-0 right-0 z-[9980]',
        animState === 'in' ? 'animate-panel-in' : 'animate-panel-out',
      )}
      style={{
        top: '1.5rem',
        right: '1.5rem',
        bottom: '1.5rem',
        width: 'clamp(19rem, 26vw, 25.5rem)',
      }}
    >
      <PanelContent panel={lastPanel} />
    </div>
  );
}

function PanelContent({ panel }: { panel: PanelConfig }) {
  const listRef = useRef<HTMLDivElement>(null);

  const { ref, focusKey } = useFocusable({
    focusKey: 'overlay-panel',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: panel.items.length > 0 ? `panel-item-${panel.items[0].id}` : undefined,
  });

  useEffect(() => {
    if (panel.items.length > 0) {
      setFocus(`panel-item-${panel.items[0].id}`);
    }
  }, [panel.id, panel.items]);

  const scrollItemIntoView = (itemId: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-focus-key="panel-item-${itemId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-full flex flex-col bg-[#181818] rounded-[1.5rem] p-6 overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]"
      >
        {/* header */}
        <div className="shrink-0 mb-6">
          {panel.headerImageUrl && (
            <img
              src={panel.headerImageUrl}
              alt=""
              className="w-[clamp(3rem,6vw,4.5rem)] h-[clamp(3rem,6vw,4.5rem)] rounded-2xl object-cover mb-4"
            />
          )}
          <h2 className="text-white text-[clamp(1.375rem,2.4vw,1.75rem)] font-semibold leading-tight">
            {panel.title}
          </h2>
          {panel.subtitle && (
            <p className="text-text-secondary text-[clamp(0.875rem,1.1vw,1rem)] mt-2 leading-snug">
              {panel.subtitle}
            </p>
          )}
        </div>

        {/* item list */}
        <div ref={listRef} className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-2">
          {panel.items.map((item) =>
            item.readOnly ? (
              <PanelMessage key={item.id} item={item} />
            ) : (
              <PanelItemRow
                key={item.id}
                item={item}
                isFirst={panel.items[0].id === item.id}
                isLast={panel.items[panel.items.length - 1].id === item.id}
                onFocus={() => scrollItemIntoView(item.id)}
              />
            ),
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

function PanelItemRow({
  item,
  isFirst,
  isLast,
  onFocus,
}: {
  item: PanelItem;
  isFirst: boolean;
  isLast: boolean;
  onFocus: () => void;
}) {
  const Icon = item.icon ? ICON_MAP[item.icon] : undefined;

  return (
    <Focusable
      focusKey={`panel-item-${item.id}`}
      onEnterPress={() => {
        item.onSelect?.();
        if (item.closeOnSelect !== false) {
          closePanel();
        }
      }}
      onFocus={onFocus}
      onArrowPress={(direction) => {
        if (direction === 'up' && isFirst) return false;
        if (direction === 'down' && isLast) return false;
        if (direction === 'left' || direction === 'right') return false;
        return true;
      }}
      focusedClassName="bg-white/12 border-white/40"
      className="flex items-center gap-3 w-full rounded-xl border border-transparent px-4 py-3 cursor-pointer"
      playSound
    >
      {(item.imageUrl || Icon) && (
        <span className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-surface flex-shrink-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            Icon && <Icon className="w-5 h-5 text-white/70" />
          )}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-[clamp(0.9375rem,1.15vw,1.0625rem)] font-medium truncate">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-text-secondary text-[clamp(0.8125rem,0.95vw,0.875rem)] mt-0.5 truncate">
            {item.subtitle}
          </p>
        )}
      </div>
    </Focusable>
  );
}

function PanelMessage({ item }: { item: PanelItem }) {
  return (
    <div className="px-4 py-3">
      <p className="text-white/85 text-[clamp(0.875rem,1.05vw,0.9375rem)] leading-snug">
        {item.title}
      </p>
      {item.subtitle && (
        <p className="text-text-secondary text-[clamp(0.8125rem,0.95vw,0.875rem)] mt-1 leading-snug">
          {item.subtitle}
        </p>
      )}
    </div>
  );
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
