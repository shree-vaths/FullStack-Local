import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type Db = Database.Database;

const SCHEMA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

/**
 * How long a query waits for another connection's lock (e.g. the seed script
 * writing while the server reads) before failing with SQLITE_BUSY.
 */
const BUSY_TIMEOUT_MS = 5_000;

/** The database could not be opened or prepared for use. Raised at startup, not per request. */
export class DatabaseConnectionError extends Error {
  constructor(message: string, options: { cause: unknown }) {
    super(message, options);
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Opens a SQLite database and ensures the schema exists.
 *
 * Fails fast with a DatabaseConnectionError (original error attached as
 * `cause`) instead of letting the server start against an unusable database.
 *
 * @param filePath Path to the DB file, or ':memory:' for an isolated in-memory DB (used by tests).
 */
export function openDatabase(filePath: string): Db {
  const inMemory = filePath === ':memory:';

  // Step 1: open the file. Fails on e.g. missing permissions, a directory that
  // can't be created, or a path that points at a directory.
  let db: Db;
  try {
    if (!inMemory) fs.mkdirSync(path.dirname(filePath), { recursive: true });
    db = new Database(filePath, { timeout: BUSY_TIMEOUT_MS });
  } catch (error) {
    throw new DatabaseConnectionError(`Could not open the database at "${filePath}"`, {
      cause: error,
    });
  }

  // Step 2: configure it and apply the schema. SQLite opens files lazily, so a
  // corrupt or non-SQLite file only fails here, on the first real statement.
  try {
    // SQLite leaves foreign key checks off unless they're turned on for each connection.
    db.pragma('foreign_keys = ON');
    // WAL lets reads proceed while a write is in progress (better concurrency for a web server).
    if (!inMemory) db.pragma('journal_mode = WAL');
    applySchema(db);
    return db;
  } catch (error) {
    // Closes the half-opened file before reporting the failure.
    db.close();
    throw new DatabaseConnectionError(
      `The database at "${filePath}" could not be initialised (corrupt file, not a SQLite database, or schema error)`,
      { cause: error },
    );
  }
}

/** Idempotent: schema.sql only uses CREATE ... IF NOT EXISTS. */
export function applySchema(db: Db): void {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

/**
 * Cheap liveness probe used by the health endpoint. Never throws:
 * returns false if the connection is closed or the file has become unreadable.
 */
export function isDatabaseHealthy(db: Db): boolean {
  try {
    // Reads the schema page, so it touches the file (unlike a bare `SELECT 1`).
    db.prepare('SELECT COUNT(*) FROM sqlite_master').get();
    return true;
  } catch {
    return false;
  }
}
