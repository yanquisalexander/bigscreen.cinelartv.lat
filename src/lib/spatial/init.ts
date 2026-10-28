import { init, setKeyMap, GetBoundingClientRectAdapter } from '@noriginmedia/norigin-spatial-navigation-core';

let initialized = false;

export function initSpatialNavigation() {
  if (initialized) return;
  initialized = true;

  init({
    debug: false,
    throttle: 80,
    layoutAdapter: GetBoundingClientRectAdapter,
  });

  setKeyMap({
    left: [37],
    up: [38],
    right: [39],
    down: [40],
    enter: [13],
  });
}

// Initialize immediately so spatial nav is available early
initSpatialNavigation();
