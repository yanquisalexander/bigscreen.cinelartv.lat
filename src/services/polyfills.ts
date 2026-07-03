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

if (!String.prototype.padStart) {
  Object.defineProperty(String.prototype, 'padStart', {
    value(targetLength: number, padString = ' ') {
      const source = String(this);
      const length = targetLength >> 0;
      if (source.length >= length) return source;
      const filler = String(padString || ' ');
      const repeated = filler.repeat(Math.ceil((length - source.length) / filler.length));
      return repeated.slice(0, length - source.length) + source;
    },
  });
}

if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value(searchElement: unknown, fromIndex = 0) {
      const list = Object(this) as ArrayLike<unknown>;
      const length = list.length >>> 0;
      if (length === 0) return false;
      let index = Math.max(fromIndex >= 0 ? fromIndex : length + fromIndex, 0);
      while (index < length) {
        const value = list[index];
        if (value === searchElement || (value !== value && searchElement !== searchElement)) return true;
        index += 1;
      }
      return false;
    },
  });
}

if (!Object.fromEntries) {
  Object.fromEntries = function fromEntries(entries: Iterable<readonly [PropertyKey, unknown]>) {
    const result: Record<PropertyKey, unknown> = {};
    for (const [key, value] of entries) {
      result[key] = value;
    }
    return result;
  };
}

if (!Promise.prototype.finally) {
  Promise.prototype.finally = function promiseFinally<TResult>(
    this: Promise<TResult>,
    onFinally?: (() => void) | null,
  ) {
    const promise = this.constructor as PromiseConstructor;
    return this.then(
      (value) => promise.resolve(onFinally?.()).then(() => value),
      (reason) => promise.resolve(onFinally?.()).then(() => {
        throw reason;
      }),
    );
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
  compatWindow.ResizeObserver = class ResizeObserverFallback {
    private readonly callback: ResizeObserverCallback;
    private readonly observed = new Set<Element>();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.observed.add(target);
      this.callback([], this as unknown as ResizeObserver);
    }

    unobserve(target: Element) {
      this.observed.delete(target);
    }

    disconnect() {
      this.observed.clear();
    }
  } as unknown as typeof ResizeObserver;
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
