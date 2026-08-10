type EventCallback<T = unknown> = (data: T) => void;

interface EventEntry {
  callback: EventCallback;
  once: boolean;
}

export interface PlatformEvents {
  'media.finished': void;
  'media.error': { code?: number | string; message?: string };
  'account.profileChanged': void;
  'account.loggedOut': void;
  'bridge.connected': { version: number };
  'bridge.disconnected': void;
}

type EventName = keyof PlatformEvents;

class TypedEventEmitter {
  private listeners = new Map<string, Set<EventEntry>>();

  on<K extends EventName>(
    event: K,
    callback: EventCallback<PlatformEvents[K]>,
  ): () => void {
    return this.addListener(event, callback, false);
  }

  once<K extends EventName>(
    event: K,
    callback: EventCallback<PlatformEvents[K]>,
  ): () => void {
    return this.addListener(event, callback, true);
  }

  off<K extends EventName>(
    event: K,
    callback: EventCallback<PlatformEvents[K]>,
  ): void {
    const entries = this.listeners.get(event);
    if (!entries) return;
    for (const entry of entries) {
      if (entry.callback === callback) {
        entries.delete(entry);
        break;
      }
    }
  }

  emit<K extends EventName>(event: K, data: PlatformEvents[K]): void {
    const entries = this.listeners.get(event);
    if (!entries) return;
    for (const entry of [...entries]) {
      entry.callback(data);
      if (entry.once) entries.delete(entry);
    }
  }

  removeAllListeners(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  private addListener<K extends EventName>(
    event: K,
    callback: EventCallback<PlatformEvents[K]>,
    once: boolean,
  ): () => void {
    let entries = this.listeners.get(event);
    if (!entries) {
      entries = new Set();
      this.listeners.set(event, entries);
    }
    const entry: EventEntry = { callback, once };
    entries.add(entry);
    return () => entries!.delete(entry);
  }
}

export const platformEvents = new TypedEventEmitter();
