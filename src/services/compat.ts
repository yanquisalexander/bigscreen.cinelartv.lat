const MINIMUM_CHROME_VERSION = 100;

export interface CompatResult {
  compatible: boolean;
  detectedVersion: number | null;
  minimumVersion: number;
}

function getChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrome\/(\d+)\./);
  return match ? parseInt(match[1], 10) : null;
}

export function checkCompat(): CompatResult {
  const chromeVersion = getChromeVersion();
  return {
    compatible: chromeVersion === null || chromeVersion >= MINIMUM_CHROME_VERSION,
    detectedVersion: chromeVersion,
    minimumVersion: MINIMUM_CHROME_VERSION,
  };
}
