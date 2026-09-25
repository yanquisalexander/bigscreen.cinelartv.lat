import type { VastAd, VastMediaFile } from '@/types/vast';
import { getCachedIp } from '@/services/ip-info';

const MAX_WRAPPER_DEPTH = 5;

// ─── Placeholder registry ─────────────────────────────────────────────────────

type PlaceholderFn = () => string;

const PLACEHOLDERS: Record<string, PlaceholderFn> = {
  // Cache busting (multiple variants used by different ad networks)
  CACHEBUSTER:     () => String(Math.floor(Math.random() * 1e10)),
  CACHE_BUSTER:    () => String(Math.floor(Math.random() * 1e10)),
  cb:              () => String(Math.floor(Math.random() * 1e10)),
  // Timestamps
  TIMESTAMP:       () => String(Date.now()),
  timestamp:       () => String(Date.now()),
  // Page context
  DESCRIPTION_URL: () => encodeURIComponent(window.location.href),
  PAGE_URL:        () => encodeURIComponent(window.location.href),
  DOMAIN:          () => encodeURIComponent(window.location.hostname),
  REFERRER:        () => encodeURIComponent(document.referrer || ''),
  APP_NAME:        () => encodeURIComponent('CineLar'),
  // Player dimensions
  PLAYER_WIDTH:    () => String(window.innerWidth || 1280),
  PLAYER_HEIGHT:   () => String(window.innerHeight || 720),
  WIDTH:           () => String(window.innerWidth || 1280),
  HEIGHT:          () => String(window.innerHeight || 720),
  // Device / User (client-side)
  USER_AGENT:      () => encodeURIComponent(navigator.userAgent),
  DEVICEUA:        () => encodeURIComponent(navigator.userAgent),
  UA:              () => encodeURIComponent(navigator.userAgent),
  LANGUAGE:        () => encodeURIComponent(navigator.language || 'es'),
  // IP — from shared ip-info cache (geoblocking)
  IP:              () => encodeURIComponent(getCachedIp()),
  DEVICEIP:        () => encodeURIComponent(getCachedIp()),
  CLIENT_IP:       () => encodeURIComponent(getCachedIp()),
};

/** Allow runtime registration (e.g. from NativeBridge) */
export function registerPlaceholder(key: string, fn: PlaceholderFn): void {
  PLACEHOLDERS[key] = fn;
}

/** Resolve all [MACRO] placeholders in a single regex pass */
function resolveTagUrl(url: string): string {
  return url.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, key) => {
    const fn = PLACEHOLDERS[key];
    return fn ? fn() : match; // preserve unknown macros
  });
}

// ─── XML parsing helpers ──────────────────────────────────────────────────────

function parseDuration(dur: string): number {
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(dur) || 0;
}

function getAttr(node: Element | null, name: string): string {
  return node?.getAttribute(name) ?? '';
}

