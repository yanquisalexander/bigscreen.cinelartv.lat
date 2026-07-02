export interface RemoteConfig {
  CLIENT_ENDPOINT: string;
  CLIENT_ID?: string;
  USE_GEOBLOCKING: boolean;
  GEOBLOCKING_MODE: 'blacklist' | 'whitelist';
  GEOBLOCKING_COUNTRIES: string[];
  [key: string]: unknown;
}

export const DEFAULT_CONFIG: RemoteConfig = {
  CLIENT_ENDPOINT: 'https://cinelartv.lat',
  CLIENT_ID: 'xvk9JnMaS5f0y0aiiLZ6kx8-boITuK8zoQcPRHbkX6Y',
  USE_GEOBLOCKING: false,
  GEOBLOCKING_MODE: 'blacklist',
  GEOBLOCKING_COUNTRIES: [],
};
