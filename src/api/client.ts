import type { RemoteConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/types/config';
import { useAuthStore } from '@/stores/authStore';

let configRef: RemoteConfig = { ...DEFAULT_CONFIG };

type RefreshResult =
  | { ok: true; token: string }
  | { ok: false; tokenInvalid: boolean };

let pendingRefresh: Promise<RefreshResult> | null = null;

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

async function tryRefreshToken(): Promise<RefreshResult> {
  const refreshToken = useAuthStore.getState().getRefreshToken();
  if (!refreshToken) return { ok: false, tokenInvalid: false };

  try {
    const { CLIENT_ENDPOINT } = getApiConfig();
    const response = await fetch(`${CLIENT_ENDPOINT}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15000),
    });

    const data = (await parseResponse(response)) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!response.ok || !data.access_token) {
      return {
        ok: false,
        tokenInvalid: response.status === 401 || response.status === 403,
      };
    }

    const current = useAuthStore.getState().tokens;
    useAuthStore.getState().updateTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? current?.refreshToken,
    });

    return { ok: true, token: data.access_token };
  } catch {
    return { ok: false, tokenInvalid: false };
  }
}

function getRefreshedToken(): Promise<RefreshResult> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = tryRefreshToken().finally(() => {
    pendingRefresh = null;
  });

  return pendingRefresh;
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

  if (response.status === 401 && !(init as RequestInit & { _retry?: boolean })._retry) {
    const result = await getRefreshedToken();

    if (result.ok) {
      headers['Authorization'] = `Bearer ${result.token}`;
      const retryResponse = await fetch(url, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(15000),
        _retry: true,
      } as RequestInit & { _retry?: boolean });

      const retryBody = await parseResponse(retryResponse);

      if (!retryResponse.ok) {
        const errorBody = retryBody as Record<string, unknown>;
        const message =
          (errorBody?.error_description as string) ??
          (errorBody?.error as string) ??
          (errorBody?.message as string) ??
          `HTTP ${retryResponse.status}`;
        throw new APIError(message, retryResponse.status, retryBody);
      }

      return retryBody as T;
    }

    if (result.tokenInvalid) {
      useAuthStore.getState().logout();
      throw new APIError('Sesión expirada', 401, { error: 'session_expired' });
    }

    const errorBody = body as Record<string, unknown>;
    const message =
      (errorBody?.error_description as string) ??
      (errorBody?.error as string) ??
      (errorBody?.message as string) ??
      `HTTP ${response.status}`;
    throw new APIError(message, response.status, body);
  }

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
