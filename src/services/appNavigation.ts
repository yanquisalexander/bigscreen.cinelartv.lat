import { push as routerPush, replace as routerReplace } from 'svelte-spa-router';

const DEFAULT_FALLBACK = '/home';

const FALLBACK_BY_PREFIX: Array<{ prefix: string; fallback: string }> = [
  { prefix: '/watch', fallback: '/home' },
  { prefix: '/live/watch', fallback: '/live' },
  { prefix: '/content', fallback: '/home' },
  { prefix: '/search', fallback: '/home' },
  { prefix: '/settings', fallback: '/home' },
  { prefix: '/live', fallback: '/home' },
];

let stack: string[] = [];
let initialized = false;
let suppressHashTrack = false;

function getPathFromHash(): string {
  const raw = window.location.hash.slice(1) || '/';
  const qs = raw.indexOf('?');
  return qs === -1 ? raw : raw.slice(0, qs);
}

function familyOf(path: string): string {
  if (path.startsWith('/watch/')) return 'watch';
  if (path.startsWith('/live/watch/')) return 'live-watch';
  if (path.startsWith('/content/')) return 'content';
  if (path.startsWith('/live')) return 'live';
  return path;
}

function classify(prev: string, next: string): 'push' | 'replace' {
  if (prev === next) return 'replace';

  const prevFamily = familyOf(prev);
  const nextFamily = familyOf(next);

  if (prevFamily === nextFamily) {
    if (prevFamily === 'watch') {
      const prevContent = prev.split('/')[2];
      const nextContent = next.split('/')[2];
      return prevContent === nextContent ? 'replace' : 'push';
    }
    return 'replace';
  }

  return 'push';
}

export function resolveBackFallback(path: string = getPathFromHash()): string {
  for (const { prefix, fallback } of FALLBACK_BY_PREFIX) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return fallback;
    }
  }
  return DEFAULT_FALLBACK;
}

export function canNavigateBack(): boolean {
  return stack.length > 1;
}

export function getNavigationDepth(): number {
  return stack.length;
}

export function getCurrentAppPath(): string {
  return stack[stack.length - 1] ?? getPathFromHash();
}

export function navigateBack(options?: { fallback?: string }): void {
  const fallback = options?.fallback ?? resolveBackFallback();

  if (stack.length > 1) {
    stack.pop();
    window.history.back();
    return;
  }

  if (getPathFromHash() === fallback) return;

  suppressHashTrack = true;
  stack = [fallback];
  void routerReplace(fallback);
}

export function navigateTo(path: string): void {
  if (getPathFromHash() === path) return;
  stack.push(path);
  void routerPush(path);
}

export function replaceRoute(path: string): void {
  if (stack.length === 0) {
    stack = [path];
  } else {
    stack[stack.length - 1] = path;
  }
  if (getPathFromHash() === path) return;
  void routerReplace(path);
}

export function initAppNavigation(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  stack = [getPathFromHash()];

  const onHashChange = () => {
    const path = getPathFromHash();

    if (suppressHashTrack) {
      suppressHashTrack = false;
      if (stack.length === 0) stack = [path];
      else stack[stack.length - 1] = path;
      return;
    }

    if (stack.length === 0) {
      stack = [path];
      return;
    }

    const top = stack[stack.length - 1];
    if (path === top) return;

    if (stack.length > 1 && path === stack[stack.length - 2]) {
      stack.pop();
      return;
    }

    if (classify(top, path) === 'replace') {
      stack[stack.length - 1] = path;
      return;
    }

    stack.push(path);
  };

  window.addEventListener('hashchange', onHashChange);
}
