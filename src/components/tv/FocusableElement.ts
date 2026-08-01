import { SpatialNavigation, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { FocusableRegistrar } from './spatialFocus';

class FocusableElement extends HTMLElement {
  static get observedAttributes() {
    return ['focus-key', 'open', 'disabled', 'focusable'];
  }

  private registrar = new FocusableRegistrar();
  private _focusKey: string | null = null;
  private _disabled = false;
  private _focusable = true;
  private _registered = false;

  set focusKey(value: string | null) {
    if (value === this._focusKey) return;
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

  set disabled(value: boolean) {
    this._disabled = value;
    this._syncRegistration();
  }

  get disabled(): boolean {
    return this._disabled;
  }

  set focusable(value: boolean) {
    this._focusable = value;
    this._syncRegistration();
  }

  get focusable(): boolean {
    return this._focusable;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'focus-key') {
      this.focusKey = newValue;
    }
    if (name === 'disabled') {
      this.disabled = newValue === 'true' || newValue === '';
    }
    if (name === 'focusable') {
      this.focusable = newValue !== 'false';
    }
  }

  connectedCallback() {
    this.setAttribute('role', 'button');
    this._syncRegistration();
  }

  disconnectedCallback() {
    this.registrar.unregisterAll();
    this._registered = false;
  }

  private _register() {
    if (this._registered || !this._focusKey || this._disabled || !this._focusable) return;
    this.registrar.register([
      {
        focusKey: this._focusKey,
        node: this,
        parentFocusKey: this.getAttribute('parent-focus-key') ?? '',
        trackChildren: this.getAttribute('track-children') === 'true',
        saveLastFocusedChild: this.getAttribute('save-last-focused-child') === 'true',
        preferredChildFocusKey: this.getAttribute('preferred-child-focus-key') ?? undefined,
        isFocusBoundary: this.getAttribute('focus-boundary') === 'true',
        onEnterPress: () => {
          const currentFocus = getCurrentFocusKey();
          if (currentFocus && currentFocus !== this._focusKey) return;
          this.dispatchEvent(new CustomEvent('enter-press', { bubbles: true, composed: true }));
        },
        onArrowPress: (direction: string) => {
          const event = new CustomEvent('arrow-press', { bubbles: true, composed: true, detail: { direction }, cancelable: true });
          const notCancelled = this.dispatchEvent(event);
          return notCancelled; // true si nadie llamó preventDefault()
        },
        onFocus: () => {
          this.dispatchEvent(new CustomEvent('focus-gained', { bubbles: true, composed: true }));
          this.setAttribute('data-focused', 'true');
        },
        onBlur: () => {
          this.dispatchEvent(new CustomEvent('focus-lost', { bubbles: true, composed: true }));
          this.setAttribute('data-focused', 'false');
        },
      },
    ]);
    this._registered = true;
  }

  private _syncTabIndex() {
    this.setAttribute('tabindex', this._disabled || !this._focusable ? '-1' : '0');
    this.setAttribute('aria-disabled', String(this._disabled || !this._focusable));
  }

  private _syncRegistration() {
    this._syncTabIndex();
    if (this._registered && (this._disabled || !this._focusable)) {
      this.registrar.unregisterAll();
      this._registered = false;
    }
    this._register();
  }

  setFocus() {
    if (this._focusKey && !this._disabled) {
      SpatialNavigation.setFocus(this._focusKey);
    }
  }
}

customElements.define('tv-focusable', FocusableElement);

export { FocusableElement };
