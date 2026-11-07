// Same-origin JSON fetch wrapper. Never throws for HTTP errors: returns { ok: false, error, message, fields }.
export type ApiError = { error: string; message: string; fields?: Record<string, string> };
export type ApiResult<T> = ({ ok: true } & { data: T }) | ({ ok: false; status: number } & ApiError);

let onSessionEnded = () => {};
/** Called on any 401 outside /auth/* (the session expired or was revoked). Set by AuthProvider. */
export const setSessionEndedHandler = (handler: () => void) => { onSessionEnded = handler; };

const FALLBACK: ApiError = { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };

export async function http<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: 'NETWORK_ERROR', message: 'Cannot reach the server. Check your connection and retry.' };
  }
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (res.ok) return { ok: true, data: data as T };
  if (res.status === 401 && !path.startsWith('/auth/')) onSessionEnded();
  return { ok: false, status: res.status, ...FALLBACK, ...(data as ApiError | undefined) };
}
