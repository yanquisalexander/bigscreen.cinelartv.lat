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
import { getIpInfo } from '@/services/ip-info';
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

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: GeoblockConfig = {
    enabled: false,
    mode: 'blacklist',
    countries: [],
    message: 'La aplicación no está disponible en tu región por el momento.',
};

export async function clearGeoCache(): Promise<void> {
    try {
        localStorage.removeItem('@cinelartv/geo_cache');
        localStorage.removeItem('@cinelartv/ip_cache');
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
    // En DEV siempre permitir acceso
    if (IS_DEV) {
        return { countryCode: '', countryName: '', blocked: false, message: '' };
    }

    // 1. Obtener país via shared ip-info module (cache → API)
    const ipInfo = await getIpInfo();
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
