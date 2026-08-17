import type { Capabilities } from './types';

/**
 * Reutiliza o desecha correctamente el contexto WebGL para no agotar 
 * el límite de contextos activos en la TV (evita falsos 'false').
 */
function getGlContext(type: 'webgl' | 'webgl2' | 'experimental-webgl'): WebGLRenderingContext | WebGL2RenderingContext | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext(type as any) as WebGLRenderingContext | WebGL2RenderingContext | null;
    return gl;
  } catch {
    return null;
  }
}

function destroyGlContext(gl: WebGLRenderingContext | WebGL2RenderingContext | null) {
  if (!gl) return;
  try {
    const loseContextExt = gl.getExtension('WEBGL_lose_context');
    if (loseContextExt) {
      loseContextExt.loseContext();
    }
  } catch {
    // Ignorar si el entorno no lo permite
  }
}

function detectWebGL(): { hasWebGL: boolean; maxTextureSize: number } {
  const gl = getGlContext('webgl') || getGlContext('experimental-webgl');
  if (!gl) return { hasWebGL: false, maxTextureSize: 0 };

  let maxTextureSize = 2048; // Fallback razonable
  try {
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
  } catch {
    // Algunos entornos de TV restringen getParameter
  }

  destroyGlContext(gl);
  return { hasWebGL: true, maxTextureSize };
}

function detectWebGL2(): boolean {
  const gl = getGlContext('webgl2');
  const supported = gl != null;
  destroyGlContext(gl);
  return supported;
}

function detectCSSTransform3D(): boolean {
  try {
    if (typeof window === 'undefined' || !document.body) return true;
    const el = document.createElement('p');
    let has3d: boolean;
    const transforms: Record<string, string> = {
      webkitTransform: '-webkit-transform',
      transform: 'transform',
    };

    document.body.insertBefore(el, null);

    for (const t in transforms) {
      if ((el.style as any)[t] !== undefined) {
        (el.style as any)[t] = 'translate3d(1px,1px,1px)';
        has3d = window.getComputedStyle(el).getPropertyValue(transforms[t]) !== 'none';
        if (has3d) {
          document.body.removeChild(el);
          return true;
        }
      }
    }
    document.body.removeChild(el);
    return false;
  } catch {
    // En la mayoría de TVs modernas CSS3D está soportado
    return true;
  }
}

function detectHardwareVideo(): boolean {
  try {
    // En Cobalt y Leanback moderno, MSE (MediaSource) indica decodificación hardware nativa
    if (typeof window !== 'undefined' && 'MediaSource' in window) {
      return true;
    }
    if (typeof MediaCapabilities === 'function') {
      return true;
    }
    const video = document.createElement('video');
    return Boolean(video.canPlayType && video.canPlayType('video/mp4; codecs="avc1.42E01E"'));
  } catch {
    return false;
  }
}

function detectVideoTexture(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;

    // Check for video texture extensions (preferred: no side effects)
    const ext = gl.getExtension('WEBGL_video_texture') || gl.getExtension('EXT_texture_video_image');
    if (ext) {
      destroyGlContext(gl);
      return true;
    }

    // Fallback: test with a 1x1 canvas texture (video element not needed)
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const pixel = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

    destroyGlContext(gl);
    return true;
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
      return (
        window.matchMedia('(dynamic-range: high)').matches ||
        window.matchMedia('(-webkit-dynamic-range: high)').matches
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Extrae métricas cuantitativas de hardware (RAM, Cores, DPR)
 */
function detectHardwareMetrics() {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : {};

  // Memoria RAM aproximada en GB
  const memoryGb = nav.deviceMemory ? Number(nav.deviceMemory) : undefined;

  // Número de núcleos lógicos de la CPU
  const logicalCores = nav.hardwareConcurrency ? Number(nav.hardwareConcurrency) : undefined;

  // Densidad de píxeles
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  return { memoryGb, logicalCores, devicePixelRatio };
}

export function detectCapabilities(): Capabilities {
  const webglInfo = detectWebGL();
  const metrics = detectHardwareMetrics();

  return {
    webgl: webglInfo.hasWebGL,
    webgl2: detectWebGL2(),
    cssTransform3d: detectCSSTransform3D(),
    hardwareVideo: detectHardwareVideo(),
    videoTexture: detectVideoTexture(),
    animations: detectAnimations(),
    hdr: detectHDR(),
    maxTextureSize: webglInfo.maxTextureSize,
    memoryGb: metrics.memoryGb,
    logicalCores: metrics.logicalCores,
    devicePixelRatio: metrics.devicePixelRatio,
  };
}