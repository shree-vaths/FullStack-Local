import type { ApiError } from '../types';

/**
 * The single place the app talks HTTP. Components and hooks never call
 * fetch() directly, so error handling and retries behave the same everywhere.
 */

/** Every failed request surfaces as this error, with a message safe to show users. */
export class ApiRequestError extends Error {
  constructor(
    /** HTTP status, or 0 when the server could not be reached at all. */
    readonly status: number,
    /** Stable code from the API (e.g. NOT_FOUND) or one of the client codes below. */
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApiRequestError';
  }
}

/** Retries for 503 + Retry-After (temporarily unavailable). Other errors are not retried. */
const MAX_RETRIES = 2;
/** Upper bound on one wait, whatever the server suggests, so the UI never hangs long. */
const MAX_RETRY_DELAY_MS = 5_000;

export interface RequestOptions {
  /** Cancels the request (and any pending retry wait), e.g. when the user changes page. */
  signal?: AbortSignal;
  maxRetries?: number;
}

/**
 * GETs JSON from the API.
 *
 * - 2xx: resolves with the parsed body.
 * - 503 with Retry-After: waits as told (doubling each attempt, capped) and
 *   retries up to `maxRetries` times. The server marks only temporary
 *   failures this way, so retrying anything else would just repeat the error.
 * - anything else: rejects with ApiRequestError.
 * - aborted: rejects with the abort error, so callers can ignore it.
 */
export async function getJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { signal, maxRetries = MAX_RETRIES } = options;

  for (let attempt = 0; ; attempt++) {
    const response = await send(path, signal);
    if (response.ok) return parseBody<T>(response);

    const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
    if (response.status === 503 && retryAfterMs !== undefined && attempt < maxRetries) {
      await sleep(Math.min(retryAfterMs * 2 ** attempt, MAX_RETRY_DELAY_MS), signal);
      continue;
    }
    throw await toApiRequestError(response);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function send(path: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(path, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (isAbortError(error)) throw error;
    // fetch only rejects when no HTTP response arrived (offline, DNS, server down).
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and that the API is running.',
      { cause: error },
    );
  }
}

async function parseBody<T>(response: Response): Promise<T> {
  try {
    // NOTE: trusts the server's shape (cast, not validated). Fine with one
    // server we control; validate with a schema if the API is third-party.
    return (await response.json()) as T;
  } catch (error) {
    throw new ApiRequestError(response.status, 'INVALID_RESPONSE', 'The server sent an unreadable response.', {
      cause: error,
    });
  }
}

/** Turns a non-2xx response into an ApiRequestError, using the API's error body when present. */
async function toApiRequestError(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => undefined);
  if (isApiErrorBody(body)) {
    return new ApiRequestError(response.status, body.error.code, body.error.message);
  }
  // A 5xx that isn't in our API's format came from something in between
  // (e.g. the dev proxy when the API server is down).
  return response.status >= 500
    ? new ApiRequestError(response.status, 'SERVER_UNREACHABLE', 'The server is not responding. Please try again.')
    : new ApiRequestError(response.status, 'HTTP_ERROR', `Request failed (HTTP ${response.status}).`);
}

function isApiErrorBody(body: unknown): body is ApiError {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/** Retry-After in seconds (the form our API sends). The HTTP-date form is ignored. */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

/** setTimeout as a promise that rejects immediately if the request is aborted. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
