export interface TokenRefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  created_at?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export type TokenRefreshOutcome =
  | {
    ok: true;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    issuedAt?: number;
  }
  | { ok: false; tokenInvalid: boolean; error?: string };

async function parseBody(response: Response): Promise<TokenRefreshResponse | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as TokenRefreshResponse;
  } catch {
    return null;
  }
}

function parseIssuedAt(createdAt?: string): number | undefined {
  if (!createdAt) return undefined;
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Low-level refresh call. Does not touch the auth store.
 * `clientEndpoint` is passed in to avoid circular imports with the API client.
 */
export async function requestTokenRefresh(
  clientEndpoint: string,
  refreshToken: string,
): Promise<TokenRefreshOutcome> {
  try {
    const response = await fetch(`${clientEndpoint}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await parseBody(response);

    if (!response.ok || !data?.access_token) {
      const invalid =
        response.status === 401 ||
        response.status === 403 ||
        data?.error === 'invalid_grant' ||
        data?.error === 'invalid_token' ||
        data?.error === 'invalid_refresh_token';
      return { ok: false, tokenInvalid: invalid, error: data?.error };
    }

    const issuedAt = parseIssuedAt(data.created_at) ?? Date.now();
    const expiresAt = data.expires_in
      ? issuedAt + data.expires_in * 1000
      : undefined;

    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      issuedAt,
    };
  } catch {
    return { ok: false, tokenInvalid: false };
  }
}