function textContent(node: Element | null, tag: string): string {
  return node?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

function parseMediaFiles(creativesEl: Element): VastMediaFile[] {
  const files: VastMediaFile[] = [];
  const linear = creativesEl.querySelector('Linear');
  if (!linear) return files;

  const mediaFiles = linear.getElementsByTagName('MediaFile');
  for (let i = 0; i < mediaFiles.length; i++) {
    const mf = mediaFiles[i];
    const type = getAttr(mf, 'type');
    if (!type.startsWith('video/')) continue;

    const url = mf.textContent?.trim();
    if (!url) continue;

    files.push({
      url,
      type,
      width: parseInt(getAttr(mf, 'width') || '0', 10),
      height: parseInt(getAttr(mf, 'height') || '0', 10),
      bitrate: parseInt(getAttr(mf, 'bitrate') || '0', 10),
    });
  }
  return files;
}

function parseTrackingEvents(doc: Element): { event: string; url: string }[] {
  const events: { event: string; url: string }[] = [];
  const trackingNodes = doc.getElementsByTagName('Tracking');
  for (let i = 0; i < trackingNodes.length; i++) {
    const node = trackingNodes[i];
    const event = getAttr(node, 'event');
    const url = node.textContent?.trim();
    if (event && url) events.push({ event, url });
  }
  return events;
}

function pickBestMediaFile(files: VastMediaFile[]): VastMediaFile | null {
  if (files.length === 0) return null;
  const sorted = [...files].sort((a, b) => {
    const aScore = (a.width * a.height) + a.bitrate;
    const bScore = (b.width * b.height) + b.bitrate;
    return aScore - bScore;
  });
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;
  const match = sorted.find((f) => f.width >= vw || f.height >= vh);
  return match ?? sorted[sorted.length - 1];
}

function parseVastXml(xmlText: string): { ads: VastAd[]; errorUrls: string[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const ads: VastAd[] = [];
  const errorUrls: string[] = [];

  const errorNodes = doc.getElementsByTagName('Error');
  for (let i = 0; i < errorNodes.length; i++) {
    const url = errorNodes[i].textContent?.trim();
    if (url) errorUrls.push(url);
  }

  const adNodes = doc.getElementsByTagName('Ad');
  for (let i = 0; i < adNodes.length; i++) {
    const adNode = adNodes[i];
    const id = getAttr(adNode, 'id');

    const inline = adNode.querySelector('InLine');
    if (inline) {
      const creatives = inline.querySelector('Creatives');
      const mediaFiles = creatives ? parseMediaFiles(creatives) : [];

      const impressionNodes = inline.getElementsByTagName('Impression');
      const impressionUrls: string[] = [];
      for (let j = 0; j < impressionNodes.length; j++) {
        const url = impressionNodes[j].textContent?.trim();
        if (url) impressionUrls.push(url);
      }

      const linearEl = inline.querySelector('Creatives')?.querySelector('Linear');

      const clickThrough = textContent(linearEl, 'VideoClickThrough');

      // Parse ClickTracking URLs
      const clickTrackingUrls: string[] = [];
      const ctNodes = linearEl?.getElementsByTagName('ClickTracking');
      if (ctNodes) {
        for (let j = 0; j < ctNodes.length; j++) {
          const url = ctNodes[j].textContent?.trim();
          if (url) clickTrackingUrls.push(url);
        }
      }

      const durationStr = textContent(linearEl, 'Duration');
      const duration = parseDuration(durationStr);

      const skipOffsetAttr = linearEl?.getAttribute('skipOffset');
      const skipOffset = skipOffsetAttr ? parseDuration(skipOffsetAttr) : -1;

      const trackingEvents = parseTrackingEvents(inline);

      ads.push({
        id,
        system: textContent(inline, 'AdSystem'),
        title: textContent(inline, 'AdTitle'),
        impressionUrls,
        clickThroughUrl: clickThrough || undefined,
        clickTrackingUrls,
        mediaFiles,
        duration,
        skipOffset,
        errorUrls,
        trackingEvents,
      });
    }

    const wrapper = adNode.querySelector('Wrapper');
    if (wrapper) {
      const wrapperAdTagUri = textContent(wrapper, 'VASTAdTagURI');
      if (wrapperAdTagUri) {
        // Parse wrapper-level impressions
        const wrapperImpressions: string[] = [];
        const impNodes = wrapper.getElementsByTagName('Impression');
        for (let j = 0; j < impNodes.length; j++) {
          const url = impNodes[j].textContent?.trim();
          if (url) wrapperImpressions.push(url);
        }

        // Parse wrapper-level tracking events
        const wrapperTracking = parseTrackingEvents(wrapper);

        // Parse wrapper-level ClickTracking
        const wrapperClickTracking: string[] = [];
        const wrapperCtNodes = wrapper.getElementsByTagName('ClickTracking');
        if (wrapperCtNodes) {
          for (let j = 0; j < wrapperCtNodes.length; j++) {
            const url = wrapperCtNodes[j].textContent?.trim();
            if (url) wrapperClickTracking.push(url);
          }
        }

        ads.push({
          id,
          system: textContent(wrapper, 'AdSystem'),
          mediaFiles: [],
          duration: 0,
          skipOffset: -1,
          impressionUrls: wrapperImpressions,
          clickTrackingUrls: wrapperClickTracking,
          errorUrls: [...errorUrls],
          trackingEvents: wrapperTracking,
        });
        (ads[ads.length - 1] as any)._wrapperUrl = wrapperAdTagUri;
      }
    }
  }

  return { ads, errorUrls };
}

function fireUrls(urls: string[]): void {
  for (const url of urls) {
    try {
      const img = new Image();
      img.src = url;
    } catch {
      // ignore tracking errors
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchVast(
  tagUrl: string,
  depth = 0,
  timeoutMs = 7000,
): Promise<VastAd | null> {
  if (depth >= MAX_WRAPPER_DEPTH) return null;

  const url = resolveTagUrl(tagUrl);
  const fetchStart = Date.now();

  let xmlText: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) return null;
      xmlText = await resp.text();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }

  const { ads, errorUrls } = parseVastXml(xmlText);
  if (ads.length === 0) {
    fireUrls(errorUrls);
    return null;
  }

  const ad = ads[0];

  const wrapperUrl = (ad as any)._wrapperUrl;
  if (wrapperUrl && (!ad.mediaFiles || ad.mediaFiles.length === 0)) {
    const elapsed = Date.now() - fetchStart;
    const remaining = timeoutMs - elapsed;
    if (remaining <= 500) return null;

    const innerAd = await fetchVast(wrapperUrl, depth + 1, remaining);
    if (innerAd) {
      // IAB spec: merge wrapper-level tracking into the resolved ad
      innerAd.impressionUrls = [...ad.impressionUrls, ...innerAd.impressionUrls];
      innerAd.trackingEvents = [...ad.trackingEvents, ...innerAd.trackingEvents];
      innerAd.errorUrls = [...ad.errorUrls, ...innerAd.errorUrls];
      innerAd.clickTrackingUrls = [
        ...(ad.clickTrackingUrls ?? []),
        ...(innerAd.clickTrackingUrls ?? []),
      ];
      if (ad.clickThroughUrl && !innerAd.clickThroughUrl) {
        innerAd.clickThroughUrl = ad.clickThroughUrl;
      }
    }
    return innerAd;
  }

  if (!ad.mediaFiles || ad.mediaFiles.length === 0) {
    fireUrls(errorUrls);
    return null;
  }

  return ad;
}

export function selectMediaFile(ad: VastAd): VastMediaFile | null {
  return pickBestMediaFile(ad.mediaFiles);
}

export function trackImpression(ad: VastAd): void {
  fireUrls(ad.impressionUrls);
}

export function trackEvent(ad: VastAd, eventName: string): void {
  const urls = ad.trackingEvents
    .filter((t) => t.event === eventName)
    .map((t) => t.url);
  fireUrls(urls);
}

export function trackClick(ad: VastAd): void {
  fireUrls(ad.clickTrackingUrls);
}

export function trackError(ad: VastAd): void {
  fireUrls(ad.errorUrls);
}
