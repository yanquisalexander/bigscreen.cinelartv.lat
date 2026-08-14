import type { VastAd } from '@/types/vast';
import { fetchVast } from './vast-client';

const CLIENT_HINTS_ATTR = 'data-delegate-ch';
const CLIENT_HINTS_HINTS = [
  'Sec-CH-UA',
  'Sec-CH-UA-Mobile',
  'Sec-CH-UA-Arch',
  'Sec-CH-UA-Model',
  'Sec-CH-UA-Platform',
  'Sec-CH-UA-Platform-Version',
  'Sec-CH-UA-Bitness',
  'Sec-CH-UA-Full-Version-List',
  'Sec-CH-UA-Full-Version',
];

function ensureClientHints(domains: string[]): void {
  if (document.querySelector(`meta[${CLIENT_HINTS_ATTR}]`)) return;

  const content = CLIENT_HINTS_HINTS.map(
    (h) => domains.map((d) => `${h} ${d}`).join('; '),
  ).join('; ');

  const meta = document.createElement('meta');
  meta.httpEquiv = 'Delegate-CH';
  meta.content = content;
  meta.setAttribute(CLIENT_HINTS_ATTR, '1');
  document.head.appendChild(meta);
}

function extractDomains(urls: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of urls) {
    try {
      const h = new URL(raw).hostname;
      if (h) seen.add(h);
    } catch {
      // invalid URL, skip
    }
  }
  return [...seen];
}

export interface VastTag {
  url: string;
  label?: string;
}

export class VastRotation {
  private tags: VastTag[];
  private domains: string[];
  private currentIndex = 0;

  constructor(tags: (string | VastTag)[]) {
    this.tags = tags.map((t) =>
      typeof t === 'string' ? { url: t } : t,
    );
    this.domains = extractDomains(this.tags.map((t) => t.url));
  }

  async next(timeoutMs = 7000): Promise<VastAd | null> {
    if (this.tags.length === 0) return null;

    if (this.domains.length > 0) {
      ensureClientHints(this.domains);
    }

    const start = Date.now();
    const startIdx = this.currentIndex;

    for (let i = 0; i < this.tags.length; i++) {
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) return null;

      const idx = (startIdx + i) % this.tags.length;
      this.currentIndex = (idx + 1) % this.tags.length;

      const remaining = timeoutMs - elapsed;
      const perTag = Math.min(remaining, Math.max(2000, remaining / (this.tags.length - i)));

      const ad = await fetchVast(this.tags[idx].url, 0, perTag);
      if (ad) return ad;
    }

    return null;
  }

  get currentLabel(): string | undefined {
    const prev =
      (this.currentIndex - 1 + this.tags.length) % this.tags.length;
    return this.tags[prev]?.label;
  }

  reset(): void {
    this.currentIndex = 0;
  }
}
