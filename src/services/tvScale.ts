/**
 * TV root font scaling.
 *
 * Design was tuned around a ~16px root (browser default after the old
 * splash restore). We keep that as the TV baseline so rem/vw clamps look
 * like the original app on 1080p/4K webOS (which report ~1920×1080 CSS).
 *
 * Low-res TV viewports (webOS sim @ 960×540, etc.) get a YouTube-style
 * boost (~24px / 150%) so text is readable there.
 *
 * We do NOT multiply the TV root by the system/accessibility font size —
 * that was making the UI gigantic on real TVs. Desktop keeps a readable
 * floor (~16px) with the 1080p design base (~18px).
 */

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const DESIGN_BASE_REM = 18;
const SYSTEM_REFERENCE_PX = 16;
/** YouTube TV on low-res sims uses ~150% → 24px. */
const TV_LOW_RES_ROOT_PX = 24;
const TV_BASE_ROOT_PX = 16;
const DESKTOP_MIN_ROOT_PX = SYSTEM_REFERENCE_PX;
/** Below this CSS width/height we treat the TV viewport as low-res. */
const LOW_RES_TV_MAX_EDGE = 1280;

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
  const isTv = detectTvPlatform();

  let fontSize: number;
  if (isTv) {
    const isLowResTv =
      width < LOW_RES_TV_MAX_EDGE || height < Math.round(LOW_RES_TV_MAX_EDGE * (DESIGN_HEIGHT / DESIGN_WIDTH));
    // Fixed values only — never systemScale × viewport (that exploded on 4K).
    fontSize = isLowResTv ? TV_LOW_RES_ROOT_PX : TV_BASE_ROOT_PX;
  } else {
    const viewportScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    // Cap system zoom on desktop so a large OS font doesn't blow up the UI.
    const systemScale = Math.min(readSystemFontPx() / SYSTEM_REFERENCE_PX, 1.15);
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
