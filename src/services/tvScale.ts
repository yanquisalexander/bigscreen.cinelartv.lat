/**
 * TV root font scaling.
 *
 * Design assumes a 1920×1080 canvas. We set `html { font-size }` so every
 * `rem` unit scales with the viewport — same idea as YouTube TV reading a
 * computed font-size and multiplying design units by it.
 *
 * Scale is applied for large viewports (4K TVs, etc.) but never shrinks
 * below the browser/TV system default (~16px), so laptop/desktop windows
 * stay readable. Real webOS UHD/FHD apps report ~1920×1080 CSS pixels.
 */

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const DESIGN_BASE_REM = 18;
const SYSTEM_REFERENCE_PX = 16;
const MIN_ROOT_PX = SYSTEM_REFERENCE_PX;

let systemFontPx: number | null = null;
let resizeBound = false;

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

export function applyTvRootScale(): void {
  const width = window.innerWidth || DESIGN_WIDTH;
  const height = window.innerHeight || DESIGN_HEIGHT;
  const viewportScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  const systemScale = readSystemFontPx() / SYSTEM_REFERENCE_PX;
  // Floor at system default: only scale UP past1080p, never below 16px on laptops.
  const scale = Math.max(viewportScale, MIN_ROOT_PX / DESIGN_BASE_REM) * systemScale;
  const fontSize = Math.max(DESIGN_BASE_REM * scale, MIN_ROOT_PX);
  document.documentElement.style.fontSize = `${fontSize}px`;
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
