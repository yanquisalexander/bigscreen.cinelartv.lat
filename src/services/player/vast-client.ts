import type { VastAd, VastMediaFile } from '@/types/vast';
import { getCachedIp } from '@/services/ip-info';

const MAX_WRAPPER_DEPTH = 5;
const MAX_RETRIES = 2;

type PlaceholderFn = () => string;
type VastAdInternal = VastAd & { _wrapperUrl?: string };

// ─── Safe env ────────────────────────────────────────────────────────────────
const safeWin = () => {
  try { return typeof window !== 'undefined' ? window : undefined; } catch { return undefined; }
};
const safeDoc = () => {
  try { return typeof document !== 'undefined' ? document : undefined; } catch { return undefined; }
};
const safeNav = () => {
  try { return typeof navigator !== 'undefined' ? navigator : undefined; } catch { return undefined; }
};

function getCachedIpSafe(): string {
  try {
    const ip = getCachedIp?.();
    if (!ip || ip === 'undefined' || ip === 'null') return '';
    return encodeURIComponent(String(ip));
  } catch { return ''; }
}

// ─── Placeholder registry ────────────────────────────────────────────────────
const PLACEHOLDERS: Record<string, PlaceholderFn> = {
  DESCRIPTION_URL: () => { try { return encodeURIComponent(safeWin()?.location.href ?? ''); } catch { return ''; } },
  PAGE_URL: () => { try { return encodeURIComponent(safeWin()?.location.href ?? ''); } catch { return ''; } },
  DOMAIN: () => { try { return encodeURIComponent(safeWin()?.location.hostname ?? ''); } catch { return ''; } },
  REFERRER: () => { try { return encodeURIComponent(safeDoc()?.referrer ?? ''); } catch { return ''; } },
  APP_NAME: () => encodeURIComponent('CineLar'),
  PLAYER_WIDTH: () => String(safeWin()?.innerWidth || 1280),
  PLAYER_HEIGHT: () => String(safeWin()?.innerHeight || 720),
  WIDTH: () => String(safeWin()?.innerWidth || 1280),
  HEIGHT: () => String(safeWin()?.innerHeight || 720),
  USER_AGENT: () => { try { return encodeURIComponent(safeNav()?.userAgent ?? ''); } catch { return ''; } },
  DEVICEUA: () => { try { return encodeURIComponent(safeNav()?.userAgent ?? ''); } catch { return ''; } },
  UA: () => { try { return encodeURIComponent(safeNav()?.userAgent ?? ''); } catch { return ''; } },
  LANGUAGE: () => { try { return encodeURIComponent(safeNav()?.language || 'es'); } catch { return 'es'; } },
  IP: () => getCachedIpSafe(),
  DEVICEIP: () => getCachedIpSafe(),
  CLIENT_IP: () => getCachedIpSafe(),
};

export function registerPlaceholder(key: string, fn: PlaceholderFn): void {
  PLACEHOLDERS[key.toUpperCase()] = fn;
}

/** Unificado: 1 cachebuster por request, maneja ERRORCODE */
function resolveUrl(rawUrl: string, errorCode?: string): string {
  if (!rawUrl) return rawUrl;
  const cacheBuster = String(Math.floor(Math.random() * 1e10));
  const ts = String(Date.now());

  return rawUrl.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, key: string) => {
    const upper = key.toUpperCase();
    if (['CACHEBUSTER', 'CACHE_BUSTER', 'CB'].includes(upper)) return cacheBuster;
    if (['TIMESTAMP', 'TIMESTAMP_ISO'].includes(upper)) return ts;
    if (upper === 'ERRORCODE') return errorCode != null ? String(errorCode) : '';
    if (upper === 'TIMESTAMP' || key === 'timestamp') return ts; // compat

    const fn = PLACEHOLDERS[upper] ?? PLACEHOLDERS[key];
    if (fn) {
      try {
        const v = fn();
        if (v == null || v === 'undefined' || v === 'null') return '';
        return v;
      } catch { return ''; }
    }
    return match; // macro desconocida se preserva
  });
}

// Mantener compatibilidad con nombre viejo
export const resolveTagUrl = resolveUrl;

