import Database from 'better-sqlite3';
import { DatabaseError } from '../errors/AppError';
import type { Db } from './connection';

/**
 * Translates low-level SQLite failures into application errors.
 *
 * Repositories wrap their public methods with `withDbErrorHandling`, so this is
 * the single try/catch for every query, instead of one per method.
 */

/**
 * SQLite result codes meaning "another connection holds a lock right now".
 * Extended codes start with the base name (e.g. SQLITE_BUSY_SNAPSHOT).
 * Retrying later can succeed, so these become 503s rather than 500s.
 */
const RETRYABLE_CODE = /^SQLITE_(BUSY|LOCKED)/;

type SqliteError = InstanceType<typeof Database.SqliteError>;

export function isSqliteError(error: unknown): error is SqliteError {
  return error instanceof Database.SqliteError;
}

/**
 * Converts a SqliteError into a DatabaseError with a client-safe message.
 * The original error (with SQL details) is kept as `cause` for the server log.
 * Anything that isn't a SqliteError is a bug, not a DB failure: rethrown as-is.
 */
export function toDatabaseError(error: unknown, operation: string): unknown {
  if (!isSqliteError(error)) return error;

  const retryable = RETRYABLE_CODE.test(error.code);
  const message = retryable
    ? `The database is busy; could not ${operation}. Please retry.`
    : `Could not ${operation} due to a database error.`;
  return new DatabaseError(message, { cause: error, retryable });
}

/**
 * Wraps a data-access function so any SQLite failure surfaces as a DatabaseError.
 *
 * @param db        The connection `fn` uses; checked first, because a closed
 *                  connection throws a plain TypeError rather than a SqliteError.
 * @param operation Human-readable description used in the error message, e.g. "list users".
 */
export function withDbErrorHandling<Args extends unknown[], Result>(
  db: Db,
  operation: string,
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  return (...args) => {
    // e.g. a request still in flight while the server is shutting down.
    if (!db.open) {
      throw new DatabaseError(`The database is not available; could not ${operation}.`, {
        cause: new Error('Database connection is closed'),
        retryable: true,
      });
    }
    try {
      return fn(...args);
    } catch (error) {
      throw toDatabaseError(error, operation);
    }
  };
}
