/**
 * Geoblocking — detecta el país del usuario vía IP y decide si la app debe
 * bloquearse según la configuración remota (AppBoot / RemoteConfig).
 *
 * Flujo:
 *  1. Leer cache (localStorage, TTL 24 h)
 *  2. Si no hay cache → fetch IP info (ipwho.is con fallback a ipinfo.io)
 *  3. Leer configuración desde RemoteConfigService
 *  4. Evaluar bloqueo (blacklist/whitelist)
 *  5. Guardar resultado en cache
 *
 * En caso de error de red se permite el acceso (fail-open) para no bloquear
 * usuarios legítimos por problemas de conectividad.
 */

import { remoteConfig } from '@/services/RemoteConfigService';
import type { RemoteConfig } from '@/types/config';

const IS_DEV = import.meta.env.DEV;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type GeoblockMode = 'blacklist' | 'whitelist';

export interface GeoblockConfig {
    enabled: boolean;
    mode: GeoblockMode;
    /** Códigos ISO 3166-1 alpha-2 (p.ej. "MX", "AR") */
    countries: string[];
    message: string;
}

export interface GeoResult {
    countryCode: string; // 2 letras, mayúsculas (p.ej. "MX"). Vacío si no se pudo detectar
    countryName: string; // Nombre legible del país
    blocked: boolean; // Si la app debe bloquearse
    message: string; // Mensaje para mostrar al usuario si está bloqueado
}

interface IpCache {
    countryCode: string;
    countryName: string;
    ts: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CACHE_KEY = '@cinelartv/geo_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

const DEFAULT_CONFIG: GeoblockConfig = {
    enabled: false,
    mode: 'blacklist',
    countries: [],
    message: 'La aplicación no está disponible en tu región por el momento.',
};

// ─── Helpers internos ─────────────────────────────────────────────────────────

function codeToName(code: string): string {
    try {
        const dn = new Intl.DisplayNames(['es'], { type: 'region' });
        return dn.of(code) ?? code;
    } catch {
        return code;
    }
}

async function fetchIpInfo(): Promise<Pick<IpCache, 'countryCode' | 'countryName'>> {
    // API 1: ipwho.is
    try {
        console.log('[geoblock] Intentando ipwho.is…');
        const res = await fetch('https://ipwho.is/?fields=country,country_code,success', {
            signal: AbortSignal.timeout(5000),
        });
        console.log('[geoblock] ipwho.is status:', res.status, res.ok);
        if (res.ok) {
            const data = await res.json();
            console.log('[geoblock] ipwho.is data:', JSON.stringify(data));
            if (data.success && data.country_code) {
                const code = String(data.country_code).toUpperCase();
                return { countryCode: code, countryName: data.country ?? codeToName(code) };
            } else {
                console.warn('[geoblock] ipwho.is respondió pero sin datos válidos:', JSON.stringify(data));
            }
        } else {
            const text = await res.text().catch(() => '(no body)');
            console.warn('[geoblock] ipwho.is HTTP error:', res.status, text);
        }
    } catch (e) {
        console.warn('[geoblock] ipwho.is excepción:', e);
    }

    // API 2: ipinfo.io
    try {
        console.log('[geoblock] Intentando ipinfo.io…');
        const res = await fetch('https://ipinfo.io/json', {
            signal: AbortSignal.timeout(5000),
        });
        console.log('[geoblock] ipinfo.io status:', res.status, res.ok);
        if (res.ok) {
            const data = await res.json();
            console.log('[geoblock] ipinfo.io data:', JSON.stringify(data));
            if (data.country) {
                const code = String(data.country).toUpperCase();
                return { countryCode: code, countryName: codeToName(code) };
            } else {
                console.warn('[geoblock] ipinfo.io respondió pero sin campo country:', JSON.stringify(data));
            }
        } else {
            const text = await res.text().catch(() => '(no body)');
            console.warn('[geoblock] ipinfo.io HTTP error:', res.status, text);
        }
    } catch (e) {
        console.warn('[geoblock] ipinfo.io excepción:', e);
    }

    console.error('[geoblock] Ambos proveedores fallaron. Se permite acceso (fail-open).');
    return { countryCode: '', countryName: '' };
}

async function readCache(): Promise<IpCache | null> {
    if (IS_DEV) return null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cache: IpCache = JSON.parse(raw);
        if (Date.now() - cache.ts < CACHE_TTL_MS) return cache;
    } catch (e) {
        // ignore
    }
    return null;
}

async function writeCache(data: Omit<IpCache, 'ts'>): Promise<void> {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }));
    } catch (e) {
        // ignore
    }
}

export async function clearGeoCache(): Promise<void> {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch {
        // ignore
    }
}

// ─── Config desde RemoteConfig ───────────────────────────────────────────────

export function getGeoblockConfig(cfg: RemoteConfig = remoteConfig.get()): GeoblockConfig {
    const enabled = Boolean(cfg?.USE_GEOBLOCKING ?? false);
    const mode = (cfg?.GEOBLOCKING_MODE ?? DEFAULT_CONFIG.mode) as GeoblockMode;

    let countries: string[] = [];
    const rawCountries: unknown = cfg?.GEOBLOCKING_COUNTRIES ?? [];
    if (Array.isArray(rawCountries)) {
        countries = rawCountries.map((c) => String(c).toUpperCase());
    } else if (typeof rawCountries === 'string') {
        countries = rawCountries.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);
    }

    const message = String(cfg?.GEOBLOCKING_MESSAGE ?? DEFAULT_CONFIG.message);

    return { enabled, mode, countries, message };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Detecta el país del usuario y decide si debe bloquearse o no.
 * Es fail-open: si no se puede detectar la IP o leer la config, permite el acceso.
 */
export async function checkGeoBlock(): Promise<GeoResult> {
    // 1. Obtener país (cache → API)
    let ipInfo = await readCache();
    if (!ipInfo) {
        const resolved = await fetchIpInfo();
        if (resolved.countryCode) {
            await writeCache({ countryCode: resolved.countryCode, countryName: resolved.countryName });
            ipInfo = { ...resolved, ts: Date.now() } as IpCache;
        } else {
            ipInfo = { countryCode: '', countryName: '', ts: Date.now() };
        }
    }

    const { countryCode, countryName } = ipInfo;

    // 2. Obtener config desde RemoteConfig
    const config = getGeoblockConfig();

    // Normalizar country codes y lista de países para comparación segura
    const normalizedCountry = String(countryCode ?? '').trim().toUpperCase();
    const normalizedCountries = (config.countries ?? []).map((c) => String(c ?? '').trim().toUpperCase());

    console.log('[geoblock] config:', JSON.stringify(config));
    console.log('[geoblock] countryCode:', countryCode, 'normalized:', normalizedCountry);
    console.log('[geoblock] countries normalized:', JSON.stringify(normalizedCountries));

    // 3. Evaluar (fail-open si no hay país o la config está deshabilitada)
    if (!config.enabled || !normalizedCountry) {
        return { countryCode, countryName, blocked: false, message: config.message };
    }

    let blocked = false;
    if (config.mode === 'blacklist') {
        blocked = normalizedCountries.includes(normalizedCountry);
    } else {
        blocked = !normalizedCountries.includes(normalizedCountry);
    }

    return { countryCode, countryName, blocked, message: config.message };
}

export default {
    checkGeoBlock,
    clearGeoCache,
    getGeoblockConfig,
};
