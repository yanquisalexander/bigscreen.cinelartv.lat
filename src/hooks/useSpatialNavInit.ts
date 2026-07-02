import { useEffect } from 'react';
import { init, setKeyMap } from '@noriginmedia/norigin-spatial-navigation';

let initialized = false;

export function useSpatialNavInit() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;

    init({
      debug: false,
      throttle: 80,
    });

    setKeyMap({
      left: [37],
      up: [38],
      right: [39],
      down: [40],
      enter: [13],
    });
  }, []);
}
