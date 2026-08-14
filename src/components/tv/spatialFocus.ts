import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';
import type { FocusableComponentLayout, FocusDetails, KeyPressDetails } from '@noriginmedia/norigin-spatial-navigation-core';

export interface FocusableItem {
  focusKey: string;
  node: HTMLElement;
  parentFocusKey: string;
  onEnterPress?: (details?: KeyPressDetails) => void;
  onEnterRelease?: () => void;
  onArrowPress?: (direction: string, details: KeyPressDetails) => boolean;
  onArrowRelease?: (direction: string) => void;
  onFocus?: (layout: FocusableComponentLayout, details: FocusDetails) => void;
  onBlur?: (layout: FocusableComponentLayout, details: FocusDetails) => void;
  onUpdateFocus?: (focused: boolean) => void;
  onUpdateHasFocusedChild?: (hasFocusedChild: boolean) => void;
  trackChildren?: boolean;
  saveLastFocusedChild?: boolean;
  isFocusBoundary?: boolean;
  autoRestoreFocus?: boolean;
  forceFocus?: boolean;
  preferredChildFocusKey?: string;
}

/**
 * Centralizes the focusable registration logic that was previously
 * copy-pasted across EpisodesRailElement, PlayerSettingsElement and
 * AdOverlayElement. Keeps a single source of truth for the registered
 * keys so unregister is always complete and leak-free.
 */
export class FocusableRegistrar {
  private registered: string[] = [];

  register(items: FocusableItem[]): void {
    for (const item of items) {
      if (this.registered.includes(item.focusKey)) continue;
      this.registered.push(item.focusKey);
      SpatialNavigation.addFocusable({
        focusKey: item.focusKey,
        node: item.node,
        parentFocusKey: item.parentFocusKey,
        focusable: true,
        trackChildren: item.trackChildren ?? false,
        saveLastFocusedChild: item.saveLastFocusedChild ?? false,
        isFocusBoundary: item.isFocusBoundary ?? false,
        autoRestoreFocus: item.autoRestoreFocus ?? true,
        forceFocus: item.forceFocus ?? false,
        preferredChildFocusKey: item.preferredChildFocusKey,
        onEnterPress: item.onEnterPress ?? (() => {}),
        onEnterRelease: item.onEnterRelease ?? (() => {}),
        onArrowPress: item.onArrowPress ?? (() => true),
        onArrowRelease: item.onArrowRelease ?? (() => {}),
        onFocus: item.onFocus ?? (() => {}),
        onBlur: item.onBlur ?? (() => {}),
        onUpdateFocus: item.onUpdateFocus ?? (() => {}),
        onUpdateHasFocusedChild: item.onUpdateHasFocusedChild ?? (() => {}),
      });
    }
  }

  unregister(focusKey: string): void {
    const idx = this.registered.indexOf(focusKey);
    if (idx === -1) return;
    this.registered.splice(idx, 1);
    SpatialNavigation.removeFocusable({ focusKey });
  }

  unregisterAll(): void {
    for (const key of this.registered) {
      SpatialNavigation.removeFocusable({ focusKey: key });
    }
    this.registered = [];
  }
}
