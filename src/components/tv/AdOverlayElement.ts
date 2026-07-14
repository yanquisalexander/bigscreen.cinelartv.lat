import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation';
import { FocusableRegistrar } from './spatialFocus';
import { trackImpression, trackEvent, trackError, selectMediaFile } from '@/services/player/vast-client';
import type { VastAd } from '@/types/vast';

const FOCUS_KEY_ROOT = 'ad-overlay';

class AdOverlayElement extends HTMLElement {
  private _ad: VastAd | null = null;
  private _skipOffset = 5;
  private _canSkip = false;
  private _isMuted = false;
  private _video: HTMLVideoElement | null = null;
  private _progressEl: HTMLDivElement | null = null;
  private _skipBtnEl: HTMLDivElement | null = null;
  private _skipLabelEl: HTMLSpanElement | null = null;
  private _muteBtnEl: HTMLDivElement | null = null;
  private _timeEl: HTMLSpanElement | null = null;
  private _spinnerEl: HTMLDivElement | null = null;
  private _quartiles = { q1: false, q2: false, q3: false };
  private _registrar = new FocusableRegistrar();
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;

  static get observedAttributes() { return ['skip-offset']; }

  set ad(value: VastAd | null) {
    this._ad = value;
    if (value) {
      this._canSkip = false;
      this._quartiles = { q1: false, q2: false, q3: false };
      this._isMuted = false;
      this.render();
      requestAnimationFrame(() => this.startPlayback());
    } else {
      this.teardown();
      this.innerHTML = '';
    }
  }

  attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
    if (name === 'skip-offset') this._skipOffset = parseInt(newValue || '5', 10);
  }

  connectedCallback() {
    if (this._ad) {
      this.render();
      requestAnimationFrame(() => this.startPlayback());
    }
  }

  disconnectedCallback() { this.teardown(); }

  private teardown() {
    if (this._video) {
      this._video.pause();
      this._video.removeAttribute('src');
      this._video.load();
      this._video = null;
    }
    this.unregisterFocusables();
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
  }

  private startPlayback() {
    this._video = this.querySelector('video');
    if (!this._video || !this._ad) return;

    const mediaFile = selectMediaFile(this._ad);
    if (!mediaFile) {
      trackError(this._ad);
      this.finishAd();
      return;
    }

    this._progressEl = this.querySelector('[data-ad-progress]');
    this._skipBtnEl = this.querySelector('[data-ad-skip]');
    this._skipLabelEl = this.querySelector('[data-ad-skip-label]');
    this._muteBtnEl = this.querySelector('[data-ad-mute]');
    this._timeEl = this.querySelector('[data-ad-time]');
    this._spinnerEl = this.querySelector('[data-ad-spinner]');

    const video = this._video;
    video.src = mediaFile.url;
    video.load();

    video.addEventListener('play', () => this.onAdPlay());
    video.addEventListener('waiting', () => this.showSpinner(true));
    video.addEventListener('playing', () => this.showSpinner(false));
    video.addEventListener('timeupdate', () => this.onTimeUpdate());
    video.addEventListener('ended', () => this.finishAd());
    video.addEventListener('error', () => this.onAdError());

    // Listener de click explícito para mayor robustez en TV
    this._skipBtnEl?.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSkip();
    });

    video.play().catch(() => this.showSpinner(false));

    this.registerFocusables();
    this.installKeyHandler();
  }

  private onAdPlay() {
    this.showSpinner(false);
    if (this._ad) trackImpression(this._ad);
  }

  private onTimeUpdate() {
    const video = this._video;
    if (!video) return;
    const ct = video.currentTime;
    const dur = video.duration || 0;

    // Sincronización del countdown basada en reproducción real
    if (!this._canSkip && ct >= this._skipOffset) {
        this._canSkip = true;
        this.updateSkipUI();
        requestAnimationFrame(() => SpatialNavigation.setFocus(`${FOCUS_KEY_ROOT}-skip`));
    } else if (!this._canSkip) {
        this.updateSkipUI();
    }

    if (this._progressEl && dur > 0) this._progressEl.style.width = `${(ct / dur) * 100}%`;
    if (this._timeEl && dur > 0) this._timeEl.textContent = `${this.formatTime(ct)} / ${this.formatTime(dur)}`;
    
    if (dur > 0 && this._ad) {
        if (!this._quartiles.q1 && ct >= dur * 0.25) { this._quartiles.q1 = true; trackEvent(this._ad, 'firstQuartile'); }
        if (!this._quartiles.q2 && ct >= dur * 0.5) { this._quartiles.q2 = true; trackEvent(this._ad, 'midpoint'); }
        if (!this._quartiles.q3 && ct >= dur * 0.75) { this._quartiles.q3 = true; trackEvent(this._ad, 'thirdQuartile'); }
    }
  }

  private updateSkipUI() {
    if (this._canSkip && this._skipBtnEl) {
      this._skipBtnEl.style.display = 'flex';
      const countdownEl = this.querySelector('[data-ad-countdown]');
      if (countdownEl) (countdownEl as HTMLElement).style.display = 'none';
    } else if (this._skipLabelEl) {
      const remaining = Math.max(0, Math.ceil(this._skipOffset - (this._video?.currentTime || 0)));
      this._skipLabelEl.textContent = `Saltar en ${remaining}s`;
    }
  }

  private showSpinner(visible: boolean) {
    if (this._spinnerEl) this._spinnerEl.style.display = visible ? 'flex' : 'none';
  }

  private handleSkip = () => {
    if (!this._canSkip || !this._ad) return;
    trackEvent(this._ad, 'skip');
    this.finishAd();
  };

  private handleMute = () => {
    if (!this._video) return;
    this._video.muted = !this._video.muted;
    this._isMuted = this._video.muted;
    if (this._muteBtnEl) this._muteBtnEl.innerHTML = this._isMuted ? this.iconVolumeOff() : this.iconVolumeOn();
  };

  private finishAd() {
    if (this._ad) trackEvent(this._ad, 'complete');
    this.teardown();
    this.dispatchEvent(new CustomEvent('ad-complete', { bubbles: true, composed: true }));
  }

  private onAdError() {
    if (this._ad) trackError(this._ad);
    this.finishAd();
  }

  private installKeyHandler() {
    this._keyHandler = (e: KeyboardEvent) => {
      if (!this._ad) return;
      if (e.key === 'm' || e.key === 'M') this.handleMute();
    };
    window.addEventListener('keydown', this._keyHandler, true);
  }

  private registerFocusables() {
    const items = [
      { key: `${FOCUS_KEY_ROOT}-skip`, activate: () => this.handleSkip() },
      { key: `${FOCUS_KEY_ROOT}-mute`, activate: () => this.handleMute() },
    ].map((item) => {
      const el = this.querySelector(`[data-focus-key="${item.key}"]`) as HTMLElement | null;
      if (!el) return null;
      return {
        focusKey: item.key,
        node: el,
        parentFocusKey: FOCUS_KEY_ROOT,
        onEnterPress: () => item.activate(),
        onArrowPress: () => true,
        onUpdateFocus: (focused: boolean) => {
          el.style.transform = focused ? 'scale(1.05)' : 'scale(1)';
          el.style.boxShadow = focused ? '0 0 0 2px rgba(255,255,255,0.8)' : 'none';
        },
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    this._registrar.register(items);
  }

  private unregisterFocusables() {
    this._registrar.unregisterAll();
  }

  private formatTime(s: number): string {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  private iconVolumeOn(): string { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`; }
  private iconVolumeOff(): string { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`; }
  private iconChevronRight(): string { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`; }

  private render() {
    if (!this._ad) return;
    this.innerHTML = `
      <style>
        tv-ad-overlay { position: fixed; inset: 0; z-index: 50; background: #000; display: block; }
        tv-ad-overlay video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center; display: block; }
        [data-focus-key] { cursor: pointer; outline: none; transition: transform 150ms ease, box-shadow 150ms ease; }
        @keyframes ad-spin { to { transform: rotate(360deg); } }
      </style>
      <video playsinline autoplay></video>
      <div data-ad-spinner style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <div style="width:40px;height:40px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:ad-spin 0.8s linear infinite;"></div>
      </div>
      <div style="position:absolute;top:0;left:0;right:0;background:linear-gradient(to bottom,rgba(0,0,0,0.7),transparent,transparent);padding:24px;pointer-events:none;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:600;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);padding:6px 12px;border-radius:8px;">Anuncio</span>
          <span data-ad-time style="color:rgba(255,255,255,0.5);font-size:12px;font-variant-numeric:tabular-nums;"></span>
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.1);">
        <div data-ad-progress style="height:100%;background:rgba(255,255,255,0.7);width:0%;"></div>
      </div>
      <div style="position:absolute;bottom:24px;right:24px;display:flex;align-items:center;gap:12px;">
        <div data-focus-key="${FOCUS_KEY_ROOT}-mute" data-ad-mute style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.7);">${this.iconVolumeOn()}</div>
        <div data-ad-countdown style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:rgba(255,255,255,0.1);backdrop-filter:blur(8px);border-radius:12px;color:rgba(255,255,255,0.6);font-size:14px;"><span data-ad-skip-label>Saltar en ${this._skipOffset}s</span></div>
        <div data-focus-key="${FOCUS_KEY_ROOT}-skip" data-ad-skip style="display:none;align-items:center;gap:8px;padding:10px 16px;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border-radius:12px;color:#000;font-size:14px;font-weight:600;"><span>Saltar anuncio</span>${this.iconChevronRight()}</div>
      </div>
    `;
  }
}

customElements.define('tv-ad-overlay', AdOverlayElement);
