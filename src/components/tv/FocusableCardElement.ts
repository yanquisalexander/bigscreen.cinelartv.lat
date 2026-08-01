import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation';
import { FocusableRegistrar } from './spatialFocus';
import { resolveImageUrl } from '@/utils/helpers';

class FocusableCardElement extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'image', 'subtitle', 'progress', 'focus-key', 'client-endpoint', 'focusable'];
  }

  private registrar = new FocusableRegistrar();
  private _focusKey: string | null = null;
  private _focusable = true;
  private _registered = false;

  set focusKey(value: string | null) {
    if (this._registered) {
      this.registrar.unregisterAll();
      this._registered = false;
    }
    this._focusKey = value;
    this._register();
  }

  get focusKey(): string | null {
    return this._focusKey;
  }

  set focusable(value: boolean) {
    this._focusable = value;
    this._syncRegistration();
  }

  get focusable(): boolean {
    return this._focusable;
  }

  attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
    if (name === 'focus-key') this.focusKey = newValue;
    if (name === 'title') this._updateTitle(newValue ?? '');
    if (name === 'image') this._updateImage(newValue ?? '');
    if (name === 'subtitle') this._updateSubtitle(newValue ?? '');
    if (name === 'progress') this._updateProgress(parseFloat(newValue ?? '0') || 0);
    if (name === 'client-endpoint') this._updateImage(this.getAttribute('image') ?? '');
    if (name === 'focusable') this.focusable = newValue !== 'false';
  }

  connectedCallback() {
    this.setAttribute('role', 'button');
    this._syncTabIndex();
    this._render();
    this._register();
    this.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback() {
    this.registrar.unregisterAll();
    this._registered = false;
    this.removeEventListener('keydown', this._handleKeyDown);
  }

  private _render() {
    const title = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const progress = parseFloat(this.getAttribute('progress') ?? '0') || 0;
    const image = this.getAttribute('image') || '';

    this.innerHTML = `
      <div data-card style="
        width: clamp(156px, 18vw, 230px);
        border-radius: 0.75rem;
        overflow: hidden;
        background: #262626;
        transition: transform 200ms ease-out, box-shadow 200ms ease-out, border 200ms ease-out;
        border: 2px solid transparent;
        position: relative;
      ">
        ${image
        ? `<img data-card-image src="${image}" alt="${title}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" decoding="async">`
        : `<div data-card-placeholder style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#262626;color:#525252;font-size:22px;">?</div>`
      }
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6),transparent);pointer-events:none;"></div>
        ${progress > 0 ? `<div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.2);"><div data-card-progress style="height:100%;background:#fff;width:0%;"></div></div>` : ''}
        <div style="position:absolute;bottom:0;left:0;right:0;padding:clamp(0.5rem,1.2vw,0.75rem);">
          <p data-card-title style="color:#fff;font-size:clamp(0.75rem,1.1vw,0.875rem);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</p>
          ${subtitle ? `<p data-card-subtitle style="color:#8e8e93;font-size:clamp(0.6875rem,0.95vw,0.75rem);margin-top:0.25rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subtitle}</p>` : ''}
        </div>
      </div>
      <style>
        [data-card]:focus { outline: none; }
      </style>
    `;
    this._updateProgress(progress);
  }

  private _updateTitle(title: string) {
    const el = this.querySelector('[data-card-title]');
    if (el) el.textContent = title;
  }

  private _updateImage(url: string) {
    const el = this.querySelector('[data-card-image]') as HTMLImageElement | null;
    const placeholder = this.querySelector('[data-card-placeholder]');
    const resolved = resolveImageUrl(url, this.getAttribute('client-endpoint') ?? undefined);
    if (el) {
      el.src = resolved ?? '';
      el.style.display = resolved ? 'block' : 'none';
    }
    if (placeholder) placeholder.style.display = resolved ? 'none' : 'flex';
  }

  private _updateSubtitle(subtitle: string) {
    let el = this.querySelector('[data-card-subtitle]');
    if (!subtitle) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('p');
      el.setAttribute('data-card-subtitle', '');
      el.style.cssText = 'color:#8e8e93;font-size:clamp(0.6875rem,0.95vw,0.75rem);margin-top:0.25rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const container = this.querySelector('[data-card] > div:nth-child(3)');
      if (container) container.appendChild(el);
    }
    el.textContent = subtitle;
  }

  private _updateProgress(pct: number) {
    let bar = this.querySelector('[data-card-progress]') as HTMLElement | null;
    if (!bar) {
      const track = document.createElement('div');
      track.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.2);';
      bar = document.createElement('div');
      bar.setAttribute('data-card-progress', '');
      bar.style.cssText = 'height:100%;background:#fff;width:0%;';
      track.appendChild(bar);
      const card = this.querySelector('[data-card]');
      if (card) card.insertBefore(track, card.firstChild);
    }
    bar.style.width = `${Math.min(pct, 100)}%`;
  }

  private _register() {
    if (this._registered || !this._focusKey || !this._focusable) return;
    this.registrar.register([{
      focusKey: this._focusKey,
      node: this,
      parentFocusKey: this.getAttribute('parent-focus-key') ?? '',
      onEnterPress: () => {
        this.dispatchEvent(new CustomEvent('enter-press', { bubbles: true, composed: true }));
      },
      onArrowPress: (direction: string) => {
        const event = new CustomEvent('arrow-press', {
          bubbles: true,
          composed: true,
          detail: { direction },
        });
        this.dispatchEvent(event);
        return (event as any).defaultPrevented;
      },
      onFocus: () => {
        const card = this.querySelector('[data-card]') as HTMLElement;
        if (card) {
          card.style.transform = 'scale(1.05)';
          card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.6)';
          card.style.borderColor = 'rgba(255,255,255,0.8)';
        }
      },
      onBlur: () => {
        const card = this.querySelector('[data-card]') as HTMLElement;
        if (card) {
          card.style.transform = '';
          card.style.boxShadow = '';
          card.style.borderColor = '';
        }
      },
    }]);
    this._registered = true;
  }

  private _syncTabIndex() {
    this.setAttribute('tabindex', this._focusable ? '0' : '-1');
    this.setAttribute('aria-disabled', String(!this._focusable));
  }

  private _syncRegistration() {
    this._syncTabIndex();
    if (this._registered && !this._focusable) {
      this.registrar.unregisterAll();
      this._registered = false;
    }
    this._register();
  }

  private _handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('enter-press', { bubbles: true, composed: true }));
    }
  };

  setFocus() {
    if (this._focusKey) SpatialNavigation.setFocus(this._focusKey);
  }
}

customElements.define('tv-focusable-card', FocusableCardElement);

export { FocusableCardElement };
