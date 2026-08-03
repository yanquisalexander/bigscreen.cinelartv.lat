const MINIMUM_CHROME_VERSION = 80;

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
  const hasRequiredFeatures = Boolean(
    window.Promise &&
    window.fetch &&
    window.URLSearchParams &&
    window.Map &&
    window.Set &&
    window.Symbol &&
    Object.assign &&
    window.CSS?.supports?.('--cinelar-compat: 1')
  );

  return {
    compatible: hasRequiredFeatures && (chromeVersion === null || chromeVersion >= MINIMUM_CHROME_VERSION),
    detectedVersion: chromeVersion,
    minimumVersion: MINIMUM_CHROME_VERSION,
  };
}
