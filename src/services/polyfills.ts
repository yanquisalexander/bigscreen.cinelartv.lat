import 'core-js/stable';
import 'whatwg-fetch';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import ResizeObserverPolyfill from 'resize-observer-polyfill';

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleCallbackHandle = number;
type IdleCallback = (deadline: IdleDeadline) => void;

type WindowWithCompat = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: IdleCallback, options?: { timeout?: number }) => IdleCallbackHandle;
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  };

const compatWindow = window as WindowWithCompat;

if (!AbortSignal.timeout) {
  AbortSignal.timeout = (milliseconds: number) => {
    const controller = new AbortController();
    const timeoutError = typeof DOMException === 'function'
      ? new DOMException('The operation timed out.', 'TimeoutError')
      : Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' });

    setTimeout(() => {
      controller.abort(timeoutError);
    }, milliseconds);

    return controller.signal;
  };
}

if (!compatWindow.queueMicrotask) {
  compatWindow.queueMicrotask = (callback) => {
    Promise.resolve()
      .then(callback)
      .catch((error) => setTimeout(() => {
        throw error;
      }, 0));
  };
}

if (!compatWindow.requestIdleCallback) {
  compatWindow.requestIdleCallback = (callback) => {
    const start = Date.now();
    return window.setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1);
  };
}

if (!compatWindow.cancelIdleCallback) {
  compatWindow.cancelIdleCallback = (handle) => window.clearTimeout(handle);
}

if (!compatWindow.ResizeObserver) {
  compatWindow.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

function detectFlexGap() {
  const flex = document.createElement('div');
  flex.style.display = 'flex';
  flex.style.flexDirection = 'column';
  flex.style.rowGap = '1px';

  const childA = document.createElement('div');
  const childB = document.createElement('div');
  childA.style.height = '1px';
  childB.style.height = '1px';
  flex.appendChild(childA);
  flex.appendChild(childB);

  document.body.appendChild(flex);
  const supported = flex.scrollHeight === 3;
  document.body.removeChild(flex);

  document.documentElement.classList.toggle('no-flex-gap', !supported);
}

if (document.body) {
  detectFlexGap();
} else {
  document.addEventListener('DOMContentLoaded', detectFlexGap, { once: true });
}
