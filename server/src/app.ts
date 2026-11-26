import express, { type Express } from 'express';
import { isDatabaseHealthy, type Db } from './db/connection';
import { DB_RETRY_AFTER_SECONDS } from './errors/AppError';
import type { ApiError } from './types';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createTransactionRepository } from './repositories/transactionRepository';
import { createUserRepository } from './repositories/userRepository';
import { createUserRouter } from './routes/userRoutes';
import { createUserService } from './services/userService';

/**
 * Creates the Express app and connects its layers:
 *   repositories (run SQL) -> service (business rules) -> routes (handle URLs)
 *
 * The database is passed in as a parameter instead of being opened here, so:
 *  - index.ts passes the real database file
 *  - tests pass a temporary in-memory database, so they never touch real data
 */
export function createApp(db: Db): Express {
  const userService = createUserService({
    users: createUserRepository(db),
    transactions: createTransactionRepository(db),
  });

  const app = express();
  app.disable('x-powered-by'); // hides the "X-Powered-By: Express" header

  // Lets Render / uptime monitors check the server and its DB are working (503 if not).
  app.get('/api/health', (_req, res) => {
    if (isDatabaseHealthy(db)) {
      res.json({ data: { status: 'ok', database: 'ok' } });
      return;
    }
    const body: ApiError = {
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not reachable' },
    };
    res.status(503).set('Retry-After', String(DB_RETRY_AFTER_SECONDS)).json(body);
  });
  app.use('/api/users', createUserRouter(userService));

  // Express runs handlers in order, so these two only see requests the routes above didn't handle.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
