import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAbortError } from '../api/httpClient';
import type { ApiPage } from '../types';

export type FetchPage<Params, Row> = (params: Params, signal: AbortSignal) => Promise<ApiPage<Row>>;

interface Result<Request, Row> {
  /** The request this result answers; compared with the current one to derive `isLoading`. */
  request: Request;
  page?: ApiPage<Row>;
  error?: Error;
}

/**
 * Loads one page of a list whenever `fetchPage` or `params` change.
 *
 * - Race-safe: each new request aborts the previous one, so a slow response
 *   for page 2 can never overwrite the page 3 the user clicked afterwards.
 * - Keeps showing the previous page while the next one loads (no flicker).
 * - `retry()` re-sends the same request after an error.
 *
 * `fetchPage` must be stable between renders (module function or useCallback),
 * otherwise every render would start a new request.
 */
export function usePaginatedFetch<Params, Row>(fetchPage: FetchPage<Params, Row>, params: Params) {
  const [attempt, setAttempt] = useState(0);
  // One object identifying "what we want now"; a new identity means a new request.
  const request = useMemo(() => ({ fetchPage, params, attempt }), [fetchPage, params, attempt]);
  const [result, setResult] = useState<Result<typeof request, Row>>();

  useEffect(() => {
    const controller = new AbortController();
    request
      .fetchPage(request.params, controller.signal)
      .then((page) => setResult({ request, page }))
      .catch((error: unknown) => {
        // Aborted = superseded by a newer request or unmounted; nothing to show.
        if (isAbortError(error)) return;
        setResult((previous) => ({
          request,
          page: previous?.page, // keep the last good page visible behind the error
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      });
    return () => controller.abort();
  }, [request]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Loading = the latest result answers an older request (or there is none yet).
  // Derived rather than stored, so it can never get out of sync.
  const isLoading = result?.request !== request;

  return {
    page: result?.page,
    error: isLoading ? undefined : result?.error,
    isLoading,
    retry,
  };
}
