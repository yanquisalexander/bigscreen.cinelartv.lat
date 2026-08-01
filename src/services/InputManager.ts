type InputHandler = (e: KeyboardEvent) => void;
type InputEventType = 'back' | 'playpause' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'enter' | 'space';

const BACK_KEYS = new Set(['Escape', 'Backspace', 'XF86Back', 'GoBack', 'BrowserBack', 'Back']);
const ENTER_KEYS = new Set(['Enter', ' ']);

export class InputManager {
  private static _instance: InputManager | null = null;
  private listeners = new Map<InputEventType, Set<InputHandler>>();
  private active = false;

  static getInstance(): InputManager {
    if (!InputManager._instance) {
      InputManager._instance = new InputManager();
    }
    return InputManager._instance;
  }

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (BACK_KEYS.has(e.key)) {
      this.dispatch('back', e);
    }
    if (ENTER_KEYS.has(e.key)) {
      this.dispatch('enter', e);
      if (e.key === ' ') this.dispatch('space', e);
    }
    if (e.key === ' ') this.dispatch('space', e);
    switch (e.key) {
      case 'ArrowUp': this.dispatch('arrow-up', e); break;
      case 'ArrowDown': this.dispatch('arrow-down', e); break;
      case 'ArrowLeft': this.dispatch('arrow-left', e); break;
      case 'ArrowRight': this.dispatch('arrow-right', e); break;
    }
    if (e.key === 'MediaPlayPause' || e.key === 'k' || e.key === 'K') {
      this.dispatch('playpause', e);
    }
  }

  private dispatch(type: InputEventType, e: KeyboardEvent) {
    const set = this.listeners.get(type);
    if (!set || set.size === 0) return;
    e.preventDefault();
    for (const handler of set) handler(e);
  }

  private totalListeners(): number {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }

  on(type: InputEventType, handler: InputHandler): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const hadListeners = this.totalListeners() > 0;
    set.add(handler);
    if (!hadListeners && !this.active) {
      this.active = true;
      window.addEventListener('keydown', this.handleKeyDown, true);
    }
  }

  off(type: InputEventType, handler: InputHandler): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(handler);
    if (this.totalListeners() === 0 && this.active) {
      this.active = false;
      window.removeEventListener('keydown', this.handleKeyDown, true);
    }
  }

  once(type: InputEventType, handler: InputHandler): void {
    const wrapper: InputHandler = (e) => {
      this.off(type, wrapper);
      handler(e);
    };
    this.on(type, wrapper);
  }
}

export const inputManager = InputManager.getInstance();
