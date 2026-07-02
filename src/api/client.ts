import type { RemoteConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/types/config';

let configRef: RemoteConfig = { ...DEFAULT_CONFIG };

export function setApiConfig(config: RemoteConfig) {
  configRef = config;
}

export function getApiConfig(): RemoteConfig {
  return configRef;
}

export class APIError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.body = body;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const { CLIENT_ENDPOINT } = getApiConfig();
  const url = `${CLIENT_ENDPOINT}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(15000),
  });

  const body = await parseResponse(response);

  if (!response.ok) {
    const errorBody = body as Record<string, unknown>;
    const message =
      (errorBody?.error_description as string) ??
      (errorBody?.error as string) ??
      (errorBody?.message as string) ??
      `HTTP ${response.status}`;
    throw new APIError(message, response.status, body);
  }

  return body as T;
}
