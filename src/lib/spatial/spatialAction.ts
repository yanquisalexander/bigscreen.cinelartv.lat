import { SpatialNavigation, setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
import type { KeyPressDetails, FocusableComponentLayout, FocusDetails } from '@noriginmedia/norigin-spatial-navigation-core';
import { playFocusSound } from '@/hooks/useNavigationSound';

export interface SpatialNavParams {
  focusKey: string;
  parentFocusKey?: string;
  focusable?: boolean;
  trackChildren?: boolean;
  saveLastFocusedChild?: boolean;
  preferredChildFocusKey?: string;
  autoRestoreFocus?: boolean;
  forceFocus?: boolean;
  isFocusBoundary?: boolean;
  playSound?: boolean;
  autoFocus?: boolean;
  onEnterPress?: (details?: KeyPressDetails) => void;
  onArrowPress?: (direction: string, details: KeyPressDetails) => boolean;
  onFocus?: (layout: FocusableComponentLayout, details: FocusDetails) => void;
  onBlur?: (layout: FocusableComponentLayout, details: FocusDetails) => void;
  onUpdateFocus?: (focused: boolean) => void;
  onUpdateHasFocusedChild?: (hasFocusedChild: boolean) => void;
}

let keySeq = 0;
export function generateFocusKey(prefix = 'sn-item'): string {
  return `${prefix}-${++keySeq}`;
}

export function spatialNav(node: HTMLElement, initialParams: SpatialNavParams) {
  let currentParams = { ...initialParams };
  let currentFocusKey = currentParams.focusKey;

  function register(params: SpatialNavParams) {
    currentFocusKey = params.focusKey;
    SpatialNavigation.addFocusable({
      focusKey: params.focusKey,
      node,
      parentFocusKey: params.parentFocusKey ?? 'SN:ROOT',
      focusable: params.focusable ?? true,
      trackChildren: params.trackChildren ?? false,
      saveLastFocusedChild: params.saveLastFocusedChild ?? false,
      autoRestoreFocus: params.autoRestoreFocus ?? true,
      forceFocus: params.forceFocus ?? false,
      isFocusBoundary: params.isFocusBoundary ?? false,
      preferredChildFocusKey: params.preferredChildFocusKey,
      onEnterPress: (details) => {
        params.onEnterPress?.(details);
      },
      onEnterRelease: () => {},
      onArrowPress: (direction, details) => {
        if (params.onArrowPress) {
          return params.onArrowPress(direction, details);
        }
        return true;
      },
      onArrowRelease: () => {},
      onFocus: (layout, details) => {
        node.setAttribute('data-focused', 'true');
        if (params.playSound !== false) {
          playFocusSound();
        }
        params.onFocus?.(layout, details);
        node.dispatchEvent(new CustomEvent('sn-focus', { detail: { layout, details } }));
      },
      onBlur: (layout, details) => {
        node.removeAttribute('data-focused');
        params.onBlur?.(layout, details);
        node.dispatchEvent(new CustomEvent('sn-blur', { detail: { layout, details } }));
      },
      onUpdateFocus: (focused) => {
        if (focused) {
          node.setAttribute('data-focused', 'true');
        } else {
          node.removeAttribute('data-focused');
        }
        params.onUpdateFocus?.(focused);
      },
      onUpdateHasFocusedChild: (hasFocusedChild) => {
        if (hasFocusedChild) {
          node.setAttribute('data-focused-child', 'true');
        } else {
          node.removeAttribute('data-focused-child');
        }
        params.onUpdateHasFocusedChild?.(hasFocusedChild);
      },
    });

    node.setAttribute('data-focus-key', params.focusKey);

    if (params.autoFocus) {
      setTimeout(() => {
        setFocus(params.focusKey);
      }, 0);
    }
  }

  register(currentParams);

  return {
    update(newParams: SpatialNavParams) {
      const oldKey = currentFocusKey;
      currentParams = { ...newParams };

      if (oldKey !== newParams.focusKey) {
        SpatialNavigation.removeFocusable({ focusKey: oldKey });
        register(currentParams);
      } else {
        SpatialNavigation.updateFocusable(newParams.focusKey, {
          node,
          parentFocusKey: newParams.parentFocusKey ?? 'SN:ROOT',
          preferredChildFocusKey: newParams.preferredChildFocusKey,
          focusable: newParams.focusable ?? true,
          trackChildren: newParams.trackChildren ?? false,
          saveLastFocusedChild: newParams.saveLastFocusedChild ?? false,
          autoRestoreFocus: newParams.autoRestoreFocus ?? true,
          forceFocus: newParams.forceFocus ?? false,
          isFocusBoundary: newParams.isFocusBoundary ?? false,
          onEnterPress: newParams.onEnterPress ? (d) => newParams.onEnterPress?.(d) : () => {},
          onEnterRelease: () => {},
          onArrowPress: newParams.onArrowPress ? (dir, d) => newParams.onArrowPress!(dir, d) : () => true,
          onArrowRelease: () => {},
          onFocus: (layout, details) => {
            node.setAttribute('data-focused', 'true');
            if (newParams.playSound !== false) {
              playFocusSound();
            }
            newParams.onFocus?.(layout, details);
            node.dispatchEvent(new CustomEvent('sn-focus', { detail: { layout, details } }));
          },
          onBlur: (layout, details) => {
            node.removeAttribute('data-focused');
            newParams.onBlur?.(layout, details);
            node.dispatchEvent(new CustomEvent('sn-blur', { detail: { layout, details } }));
          },
        });
      }
    },
    destroy() {
      SpatialNavigation.removeFocusable({ focusKey: currentFocusKey });
    },
  };
}
