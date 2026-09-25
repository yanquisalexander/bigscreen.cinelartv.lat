/**
 * Client IP detection — shared by geoblocking and VAST placeholder resolution.
 * Uses ipwho.is with fallback to ipinfo.io. Caches in localStorage for 24h.
 */

const CACHE_KEY = '@cinelartv/ip_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface IpCacheEntry {
  ip: string;
  countryCode: string;
  countryName: string;
  ts: number;
}

let memoryCache: IpCacheEntry | null = null;

function readCache(): IpCacheEntry | null {
  if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL_MS) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: IpCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < CACHE_TTL_MS) {
      memoryCache = entry;
      return entry;
    }
  } catch {}
  return null;
}

function writeCache(entry: Omit<IpCacheEntry, 'ts'>): IpCacheEntry {
  const full = { ...entry, ts: Date.now() };
  memoryCache = full;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(full));
  } catch {}
  return full;
}

async function fetchFromApis(): Promise<IpCacheEntry> {
  // API 1: ipwho.is
  try {
    const res = await fetch('https://ipwho.is/?fields=ip,country,country_code,success', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.ip) {
        return writeCache({
          ip: data.ip,
          countryCode: (data.country_code || '').toUpperCase(),
          countryName: data.country || '',
        });
      }
    }
  } catch {}

  // API 2: ipinfo.io
  try {
    const res = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        return writeCache({
          ip: data.ip,
          countryCode: (data.country || '').toUpperCase(),
          countryName: '',
        });
      }
    }
  } catch {}

  return { ip: '', countryCode: '', countryName: '', ts: Date.now() };
}

/** Resolves on first call, returns from cache on subsequent calls */
let resolvePromise: Promise<IpCacheEntry> | null = null;

export async function getIpInfo(): Promise<IpCacheEntry> {
  const cached = readCache();
  if (cached) return cached;
  if (!resolvePromise) resolvePromise = fetchFromApis();
  return resolvePromise;
}

/** Synchronous — returns cached IP or empty string. Never blocks. */
export function getCachedIp(): string {
  return readCache()?.ip ?? '';
}

export function getCachedCountryCode(): string {
  return readCache()?.countryCode ?? '';
}

/** Clear both old geoblocking cache and new ip cache */
export function clearIpCache(): void {
  memoryCache = null;
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('@cinelartv/geo_cache');
  } catch {}
}
