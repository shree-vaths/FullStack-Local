import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { DatabaseConnectionError, openDatabase, type Db } from '../src/db/connection';
import { toDatabaseError, withDbErrorHandling } from '../src/db/dbErrors';
import { seedDatabase } from '../src/db/seedData';
import { DB_RETRY_AFTER_SECONDS, DatabaseError } from '../src/errors/AppError';

/** Failure scenarios: opening the database, and queries failing mid-request. */

let tmpDir: string;
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cofactor-db-test-'));
});
afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('openDatabase', () => {
  it('opens (and creates) a database file in a new directory', () => {
    const db = openDatabase(path.join(tmpDir, 'nested', 'ok.db'));
    expect(db.open).toBe(true);
    db.close();
  });

  it('rejects a file that is not a SQLite database, keeping the cause', () => {
    const file = path.join(tmpDir, 'not-a-db.db');
    fs.writeFileSync(file, 'this is definitely not a sqlite file '.repeat(200));

    const attempt = () => openDatabase(file);
    expect(attempt).toThrow(DatabaseConnectionError);
    expect(attempt).toThrow(/could not be initialised/);
    try {
      attempt();
    } catch (error) {
      expect((error as Error).cause).toMatchObject({ code: 'SQLITE_NOTADB' });
    }
  });

  it('fails clearly when the directory cannot be created', () => {
    // A regular file where a directory is expected makes mkdir fail.
    const blocker = path.join(tmpDir, 'blocker');
    fs.writeFileSync(blocker, '');

    expect(() => openDatabase(path.join(blocker, 'app.db'))).toThrow(
      /Could not open the database/,
    );
  });
});

describe('toDatabaseError', () => {
  const sqliteError = (code: string) => new Database.SqliteError(`simulated ${code}`, code);

  it.each(['SQLITE_BUSY', 'SQLITE_BUSY_SNAPSHOT', 'SQLITE_LOCKED'])(
    'treats %s as retryable (503)',
    (code) => {
      const error = toDatabaseError(sqliteError(code), 'list users');
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toMatchObject({
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        retryable: true,
        retryAfterSeconds: DB_RETRY_AFTER_SECONDS,
      });
    },
  );

  it.each(['SQLITE_IOERR', 'SQLITE_CORRUPT', 'SQLITE_ERROR'])('treats %s as a 500', (code) => {
    expect(toDatabaseError(sqliteError(code), 'list users')).toMatchObject({
      status: 500,
      code: 'DATABASE_ERROR',
      retryable: false,
      retryAfterSeconds: undefined,
    });
  });

  it('keeps the original error as `cause` but not in the client message', () => {
    const original = sqliteError('SQLITE_IOERR');
    const error = toDatabaseError(original, 'list users') as DatabaseError;
    expect(error.cause).toBe(original);
    expect(error.message).not.toContain('simulated');
  });

  it('passes non-database errors (bugs) through unchanged', () => {
    const bug = new TypeError('x is undefined');
    expect(toDatabaseError(bug, 'list users')).toBe(bug);
  });
});

describe('withDbErrorHandling', () => {
  it('reports a closed connection as retryable instead of a TypeError', () => {
    const db = openDatabase(':memory:');
    const query = withDbErrorHandling(db, 'list users', () => db.prepare('SELECT 1').get());
    db.close();

    expect(() => query()).toThrow(DatabaseError);
    expect(() => query()).toThrow(/not available/);
  });
});

describe('API behaviour when the database fails', () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Silences the server's expected error logs in the test output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db = openDatabase(':memory:');
    seedDatabase(db, { userCount: 3, transactionCount: 30 });
    app = createApp(db);
  });

  afterEach(() => {
    if (db.open) db.close();
    vi.restoreAllMocks();
  });

  it('health check reports ok while the database is reachable', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.data).toEqual({ status: 'ok', database: 'ok' });
  });

  it('health check returns 503 with Retry-After once the database is gone', async () => {
    db.close();
    const res = await request(app).get('/api/health').expect(503);
    expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe(String(DB_RETRY_AFTER_SECONDS));
  });

  it('returns 503 with Retry-After when the connection is closed mid-flight', async () => {
    db.close();
    const res = await request(app).get('/api/users').expect(503);
    expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe(String(DB_RETRY_AFTER_SECONDS));
  });

  it('returns a 500 without leaking SQL details when a query fails', async () => {
    db.exec('DROP TABLE transactions'); // simulate a broken/migrated schema

    const res = await request(app).get('/api/users/1/transactions').expect(500);
    expect(res.body.error.code).toBe('DATABASE_ERROR');
    // Permanent failure: retrying won't help, so no Retry-After hint.
    expect(res.headers['retry-after']).toBeUndefined();
    expect(res.body.error.message).not.toMatch(/no such table|SELECT|sqlite/i);
    // ...but the server log gets the full error, including the SQLite cause.
    expect(console.error).toHaveBeenCalled();
  });

  it('keeps serving other endpoints when one query fails', async () => {
    db.exec('DROP TABLE transactions');
    await request(app).get('/api/users/1/transactions').expect(500);
    await request(app).get('/api/users').expect(200);
  });
});
