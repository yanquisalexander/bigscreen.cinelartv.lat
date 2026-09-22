import { getRuntimeConfig } from '@/runtime';

export type CertificationLevel = 'none' | 'standard' | 'certified';

export interface DeviceCertification {
  level: CertificationLevel;
  label: string;
  supports4K: boolean;
  supportsHDR: boolean;
  codecs: { h264: boolean; hevc: boolean; vp9: boolean; av1: boolean };
  widevine: boolean;
}

async function detect4K(): Promise<boolean> {
  try {
    const mc = (navigator as any).mediaCapabilities;
    if (mc?.decodingInfo) {
      const res = await mc.decodingInfo({
        type: 'media-source',
        video: {
          contentType: 'video/mp4; codecs="avc1.640028"',
          width: 3840,
          height: 2160,
          bitrate: 20000000,
          framerate: 60,
        },
      });
      return Boolean(res?.supported);
    }
  } catch {}
  return false;
}

function detectHDR(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return (
        window.matchMedia('(dynamic-range: high)').matches ||
        window.matchMedia('(-webkit-dynamic-range: high)').matches
      );
    }
  } catch {}
  return false;
}

function detectCodecs(): { h264: boolean; hevc: boolean; vp9: boolean; av1: boolean } {
  const supports = (type: string): boolean => {
    try {
      return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(type);
    } catch {
      return false;
    }
  };

  return {
    h264: supports('video/mp4; codecs="avc1.640028"'),
    hevc:
      supports('video/mp4; codecs="hvc1.2.4.L150.B0"') ||
      supports('video/mp4; codecs="hev1.1.6.L150.B0"'),
    vp9: supports('video/webm; codecs="vp09.00.10.08"'),
    av1: supports('video/mp4; codecs="av01.0.08M.08"'),
  };
}

async function detectWidevine(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.requestMediaKeySystemAccess) {
      await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
        {
          initDataTypes: ['cenc'],
          videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
        },
      ]);
      return true;
    }
  } catch {}
  return false;
}

function resolveCertificationLevel(
  quality: string,
  supports4K: boolean,
  supportsHDR: boolean,
  codecs: { h264: boolean; hevc: boolean; vp9: boolean; av1: boolean },
  widevine: boolean,
): CertificationLevel {
  if (quality === 'FULL_ANIMATION' && supports4K && supportsHDR && (codecs.hevc || codecs.av1) && widevine) {
    return 'certified';
  }
  if (quality === 'STANDARD' || quality === 'FULL_ANIMATION') {
    return 'standard';
  }
  return 'none';
}

function resolveLabel(level: CertificationLevel): string {
  switch (level) {
    case 'certified':
      return 'Certificado';
    case 'standard':
      return 'Certificación Estándar';
    case 'none':
    default:
      return 'No Certificado';
  }
}

export async function detectDeviceCertification(): Promise<DeviceCertification> {
  const runtime = getRuntimeConfig();
  const [supports4K, codecs, widevine] = await Promise.all([detect4K(), Promise.resolve(detectCodecs()), detectWidevine()]);
  const supportsHDR = detectHDR();
  const level = resolveCertificationLevel(runtime.appQuality, supports4K, supportsHDR, codecs, widevine);

  return {
    level,
    label: resolveLabel(level),
    supports4K,
    supportsHDR,
    codecs,
    widevine,
  };
}
