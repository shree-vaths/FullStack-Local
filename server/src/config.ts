import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * All runtime configuration lives here, read once from the environment with
 * sensible local defaults. Nothing else in the codebase reads process.env.
 */

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parsePort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: "${value}"`);
  }
  return port;
}

export const config = {
  port: parsePort(process.env.PORT, 3001),
  databasePath: process.env.DATABASE_PATH ?? path.join(serverRoot, 'data', 'app.db'),
} as const;
