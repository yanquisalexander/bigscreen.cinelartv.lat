import { getApiConfig } from '@/api/config';
import { useAuthStore } from '@/stores/authStore';

export { setApiConfig, getApiConfig } from '@/api/config';

type RefreshResult =
  | { ok: true; token: string }
  | { ok: false; tokenInvalid: boolean };

let pendingRefresh: Promise<RefreshResult> | null = null;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryRefreshToken(): Promise<RefreshResult> {
  const state = useAuthStore.getState();

  // One retry on transient failures (network blip, timeout, 5xx).
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await state.refreshNow();

    if (result.ok) {
      return { ok: true, token: result.accessToken };
    }

    if (result.tokenInvalid) {
      return { ok: false, tokenInvalid: true };
    }

    if (attempt < maxAttempts - 1) {
      await sleep(400 * (attempt + 1));
    }
  }

  return { ok: false, tokenInvalid: false };
}

function getRefreshedToken(): Promise<RefreshResult> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = tryRefreshToken().finally(() => {
    pendingRefresh = null;
  });

  return pendingRefresh;
}

function extractErrorMessage(body: unknown, fallbackStatus: number): string {
  const errorBody = body as Record<string, unknown> | null;
  return (
    (errorBody?.error_description as string) ??
    (errorBody?.error as string) ??
    (errorBody?.message as string) ??
    `HTTP ${fallbackStatus}`
  );
}

export async function apiRequest<T>(
  endpoint: string,
  init: RequestInit = {},
  accessToken?: string,
  options: { skipRefresh?: boolean } = {},
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

  if (response.status === 401 && !options.skipRefresh) {
    const result = await getRefreshedToken();

    if (result.ok) {
      headers['Authorization'] = `Bearer ${result.token}`;
      const retryResponse = await fetch(url, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(15000),
      });

      const retryBody = await parseResponse(retryResponse);

      if (!retryResponse.ok) {
        throw new APIError(
          extractErrorMessage(retryBody, retryResponse.status),
          retryResponse.status,
          retryBody,
        );
      }

      return retryBody as T;
    }

    if (result.tokenInvalid) {
      useAuthStore.getState().logout();
      throw new APIError('Sesión expirada', 401, { error: 'session_expired' });
    }

    throw new APIError(
      extractErrorMessage(body, response.status),
      response.status,
      body,
    );
  }

  if (!response.ok) {
    throw new APIError(
      extractErrorMessage(body, response.status),
      response.status,
      body,
    );
  }

  return body as T;
}
