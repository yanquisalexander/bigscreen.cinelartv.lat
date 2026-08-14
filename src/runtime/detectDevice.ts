import type { DeviceInfo } from './types';

function getUA(): string {
  try {
    return navigator.userAgent || '';
  } catch {
    return '';
  }
}

function detectNativeBridge(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    /* @ts-ignore */
    const w = window as Record<string, unknown>;
    return w.CinelarNative != null || w.__CINELAR_V1_BRIDGE__ != null;
  } catch {
    return false;
  }
}

function detectFamily(ua: string): string {
  if (/Tizen\b/.test(ua)) return 'samsung-tizen';
  if (/WebOS\b|webOS\b/.test(ua)) return 'lg-webos';
  if (/Android\s+TV|AndroidTV|SMART-TV/.test(ua)) return 'android-tv';
  if (/SmartTV|NetCast|HbbTV|Opera TV|Viera|Philips|SonyBrowse/.test(ua)) return 'smart-tv-generic';
  return 'desktop';
}

function detectOS(ua: string): string {
  if (/Tizen\s+[\d.]+/.test(ua)) {
    const m = ua.match(/Tizen\s+([\d.]+)/);
    return m ? `Tizen ${m[1]}` : 'Tizen';
  }
  if (/WebOS\s+[\d.]+|webOS\s+[\d.]+/.test(ua)) {
    const m = ua.match(/(?:WebOS|webOS)\s+([\d.]+)/);
    return m ? `webOS ${m[1]}` : 'webOS';
  }
  if (/Android\s+[\d.]+/.test(ua)) {
    const m = ua.match(/Android\s+([\d.]+)/);
    return m ? `Android ${m[1]}` : 'Android';
  }
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Windows\s+NT\s+[\d.]+/.test(ua)) {
    const m = ua.match(/Windows\s+NT\s+([\d.]+)/);
    return m ? `Windows ${m[1]}` : 'Windows';
  }
  if (/Mac OS X\s+[\d._]+/.test(ua)) {
    const m = ua.match(/Mac OS X\s+([\d._]+)/);
    return m ? `macOS ${m?.[1]?.replace(/_/g, '.')}` : 'macOS';
  }
  if (/Linux\b/.test(ua)) return 'Linux';
  return 'unknown';
}

function detectBrowser(ua: string): string {
  if (/Tizen\s+[\d.]+/.test(ua)) {
    if (/SamsungBrowser\s+[\d.]+/.test(ua)) {
      const m = ua.match(/SamsungBrowser\s+([\d.]+)/);
      return m ? `SamsungBrowser ${m[1]}` : 'SamsungBrowser';
    }
    return 'Tizen Browser';
  }
  if (/WebOS\b|webOS\b/.test(ua)) {
    if (/Chrome\s+[\d.]+/.test(ua)) {
      const m = ua.match(/Chrome\s+([\d.]+)/);
      return m ? `Chrome ${m[1]}` : 'Chrome';
    }
    return 'webOS Browser';
  }
  if (/Edg(?:e|A|iOS)?\/[\d.]+/.test(ua)) {
    const m = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/);
    return m ? `Edge ${m[1]}` : 'Edge';
  }
  if (/OPR\/[\d.]+|Opera\/[\d.]+/.test(ua)) {
    const m = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
    return m ? `Opera ${m[1]}` : 'Opera';
  }
  if (/Chrome\s+[\d.]+/.test(ua)) {
    const m = ua.match(/Chrome\s+([\d.]+)/);
    return m ? `Chrome ${m[1]}` : 'Chrome';
  }
  if (/Firefox\/[\d.]+/.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/);
    return m ? `Firefox ${m[1]}` : 'Firefox';
  }
  if (/Safari\/[\d.]+/.test(ua)) return 'Safari';
  return 'unknown';
}

function extractModel(ua: string): string | undefined {
  const m = ua.match(/\(([^)]+)\)/);
  if (!m) return undefined;
  const parts = m[1].split(';').map((s) => s.trim());
  for (const p of parts) {
    if (/^[A-Z][A-Za-z0-9]+/.test(p) && !/Windows|Linux|Mac|Android|iPhone|iPad/.test(p)) {
      return p;
    }
  }
  return undefined;
}

export function detectDevice(): DeviceInfo {
  const ua = getUA();
  return {
    family: detectFamily(ua),
    model: extractModel(ua),
    os: detectOS(ua),
    browser: detectBrowser(ua),
    native: detectNativeBridge(),
  };
}
