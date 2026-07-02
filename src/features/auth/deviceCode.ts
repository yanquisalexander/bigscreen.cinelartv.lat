import type { DeviceCodeResponse, TokenResponse } from '@/types/auth';
import { apiRequest } from '@/api/client';

const DEVICE_CODE_SCOPE = 'openid profile';
const DEFAULT_POLL_INTERVAL = 5000;

export async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  return apiRequest<DeviceCodeResponse>('/oauth/authorize_device', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      scope: DEVICE_CODE_SCOPE,
    }),
  });
}

export async function pollDeviceToken(
  clientId: string,
  deviceCode: string,
): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
}

export function getPollInterval(interval?: number): number {
  return (interval ?? DEFAULT_POLL_INTERVAL) * 1000;
}

export type DeviceCodeStatus = 'pending' | 'slow_down' | 'expired' | 'success' | 'error';

export function classifyTokenResponse(response: TokenResponse): DeviceCodeStatus {
  if (response.error === 'authorization_pending') return 'pending';
  if (response.error === 'slow_down') return 'slow_down';
  if (response.error === 'expired_token') return 'expired';
  if (response.error) return 'error';
  return 'success';
}
