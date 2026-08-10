import { getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useOverlayPanelStore, type PanelConfig, type PanelItem } from '@/stores/overlayPanelStore';

let sequence = 0;
let previousFocusKey: string | null = null;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return nextId('panel');
}

export function buttonItem(
  item: { title: string; subtitle?: string; imageUrl?: string; icon?: string },
  onSelect?: () => void,
): PanelItem {
  return {
    id: item.title,
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    icon: item.icon,
    onSelect,
  };
}

export function overlayMessage(title: string, subtitle?: string): PanelItem {
  return { id: nextId('msg'), title, subtitle, readOnly: true };
}

export function showPanel(
  config: Omit<PanelConfig, 'id'> & { id?: string },
): void {
  previousFocusKey = getCurrentFocusKey();
  useOverlayPanelStore.getState().open({ ...config, id: config.id ?? makeId() });
}

export function updatePanel(config: Omit<PanelConfig, 'id'> & { id: string }): void {
  useOverlayPanelStore.getState().update({ ...config, id: config.id });
}

export function closePanel(): void {
  useOverlayPanelStore.getState().close();
  // Restore focus to whatever had it before the panel opened (POPUP_BACK
  // behavior). Double rAF lets React commit the close (panel -> null, animate
  // out) before norigin re-applies focus to the target focusable.
  if (previousFocusKey) {
    const key = previousFocusKey;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFocus(key));
    });
  }
  previousFocusKey = null;
}
