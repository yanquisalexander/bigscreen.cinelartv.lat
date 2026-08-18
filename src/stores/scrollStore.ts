let scrolled = false;
let rafId = 0;
const listeners: Set<(v: boolean) => void> = new Set();

function onScroll(e: Event) {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const el = e.target as HTMLElement;
    const next = (el.scrollTop || 0) > 50;
    if (next !== scrolled) {
      scrolled = next;
      for (const fn of listeners) fn(scrolled);
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
}

export function subscribeScrolled(fn: (v: boolean) => void) {
  listeners.add(fn);
  fn(scrolled);
  return () => listeners.delete(fn);
}
