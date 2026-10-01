/**
 * TV root font scaling (Mejorado para 4K y detección de plataformas modernas).
 */

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const DESIGN_BASE_REM = 18;
const SYSTEM_REFERENCE_PX = 16;
const TV_LOW_RES_ROOT_PX = 24;
const TV_BASE_ROOT_PX = 16;
const DESKTOP_MIN_ROOT_PX = SYSTEM_REFERENCE_PX;
const LOW_RES_TV_MAX_EDGE = 1280;

// NUEVO: Límite máximo de escala para evitar que pantallas 4K/8K escalen la UI infinitamente
const MAX_VIEWPORT_SCALE = 1.5;
// NUEVO: Umbral para forzar modo TV en resoluciones nativas 4K no detectadas
const UHD_WIDTH_THRESHOLD = 3000;

let systemFontPx: number | null = null;
let resizeBound = false;
let tvPlatform: boolean | null = null;

function readSystemFontPx(): number {
  if (systemFontPx != null) return systemFontPx;

  let value = SYSTEM_REFERENCE_PX;
  try {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute;left:-99999px;top:0;width:0;height:0;visibility:hidden;font-size:medium;';
    document.documentElement.appendChild(probe);
    const raw = window.getComputedStyle(probe).fontSize;
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) value = parsed;
    probe.remove();
  } catch {
    // keep default
  }

  systemFontPx = value;
  return value;
}

function detectTvPlatform(): boolean {
  if (tvPlatform != null) return tvPlatform;

  let isTv = false;
  try {
    const ua = navigator.userAgent || '';
    const w = window as unknown as Record<string, unknown>;

    // 1. Detección tradicional (añadidos CrKey para Chromecast y Vidaa para Hisense)
    isTv =
      /Tizen\b|WebOS\b|webOS\b|Web0S|SmartTV|SMART-TV|Android\s+TV|AndroidTV|NetCast|HbbTV|Opera TV|CrKey|Vidaa/i.test(ua) ||
      w.webOS != null ||
      w.tizen != null ||
      w.webapis != null ||
      w.NetCast != null;

    // 2. Detección por Media Queries (TVs usan control remoto: puntero grueso y sin hover)
    if (!isTv && typeof window.matchMedia === 'function') {
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const noHover = window.matchMedia('(hover: none)').matches;
      // Si es pantalla grande, sin hover y con puntero grueso, es casi seguro una TV
      if (hasCoarsePointer && noHover && window.innerWidth >= 1280) {
        isTv = true;
      }
    }

    // 3. Fallback para TVs 4K que reportan su resolución nativa completa (ej. 3840px) 
    // pero tienen un User-Agent genérico de WebView/Chrome.
    if (!isTv && window.innerWidth >= UHD_WIDTH_THRESHOLD) {
      isTv = true;
    }
  } catch {
    isTv = false;
  }

  tvPlatform = isTv;
  return isTv;
}

export function applyTvRootScale(): void {
  const width = window.innerWidth || DESIGN_WIDTH;
  const height = window.innerHeight || DESIGN_HEIGHT;
  const isTv = detectTvPlatform();

  let fontSize: number;
  if (isTv) {
    const isLowResTv =
      width < LOW_RES_TV_MAX_EDGE || height < Math.round(LOW_RES_TV_MAX_EDGE * (DESIGN_HEIGHT / DESIGN_WIDTH));

    fontSize = isLowResTv ? TV_LOW_RES_ROOT_PX : TV_BASE_ROOT_PX;
  } else {
    const viewportScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

    // ¡MEJORA CLAVE! Limitamos el viewportScale para evitar que monitores 4K 
    // o TVs no detectadas escalen la interfaz al 300% (lo que causaba el efecto "gigante").
    const cappedViewportScale = Math.min(viewportScale, MAX_VIEWPORT_SCALE);

    const systemScale = Math.min(readSystemFontPx() / SYSTEM_REFERENCE_PX, 1.15);
    const minScale = DESKTOP_MIN_ROOT_PX / DESIGN_BASE_REM;
    const scale = Math.max(cappedViewportScale, minScale) * systemScale;
    fontSize = Math.max(DESIGN_BASE_REM * scale, DESKTOP_MIN_ROOT_PX);
  }

  document.documentElement.style.fontSize = `${fontSize}px`;
  document.documentElement.dataset.tvRoot = `${fontSize}px`;
  document.documentElement.dataset.tvPlatform = isTv ? '1' : '0';
}

export function initTvScale(): void {
  applyTvRootScale();
  if (resizeBound) return;
  resizeBound = true;
  window.addEventListener('resize', applyTvRootScale);
  window.addEventListener('orientationchange', applyTvRootScale);
}

export function designPx(px: number): number {
  const root = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  const base = Number.isFinite(root) && root > 0 ? root : DESIGN_BASE_REM;
  return (px * base) / DESIGN_BASE_REM;
}