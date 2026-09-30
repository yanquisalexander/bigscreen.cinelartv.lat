import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';

const PARENT_FOCUS_KEY = 'watch-root';
const PROMO_ROOT_KEY = 'promo-bar';

@customElement('tv-promo-bar')
export class PromoBarElement extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      bottom: 3rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 60;
      display: block;
      width: 70rem;
      max-width: calc(100vw - 4rem);
      pointer-events: none;
    }

    .promo-bar {
      position: relative;
      width: 100%;
      height: 4rem;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 1.5rem;
      padding: 0.75rem 1rem 0.75rem 1.5rem;
      background-color: rgba(0,0,0,0.85);
      border-radius: 1.125rem;
      box-sizing: border-box;
      pointer-events: auto;
      animation: slideUp 200ms ease-out both;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .promo-thumbnail {
      width: 7.3rem;
      height: 3rem;
      flex-shrink: 0;
      border-radius: 0.6rem;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 800;
      font-size: 1.1rem;
    }

    .promo-content {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      overflow: hidden;
      white-space: nowrap;
    }
    .promo-title { color: #fff; font-size: 1rem; font-weight: 500; }
    .promo-subtitle { color: rgba(255,255,255,0.7); font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; }

    .promo-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
      margin-left: auto;
    }

    .promo-btn {
      height: 2.25rem;
      padding: 0 1rem;
      border-radius: 1.125rem;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      border: none;
      outline: none;
      line-height: 2.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      transition: background-color 150ms ease, color 150ms ease;
    }

    .btn-cta {
      background: rgba(255,255,255,0.18);
      color: #f1f1f1;
    }
    .btn-cta[data-focused="true"] {
      background: #fff;
      color: #0f0f0f;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.5);
    }

    .btn-dismiss {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7);
    }
    .btn-dismiss[data-focused="true"] {
      background: #f1f1f1;
      color: #0f0f0f;
    }
  `;

  @state() private _visible = false;

  connectedCallback() {
    super.connectedCallback();
    this._visible = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._visible = false;
    this._teardownFocusables();
  }

  protected updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('_visible')) {
      if (this._visible) {
        this._syncFocusables();
      } else {
        this._teardownFocusables();
      }
    }
  }

  render() {
    if (!this._visible) return html``;
    return html`
      <div class="promo-bar">
        <div class="promo-content">
          <span class="promo-title">Obten CinelarTV+ sin anuncios</span>
          <span class="promo-subtitle">Mira sin anuncios, sin conexión y en segundo plano.</span>
        </div>
        <div class="promo-actions">
          <tv-focusable
            focus-key="promo-cta"
            parent-focus-key="${PROMO_ROOT_KEY}"
            class="promo-btn btn-cta"
            @enter-press=${this._handleCta}
            @arrow-press=${this._onArrow}
          >Obtener ahora</tv-focusable>
          <tv-focusable
            focus-key="promo-dismiss"
            parent-focus-key="${PROMO_ROOT_KEY}"
            class="promo-btn btn-dismiss"
            @enter-press=${this._handleDismiss}
            @arrow-press=${this._onArrow}
          >No, gracias</tv-focusable>
        </div>
      </div>
    `;
  }

  public show() { this._visible = true; }
  public dismiss() { this._handleDismiss(); }

  private _syncFocusables() {
    // Register promo-bar as a focus boundary under watch-root so only
    // promo buttons are reachable while the bar is visible.
    try {
      SpatialNavigation.addFocusable({
        focusKey: PROMO_ROOT_KEY,
        parentFocusKey: PARENT_FOCUS_KEY,
        isFocusBoundary: true,
        trackChildren: true,
        autoRestoreFocus: true,
        preferredChildFocusKey: 'promo-cta',
        onUpdateFocus: () => {},
        onUpdateHasFocusedChild: () => {},
      });
    } catch {
      // Already registered
    }

    // Children (tv-focusable promo-cta / promo-dismiss) self-register
    // under PROMO_ROOT_KEY via their parent-focus-key attribute.
  }

  private _teardownFocusables() {
    try {
      SpatialNavigation.removeFocusable({ focusKey: PROMO_ROOT_KEY });
    } catch {
      // noop
    }
  }

  private _handleDismiss() {
    this._visible = false;
    this.dispatchEvent(new CustomEvent('promo-dismiss', { bubbles: true, composed: true }));
  }

  private _handleCta() {
    this.dispatchEvent(new CustomEvent('promo-cta', { bubbles: true, composed: true }));
  }

  private _onArrow(e: CustomEvent) {
    const dir = e.detail?.direction;
    const current = (e.target as HTMLElement)?.getAttribute('focus-key') ?? '';

    // Always block natural SpatialNavigation escape from the promo boundary
    e.preventDefault();

    if (dir === 'right' && current === 'promo-cta') {
      SpatialNavigation.setFocus('promo-dismiss');
    } else if (dir === 'left' && current === 'promo-dismiss') {
      SpatialNavigation.setFocus('promo-cta');
    }
    // up/down and edge cases: stay put (preventDefault already applied)
  }
}
