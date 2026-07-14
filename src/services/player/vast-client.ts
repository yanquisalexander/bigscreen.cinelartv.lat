import type { VastAd, VastMediaFile } from '@/types/vast';

const MAX_WRAPPER_DEPTH = 5;

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

      const clickThrough = textContent(
        inline.querySelector('Creatives')?.querySelector('Linear'),
        'VideoClickThrough',
      );

      const durationStr = textContent(inline.querySelector('Creatives')?.querySelector('Linear'), 'Duration');
      const duration = parseDuration(durationStr);

      const skipOffsetAttr = inline.querySelector('Creatives')?.querySelector('Linear')?.getAttribute('skipOffset');
      const skipOffset = skipOffsetAttr ? parseDuration(skipOffsetAttr) : -1;

      const trackingEvents = parseTrackingEvents(inline);

      ads.push({
        id,
        system: textContent(inline, 'AdSystem'),
        title: textContent(inline, 'AdTitle'),
        impressionUrls,
        clickThroughUrl: clickThrough || undefined,
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
        ads.push({
          id,
          system: textContent(wrapper, 'AdSystem'),
          mediaFiles: [],
          duration: 0,
          skipOffset: -1,
          impressionUrls: [],
          errorUrls: [],
          trackingEvents: [],
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

export async function fetchVast(
  tagUrl: string,
  depth = 0,
): Promise<VastAd | null> {
  if (depth >= MAX_WRAPPER_DEPTH) return null;

  let url = tagUrl
    .replace('[CACHEBUSTER]', String(Math.floor(Math.random() * 1e10)))
    .replace('[TIMESTAMP]', String(Date.now()))
    .replace('[DESCRIPTION_URL]', encodeURIComponent(window.location.href));

  let xmlText: string;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    xmlText = await resp.text();
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
    return fetchVast(wrapperUrl, depth + 1);
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

export function trackError(ad: VastAd): void {
  fireUrls(ad.errorUrls);
}
