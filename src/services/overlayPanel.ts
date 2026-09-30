import { getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
import { useOverlayPanelStore, type PanelConfig, type PanelItem } from '@/stores/overlayPanelStore';
import { generateQrSvg } from '@/utils/qr';

let sequence = 0;
let focusStack: string[] = [];

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
  item: { title: string; subtitle?: string; imageUrl?: string; icon?: string; closeOnSelect?: boolean },
  onSelect?: () => void,
): PanelItem {
  return {
    id: item.title,
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    icon: item.icon,
    closeOnSelect: item.closeOnSelect,
    onSelect,
  };
}

export function overlayMessage(title: string, subtitle?: string): PanelItem {
  return { id: nextId('msg'), title, subtitle, readOnly: true };
}

/**
 * Creates a readOnly panel item that renders an inline QR code.
 * Used on Connected TV so users can scan with their phone.
 */
export function qrItem(
  opts: {
    url: string;
    title?: string;
    subtitle?: string;
    caption?: string;
    size?: number;
  },
): PanelItem {
  const svg = generateQrSvg(opts.url, opts.size ?? 200);
  return {
    id: nextId('qr'),
    title: opts.title ?? '',
    subtitle: opts.subtitle,
    readOnly: true,
    qrSvg: svg,
    qrCaption: opts.caption ?? `Escaneá con tu celular para abrir ${opts.url}`,
  };
}

/**
 * Opens a side panel showing a QR code for the given URL.
 * Typical use: subscribe / paywall flows on TV where there is no browser.
 */
export function showQrPanel(
  opts: {
    title: string;
    subtitle?: string;
    url: string;
    caption?: string;
    closeLabel?: string;
  },
): void {
  showPanel({
    title: opts.title,
    subtitle: opts.subtitle,
    items: [
      qrItem({
        url: opts.url,
        caption: opts.caption,
      }),
      buttonItem({
        title: opts.closeLabel ?? 'Cerrar',
        subtitle: 'Volver al reproductor',
        icon: 'x',
      }),
    ],
  });
}

export function showPanel(
  config: Omit<PanelConfig, 'id'> & { id?: string },
): void {
  focusStack = [getCurrentFocusKey()];
  useOverlayPanelStore.getState().open({ ...config, id: config.id ?? makeId() });
}

export function navigatePanel(
  config: Omit<PanelConfig, 'id'> & { id?: string },
): void {
  focusStack.push(getCurrentFocusKey());
  useOverlayPanelStore.getState().navigate({ ...config, id: config.id ?? makeId() });
}

export function backPanel(): void {
  const didBack = useOverlayPanelStore.getState().back();
  if (!didBack) {
    closePanel();
    return;
  }
  const restoredFocusKey = focusStack.pop()!;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => setFocus(restoredFocusKey));
  });
}

export function updatePanel(config: Omit<PanelConfig, 'id'> & { id: string }): void {
  useOverlayPanelStore.getState().update({ ...config, id: config.id });
}

export function closePanel(options?: { restoreFocus?: boolean }): void {
  useOverlayPanelStore.getState().close();
  if (options?.restoreFocus !== false && focusStack.length > 0) {
    const key = focusStack[0];
    focusStack = [];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFocus(key));
    });
  } else {
    focusStack = [];
  }
}