// ─── XML helpers ─────────────────────────────────────────────────────────────
function parseDuration(dur: string): number {
  if (!dur) return 0;
  const clean = dur.trim();
  if (!clean || clean.endsWith('%')) return 0;
  const parts = clean.split(':').map(p => parseFloat(p));
  if (parts.some(isNaN)) return parseFloat(clean) || 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function parseSkipOffset(raw: string | null | undefined, duration: number): number {
  if (!raw) return -1;
  const s = raw.trim();
  if (!s) return -1;
  if (s.endsWith('%')) {
    const p = parseFloat(s);
    if (isNaN(p) || duration <= 0) return -1;
    return (p / 100) * duration;
  }
  if (s.toLowerCase().endsWith('s')) {
    const sec = parseFloat(s);
    return !isNaN(sec) && sec > 0 ? sec : -1;
  }
  const sec = parseDuration(s);
  return sec > 0 ? sec : -1;
}

function getAttr(node: Element | null, name: string): string {
  return node?.getAttribute(name) ?? '';
}

function getFirstText(parent: Element | null, tag: string): string {
  if (!parent) return '';
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? '';
}

function getAllTexts(parent: Element | null, tag: string): string[] {
  if (!parent) return [];
  return Array.from(parent.getElementsByTagName(tag))
    .map(n => n.textContent?.trim())
    .filter((v): v is string => Boolean(v));
}

function parseIconUrl(scope: Element): string | undefined {
  const iconNodes = scope.getElementsByTagName('Icon');
  for (let i = 0; i < iconNodes.length; i++) {
    const staticRes = iconNodes[i].getElementsByTagName('StaticResource')[0];
    const url = staticRes?.textContent?.trim();
    if (url) return url;
  }
  return undefined;
}

function parseMediaFiles(linearEl: Element): VastMediaFile[] {
  const files: VastMediaFile[] = [];
  const nodes = linearEl.getElementsByTagName('MediaFile');
  for (let i = 0; i < nodes.length; i++) {
    const mf = nodes[i];
    const type = getAttr(mf, 'type').toLowerCase();
    if (!type.startsWith('video/')) continue; // ignora VPAID no-video
    const url = mf.textContent?.trim();
    if (!url) continue;
    files.push({
      url,
      type,
      width: parseInt(getAttr(mf, 'width') || '0', 10) || 0,
      height: parseInt(getAttr(mf, 'height') || '0', 10) || 0,
      bitrate: parseInt(getAttr(mf, 'bitrate') || '0', 10) || 0,
    });
  }
  return files;
}

function parseTrackingEvents(scope: Element): { event: string; url: string }[] {
  const events: { event: string; url: string }[] = [];
  const nodes = scope.getElementsByTagName('Tracking');
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const event = getAttr(node, 'event');
    const url = node.textContent?.trim();
    if (event && url) events.push({ event, url });
  }
  return events;
}

function pickBestMediaFile(files: VastMediaFile[], playerW = 1280, playerH = 720): VastMediaFile | null {
  if (!files.length) return null;
  // Filtrar videos compatibles con CTV (MP4 y WebM)
  const compatible = files.filter(f => f.type.includes('mp4') || f.type.includes('webm'));
  const candidates = compatible.length > 0 ? compatible : files;

  // Ordena por cercanía al tamaño deseado, prefiriendo calidad balanceada sin sobrepasar decodificación de TV
  const sorted = [...candidates].sort((a, b) => {
    const aDiff = Math.abs(a.width - playerW) + Math.abs(a.height - playerH);
    const bDiff = Math.abs(b.width - playerW) + Math.abs(b.height - playerH);
    if (aDiff !== bDiff) return aDiff - bDiff;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });
  return sorted[0] ?? files[0];
}

