import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '../types';
import { AppError } from '../errors/AppError';

/** Catches requests that matched no route, so they get the same JSON error shape. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = {
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  };
  res.status(404).json(body);
};

/**
 * Single place that turns thrown errors into HTTP responses.
 *
 * Route handlers deliberately have no try/catch of their own: Express 5
 * forwards both sync throws and rejected promises here, so every failure gets
 * the same response shape and the same logging.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // If the response is already partly sent we can't change its status or
  // body; let Express's default handler close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = err instanceof AppError ? err : undefined;

  // Client mistakes (4xx) are expected and not worth logging. Server-side
  // failures (5xx, incl. database errors) and unknown errors are logged with
  // their `cause`, which holds the original low-level error.
  if (!appError || appError.status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  // Unknown errors get a generic message so internals (stack traces, SQL)
  // never reach the client.
  // Tells clients the failure is temporary and when to try again (e.g. 503s
  // from a locked or closing database). Retrying is left to the client.
  if (appError?.retryAfterSeconds !== undefined) {
    res.set('Retry-After', String(appError.retryAfterSeconds));
  }

  const status = appError?.status ?? 500;
  const body: ApiError = {
    error: appError
      ? { code: appError.code, message: appError.message }
      : { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  };
  res.status(status).json(body);
};
