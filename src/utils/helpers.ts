import type { ImageVariants, ContentImages, EpisodeImages } from '@/types/content';

export function resolveImageUrl(path?: string | null, baseUrl?: string): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${baseUrl ?? ''}${path}`;
  return path;
}

function pickWebpUrl(variants: ImageVariants | undefined, baseUrl?: string): string | null {
  if (!variants) return null;
  const preferred = [variants.medium, variants.large, variants.small, variants.thumbnail, variants.original];
  for (const v of preferred) {
    if (v?.webp) return resolveImageUrl(v.webp, baseUrl);
  }
  return null;
}

export function resolveBackdrop(images: ContentImages | undefined, fallback?: string | null, baseUrl?: string): string | null {
  return pickWebpUrl(images?.backdrop, baseUrl) ?? resolveImageUrl(fallback, baseUrl);
}

export function resolvePoster(images: ContentImages | undefined, fallback?: string | null, baseUrl?: string): string | null {
  return pickWebpUrl(images?.poster, baseUrl) ?? resolveImageUrl(fallback, baseUrl);
}

export function resolveEpisodeThumbnail(images: EpisodeImages | undefined, fallback?: string | null, baseUrl?: string): string | null {
  return pickWebpUrl(images?.episode_thumbnail, baseUrl) ?? resolveImageUrl(fallback, baseUrl);
}

export function resolveLogo(images: ContentImages | undefined, baseUrl?: string): string | null {
  if (!images?.logo) return null;
  const preferred = [images.logo.original, images.logo.medium, images.logo.small];
  for (const v of preferred) {
    if (v?.webp) return resolveImageUrl(v.webp, baseUrl);
  }
  return null;
}

export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatUserCode(code: string): string {
  const clean = code.replace(/\s/g, '').toUpperCase();
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const BACK_KEYS = new Set(['Escape', 'Backspace', 'XF86Back', 'GoBack', 'BrowserBack', 'Back']);
const BACK_KEYCODES = new Set([8, 27, 461, 10009]);

export function isBackKey(e: Pick<KeyboardEvent, 'key' | 'keyCode'>): boolean {
  if (BACK_KEYS.has(e.key)) return true;
  return BACK_KEYCODES.has(e.keyCode);
}
