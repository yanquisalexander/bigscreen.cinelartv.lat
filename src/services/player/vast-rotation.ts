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
  if (typeof document === 'undefined' || domains.length === 0) return;
  // Si ya existe un Delegate-CH estático (index.html) que cubre estos dominios, no duplicar.
  // El estático gana porque el browser lo procesa antes del primer fetch VAST.
  const existing = document.querySelector('meta[http-equiv="Delegate-CH"]');
  if (existing) {
    const content = existing.getAttribute('content') ?? '';
    const covered = domains.every((d) => content.includes(d));
    if (covered) return;
    // Si el estático existe pero no cubre todo, lo complementamos solo si aún
    // no inyectamos el dinámico.
    if (document.querySelector(`meta[${CLIENT_HINTS_ATTR}]`)) return;
  } else if (document.querySelector(`meta[${CLIENT_HINTS_ATTR}]`)) {
    return;
  }

  const content = CLIENT_HINTS_HINTS.map((h) => `${h} ${domains.join(`; ${h} `)}`).join('; ');

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
      // Delegate-CH exige origins completos (https://host), no solo hostname.
      const origin = new URL(raw).origin;
      if (origin && origin.startsWith('https://')) seen.add(origin);
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
  private roundRobinStart = 0;
  private lastResolvedIndex = -1;
  private tagCooldowns = new Map<string, number>();

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
    const tagCount = this.tags.length;
    
    // Round-robin: avance circular del tag inicial por cada solicitud
    const initialIndex = this.roundRobinStart;
    this.roundRobinStart = (this.roundRobinStart + 1) % tagCount;

    const now = Date.now();

    // Ordenar los índices según round-robin a partir de initialIndex
    const indices: number[] = [];
    for (let i = 0; i < tagCount; i++) {
      indices.push((initialIndex + i) % tagCount);
    }

    // Filtrar o retrasar tags con fallos persistentes (cooldown de 45s)
    const activeIndices = indices.filter(idx => {
      const cd = this.tagCooldowns.get(this.tags[idx].url) ?? 0;
      return now >= cd;
    });

    // Si todos están en cooldown, intentar con todos en orden round-robin
    const orderToTry = activeIndices.length > 0 ? activeIndices : indices;

    for (let i = 0; i < orderToTry.length; i++) {
      const idx = orderToTry[i];
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) break;

      const remaining = timeoutMs - elapsed;
      const tagsLeft = orderToTry.length - i;
      const perTag = Math.min(remaining, Math.max(1800, remaining / tagsLeft));

      this.lastResolvedIndex = idx;

      try {
        const ad = await fetchVast(this.tags[idx].url, 0, perTag);
        if (ad) {
          // Éxito: limpiar cooldown
          this.tagCooldowns.delete(this.tags[idx].url);
          return ad;
        }
      } catch {
        // Tag falló o timeout
      }

      // Marcar cooldown temporal de 30s al fallar
      this.tagCooldowns.set(this.tags[idx].url, Date.now() + 30000);
    }

    return null;
  }

  get currentLabel(): string | undefined {
    if (this.lastResolvedIndex >= 0 && this.lastResolvedIndex < this.tags.length) {
      return this.tags[this.lastResolvedIndex]?.label;
    }
    return undefined;
  }

  reset(): void {
    this.roundRobinStart = 0;
    this.lastResolvedIndex = -1;
    this.tagCooldowns.clear();
  }
}
