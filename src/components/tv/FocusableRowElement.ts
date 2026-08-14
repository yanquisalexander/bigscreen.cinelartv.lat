import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';
import { FocusableRegistrar } from './spatialFocus';

class FocusableRowElement extends HTMLElement {
  static get observedAttributes() {
    return ['focus-key', 'title', 'preferred-child-focus-key'];
  }

  private registrar = new FocusableRegistrar();
  private _focusKey: string | null = null;
  private _rafId = 0;
  private _viewport: HTMLElement | null = null;
  private _observer: MutationObserver | null = null;

  set focusKey(value: string | null) {
    this._focusKey = value;
    this.setAttribute('data-focus-key', value ?? '');
  }

  get focusKey(): string | null {
    return this._focusKey;
  }

  attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
    if (name === 'focus-key') this.focusKey = newValue;
    if (name === 'title') {
      const titleEl = this.querySelector('[data-row-title]');
      if (titleEl) titleEl.textContent = newValue ?? '';
    }
    if (name === 'preferred-child-focus-key') {
      this._register();
    }
  }

  connectedCallback() {
    this.setAttribute('role', 'region');
    this._render();
    this._viewport = this.querySelector('[data-row-viewport]');
    this._setupScrollObserver();
    this._register();
  }

  disconnectedCallback() {
    this.registrar.unregisterAll();
    if (this._observer) this._observer.disconnect();
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  private _render() {
    const title = this.getAttribute('title') || '';
    this.innerHTML = `
      <div data-row-container style="
        width: 100%;
        margin-bottom: clamp(1.5rem, 4vh, 2rem);
      ">
        ${title ? `<h2 data-row-title style="
          font-size: clamp(1rem, 1.4vw, 1.125rem);
          font-weight: 700;
          color: #ffffff;
          margin-bottom: clamp(0.75rem, 2vh, 1rem);
          padding: 0 clamp(3rem, 7.5vw, 6rem);
        ">${title}</h2>` : ''}
        <div data-row-viewport style="
          width: 100%;
          display: flex;
          gap: clamp(0.5rem, 1vw, 0.75rem);
          overflow-x: auto;
          padding: clamp(0.5rem, 1.4vw, 0.75rem) clamp(3rem, 7.5vw, 6rem);
          scroll-snap-type: x proximity;
          scroll-padding-inline: clamp(2rem, 4vw, 3rem);
          -ms-overflow-style: none;
          scrollbar-width: none;
        "></div>
      </div>
      <style>
        [data-row-viewport]::-webkit-scrollbar { display: none; }
        [data-row-item]:focus { outline: none; }
      </style>
    `;
  }

  private _register() {
    this.registrar.unregisterAll();
    if (!this._focusKey) return;

    const preferredChild = this.getAttribute('preferred-child-focus-key') ?? undefined;
    this.registrar.register([{
      focusKey: this._focusKey,
      node: this,
      parentFocusKey: this.getAttribute('parent-focus-key') ?? '',
      trackChildren: true,
      saveLastFocusedChild: true,
      preferredChildFocusKey: preferredChild,
      onFocus: () => {
        this.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      },
    }]);
  }

  private _setupScrollObserver() {
    if (!this._viewport) return;

    const handleScroll = () => {
      cancelAnimationFrame(this._rafId);
      this._rafId = requestAnimationFrame(() => {
        const focused = this._viewport!.querySelector<HTMLElement>('[data-focused="true"]');
        if (!focused) return;

        const rect = focused.getBoundingClientRect();
        const containerRect = this._viewport!.getBoundingClientRect();
        const offset = rect.left - containerRect.left - (containerRect.width / 2) + (rect.width / 2);
        this._viewport!.scrollBy({ left: offset, behavior: 'auto' });
      });
    };

    this._observer = new MutationObserver(handleScroll);
    this._observer.observe(this._viewport, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-focused'],
    });
  }

  appendItem(node: HTMLElement) {
    this._viewport?.appendChild(node);
  }

  setFocusChild(key?: string) {
    if (key) {
      SpatialNavigation.setFocus(key);
    } else if (this._focusKey) {
      const firstChild = this._viewport?.querySelector('[data-focus-key]');
      if (firstChild) {
        const childKey = firstChild.getAttribute('data-focus-key');
        if (childKey) SpatialNavigation.setFocus(childKey);
      }
    }
  }
}

customElements.define('tv-focusable-row', FocusableRowElement);

export { FocusableRowElement };
