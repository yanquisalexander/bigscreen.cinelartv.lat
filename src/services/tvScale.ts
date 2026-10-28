const DESIGN_WIDTH = 1280;
/**
 * Global UI scale applied on top of the width-based rem scale.
 * 1 = design size at 1280px; bump slightly when the UI reads small on TVs.
 */
const UI_SCALE = 1.08;
export const TV_SCALE_EVENT = 'tv-scale-change';

/** One REM scale for the entire TV surface, applied before Svelte mounts. */
export function initTvScale(): () => void {
  const root = document.documentElement;
  let frame = 0;

  function apply() {
    frame = 0;
    const width = window.innerWidth || DESIGN_WIDTH;
    root.style.fontSize = `${(width / DESIGN_WIDTH * UI_SCALE * 100).toFixed(4)}%`;
    const rem = parseFloat(getComputedStyle(root).fontSize) || 16;
    root.style.setProperty('--tv-screen-width', `${width / rem}rem`);
    root.style.setProperty('--tv-screen-height', `${window.innerHeight / rem}rem`);
    // Geometry consumers measure after the new root scale has been applied.
    window.dispatchEvent(new Event(TV_SCALE_EVENT));
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(apply);
  }

  apply();
  window.addEventListener('resize', schedule);
  return () => {
    window.removeEventListener('resize', schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}
