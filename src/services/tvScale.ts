/**
 * TV root font scaling (YouTube TV–style).
 *
 * On TV platforms (webOS, Tizen, Android TV…) we keep a large root font
 * even when the CSS viewport is small (e.g. webOS sim @ 960×540).
 * YouTube TV forces ~150% font-size there; we do the same (~24px).
 *
 * On desktop/laptop we floor at the browser default (~16px) and use the
 * 1080p design base (~18px) so dev windows stay readable.
 *
 * Real webOS UHD/FHD apps usually report ~1920×1080 CSS pixels; large
 * viewports scale the root further (4K).
 */

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const DESIGN_BASE_REM = 18;
const SYSTEM_REFERENCE_PX = 16;
/** YouTube TV on the webOS sim sets font-size 150% → 24px. */
const TV_BASE_REM = 24;
const DESKTOP_MIN_ROOT_PX = SYSTEM_REFERENCE_PX;

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
    isTv =
      /Tizen\b|WebOS\b|webOS\b|Web0S|SmartTV|SMART-TV|Android\s+TV|AndroidTV|NetCast|HbbTV|Opera TV/i.test(ua) ||
      w.webOS != null ||
      w.tizen != null ||
      w.webapis != null ||
      w.NetCast != null;
  } catch {
    isTv = false;
  }

  tvPlatform = isTv;
  return isTv;
}

export function applyTvRootScale(): void {
  const width = window.innerWidth || DESIGN_WIDTH;
  const height = window.innerHeight || DESIGN_HEIGHT;
  const viewportScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  const systemScale = readSystemFontPx() / SYSTEM_REFERENCE_PX;
  const isTv = detectTvPlatform();

  let fontSize: number;
  if (isTv) {
    // Never shrink below TV base on low-res TVs/sims; only grow past 1080p.
    const largeScale = viewportScale > 1 ? viewportScale : 1;
    fontSize = TV_BASE_REM * systemScale * largeScale;
  } else {
    // Desktop/laptop: readable floor, design base at 1080p.
    const minScale = DESKTOP_MIN_ROOT_PX / DESIGN_BASE_REM;
    const scale = Math.max(viewportScale, minScale) * systemScale;
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

/** Design px → rendered px at the current root scale. */
export function designPx(px: number): number {
  const root = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  const base = Number.isFinite(root) && root > 0 ? root : DESIGN_BASE_REM;
  return (px * base) / DESIGN_BASE_REM;
}
