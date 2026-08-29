import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';
import { FocusableRegistrar } from './spatialFocus';
import type { Segment } from '@/types/content';
import { ctvIconSheet } from '@/lib/ctvIcons';

const PARENT_FOCUS_KEY = 'watch-root';

@customElement('tv-player-skip-btn')
export class PlayerSkipButtonElement extends LitElement {
  static styles = css`
    :host { display: block; }

    .skip-btn {
      position: absolute;
      bottom: clamp(10rem, 20vh, 14rem);
      right: clamp(2rem, 4vw, 3rem);
      z-index: 25;
      display: flex;
      align-items: center;
      gap: clamp(0.5rem, 1vw, 0.75rem);
      padding: clamp(0.625rem, 1.2vw, 0.75rem) clamp(1rem, 2vw, 1.5rem);
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(12px);
      border-radius: clamp(0.75rem, 1.5vw, 1rem);
      color: #000000;
      font-size: clamp(0.875rem, 1.1vw, 1rem);
      font-weight: 600;
      cursor: pointer;
      outline: none;
      pointer-events: auto;
    }

    .skip-btn[data-focused="true"] {
      scale: 1.05;
      box-shadow: 0 0 0 4px #ffffff;
    }

    .skip-btn .chevron {
      width: clamp(1rem, 1.5vw, 1.25rem);
      height: clamp(1rem, 1.5vw, 1.25rem);
    }
  `;

  protected createRenderRoot(): Element | ShadowRoot {
    const root = super.createRenderRoot();
    const shadow = root as ShadowRoot;
    if (shadow.adoptedStyleSheets) {
      shadow.adoptedStyleSheets = [ctvIconSheet, ...shadow.adoptedStyleSheets];
    }
    return root;
  }

  @property({ type: Object, attribute: false }) segment: Segment | null = null;
  @property({ type: Boolean }) showControls = false;

  private registrar = new FocusableRegistrar();
  private _focusableRegistered = false;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.registrar.unregisterAll();
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('segment') || changedProperties.has('showControls')) {
      this._syncFocusable();
    }
  }

  render() {
    if (!this.segment) return html``;
    const label = this.segment.type === 'intro' || this.segment.segment_type === 'skip_intro' ? 'intro' : 'resumen';

    return html`
      <div class="skip-btn" data-skip-btn data-focused="false">
        <span>Omitir ${label}</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    `;
  }

  private _syncFocusable() {
    const btn = this.renderRoot.querySelector('[data-skip-btn]') as HTMLElement | null;
    if (this.segment && btn) {
      if (!this._focusableRegistered) {
        this._focusableRegistered = true;
        this.registrar.register([{
          focusKey: 'watch-skip',
          node: btn,
          parentFocusKey: PARENT_FOCUS_KEY,
          onEnterPress: () => this._handleSkip(),
          onArrowPress: () => true,
          onFocus: () => btn.setAttribute('data-focused', 'true'),
          onBlur: () => btn.setAttribute('data-focused', 'false'),
        }]);
      }
    } else if (this._focusableRegistered) {
      this._focusableRegistered = false;
      this.registrar.unregister('watch-skip');
    }
  }

  private _handleSkip() {
    if (!this.segment) return;
    const end = this.segment.end ?? this.segment.end_time ?? 0;
    this.dispatchEvent(new CustomEvent('skip', {
      bubbles: true,
      composed: true,
      detail: { endTime: end },
    }));
  }

  public focusSkip() {
    SpatialNavigation.setFocus('watch-skip');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tv-player-skip-btn': PlayerSkipButtonElement;
  }
}