function parseVastXml(xmlText: string): { ads: VastAdInternal[]; topErrorUrls: string[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  if (doc.querySelector('parsererror')) {
    return { ads: [], topErrorUrls: [] };
  }

  const topErrorUrls = Array.from(doc.querySelectorAll('VAST > Error'))
    .map(n => n.textContent?.trim())
    .filter((v): v is string => Boolean(v));

  const adNodes = Array.from(doc.getElementsByTagName('Ad'));
  const ads: VastAdInternal[] = [];

  for (const adNode of adNodes) {
    const id = getAttr(adNode, 'id');
    const inline = adNode.querySelector('InLine');
    const wrapper = adNode.querySelector('Wrapper');

    const perAdErrors = getAllTexts(adNode, 'Error');

    if (inline) {
      const system = getFirstText(inline, 'AdSystem');
      const title = getFirstText(inline, 'AdTitle');
      const advertiser = getFirstText(inline, 'Advertiser');
      const description = getFirstText(inline, 'Description');
      const iconUrl = parseIconUrl(inline);
      const impressionUrls = Array.from(inline.getElementsByTagName('Impression'))
        .map(n => n.textContent?.trim())
        .filter((v): v is string => Boolean(v));

      let mediaFiles: VastMediaFile[] = [];
      let duration = 0;
      let skipOffset = -1;
      let clickThroughUrl: string | undefined;
      let clickTrackingUrls: string[] = [];
      let trackingEvents: { event: string; url: string }[] = [];

      const creatives = inline.getElementsByTagName('Creative');
      for (let c = 0; c < creatives.length; c++) {
        const linear = creatives[c].querySelector('Linear');
        if (!linear) continue;

        if (mediaFiles.length === 0) {
          const durStr = getFirstText(linear, 'Duration');
          duration = parseDuration(durStr);
          const rawSkip = linear.getAttribute('skipoffset') || linear.getAttribute('skipOffset') || linear.getAttribute('skip-offset');
          skipOffset = parseSkipOffset(rawSkip, duration);
          mediaFiles = parseMediaFiles(linear);
          const ct = getFirstText(linear, 'VideoClickThrough');
          if (ct) clickThroughUrl = ct;
          clickTrackingUrls = getAllTexts(linear, 'ClickTracking');
        }
        trackingEvents.push(...parseTrackingEvents(linear));
      }

      ads.push({
        id,
        system,
        title,
        advertiser,
        description,
        iconUrl,
        impressionUrls,
        clickThroughUrl,
        clickTrackingUrls,
        mediaFiles,
        duration,
        skipOffset,
        errorUrls: perAdErrors.length ? perAdErrors : topErrorUrls,
        trackingEvents,
      });
    } else if (wrapper) {
      const wrapperAdTagUri = getFirstText(wrapper, 'VASTAdTagURI');
      if (!wrapperAdTagUri) continue;

      const wrapperImpressions = getAllTexts(wrapper, 'Impression');
      const wrapperTracking = parseTrackingEvents(wrapper);
      const wrapperClickTracking = getAllTexts(wrapper, 'ClickTracking');
      const advertiser = getFirstText(wrapper, 'Advertiser');
      const description = getFirstText(wrapper, 'Description');
      const iconUrl = parseIconUrl(wrapper);

      ads.push({
        id,
        system: getFirstText(wrapper, 'AdSystem'),
        title: '',
        advertiser,
        description,
        iconUrl,
        impressionUrls: wrapperImpressions,
        clickTrackingUrls: wrapperClickTracking,
        mediaFiles: [],
        duration: 0,
        skipOffset: -1,
        errorUrls: perAdErrors.length ? perAdErrors : topErrorUrls,
        trackingEvents: wrapperTracking,
        _wrapperUrl: wrapperAdTagUri,
      } as VastAdInternal);
    }
  }

  return { ads, topErrorUrls };
}

// ─── Tracking ────────────────────────────────────────────────────────────────
const activePixels = new Set<HTMLImageElement>();

function fireSingleUrl(rawUrl: string, retriesLeft = MAX_RETRIES, errorCode?: string): void {
  if (!rawUrl) return;
  const resolved = resolveUrl(rawUrl, errorCode);
  if (!resolved) return;

  try {
    const img = new Image();
    activePixels.add(img);
    const cleanup = () => activePixels.delete(img);
    img.onload = cleanup;
    img.onerror = () => {
      cleanup();
      if (retriesLeft > 0) {
        const delay = 1000 * (MAX_RETRIES - retriesLeft + 1);
        setTimeout(() => fireSingleUrl(rawUrl, retriesLeft - 1, errorCode), delay);
      }
    };
    img.src = resolved;
    setTimeout(cleanup, 6000); // TV WebViews a veces no disparan onload
    return;
  } catch { }

  // Fallback final
  try {
    fetch(resolved, { method: 'GET', mode: 'no-cors', credentials: 'omit', keepalive: true } as any)
      .catch(() => {
        if (retriesLeft > 0) setTimeout(() => fireSingleUrl(rawUrl, retriesLeft - 1, errorCode), 2000);
      });
  } catch { }
}

function fireUrls(urls: string[], errorCode?: string): void {
  for (const u of urls) if (u) fireSingleUrl(u, MAX_RETRIES, errorCode);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchVast(
  tagUrl: string,
  depth = 0,
  timeoutMs = 7000,
  visited = new Set<string>(),
): Promise<VastAd | null> {
  if (depth >= MAX_WRAPPER_DEPTH) return null;

  const url = resolveUrl(tagUrl);
  if (visited.has(url)) {
    fireUrls([], '303'); // loop detectado
    return null;
  }
  visited.add(url);

  const fetchStart = Date.now();
  let xmlText: string;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!resp.ok) {
        fireUrls([], '502');
        return null;
      }
      xmlText = await resp.text();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null; // timeout -> el caller intentará siguiente Ad
  }

  const { ads, topErrorUrls } = parseVastXml(xmlText);
  if (ads.length === 0) {
    fireUrls(topErrorUrls, '100');
    return null;
  }

  // IAB: probar Ads en orden
  for (const ad of ads) {
    if (ad._wrapperUrl) {
      const elapsed = Date.now() - fetchStart;
      const remaining = timeoutMs - elapsed;
      if (remaining <= 500) {
        fireUrls(ad.errorUrls, '301');
        continue;
      }
      const innerAd = await fetchVast(ad._wrapperUrl, depth + 1, remaining, visited);
      if (innerAd) {
        // Merge según spec: wrapper primero
        innerAd.impressionUrls = [...ad.impressionUrls, ...innerAd.impressionUrls];
        innerAd.trackingEvents = [...ad.trackingEvents, ...innerAd.trackingEvents];
        innerAd.errorUrls = [...ad.errorUrls, ...innerAd.errorUrls];
        innerAd.clickTrackingUrls = [...(ad.clickTrackingUrls ?? []), ...(innerAd.clickTrackingUrls ?? [])];
        if (ad.clickThroughUrl && !innerAd.clickThroughUrl) {
          innerAd.clickThroughUrl = ad.clickThroughUrl;
        }
        if (!innerAd.title && ad.title) innerAd.title = ad.title;
        if (!innerAd.advertiser && ad.advertiser) innerAd.advertiser = ad.advertiser;
        if (!innerAd.description && ad.description) innerAd.description = ad.description;
        if (!innerAd.iconUrl && ad.iconUrl) innerAd.iconUrl = ad.iconUrl;
        if (innerAd.skipOffset <= 0 && ad.skipOffset > 0) innerAd.skipOffset = ad.skipOffset;
        return innerAd;
      }
      // wrapper falló, sigue al siguiente Ad hermano
      continue;
    }

    if (ad.mediaFiles && ad.mediaFiles.length > 0) {
      return ad;
    }
  }

  // Ningún Ad válido
  const allErrors = ads.flatMap(a => a.errorUrls);
  fireUrls(allErrors.length ? allErrors : topErrorUrls, '405');
  return null;
}

export function selectMediaFile(ad: VastAd, playerWidth?: number, playerHeight?: number): VastMediaFile | null {
  const w = playerWidth ?? safeWin()?.innerWidth ?? 1280;
  const h = playerHeight ?? safeWin()?.innerHeight ?? 720;
  return pickBestMediaFile(ad.mediaFiles, w, h);
}

export function trackImpression(ad: VastAd): void {
  fireUrls(ad.impressionUrls);
}

export function trackEvent(ad: VastAd, eventName: string): void {
  const urls = ad.trackingEvents.filter(t => t.event === eventName).map(t => t.url);
  // NO fallback fraudulento. Si no hay cuartiles, no se dispara nada.
  fireUrls(urls);
}

export function trackClick(ad: VastAd): void {
  fireUrls(ad.clickTrackingUrls ?? []);
}

export function trackError(ad: VastAd, errorCode = '405'): void {
  fireUrls(ad.errorUrls, errorCode);
}