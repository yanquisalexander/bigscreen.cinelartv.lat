import type { Capabilities } from './types';

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl != null;
  } catch {
    return false;
  }
}

function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return gl != null;
  } catch {
    return false;
  }
}

function detectHardwareVideo(): boolean {
  try {
    if (typeof MediaCapabilities === 'function') {
      return true;
    }
    const video = document.createElement('video');
    return video.canType != null;
  } catch {
    return false;
  }
}

function detectVideoTexture(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    return typeof gl.TEXTURE_BINDING_2D === 'number';
  } catch {
    return false;
  }
}

function detectAnimations(): boolean {
  try {
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      return !mq.matches;
    }
    return true;
  } catch {
    return true;
  }
}

function detectHDR(): boolean {
  try {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(dynamic-range: high)').matches;
    }
    return false;
  } catch {
    return false;
  }
}

export function detectCapabilities(): Capabilities {
  return {
    webgl: detectWebGL(),
    webgl2: detectWebGL2(),
    hardwareVideo: detectHardwareVideo(),
    videoTexture: detectVideoTexture(),
    animations: detectAnimations(),
    hdr: detectHDR(),
  };
}
