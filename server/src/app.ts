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
 * Composition root: builds the app by wiring db -> repositories -> services -> routes.
 *
 * The database is passed in rather than imported, so tests can hand in an
 * in-memory DB, and building the app never has side effects like opening a port.
 */
export function createApp(db: Db): Express {
  const userService = createUserService({
    users: createUserRepository(db),
    transactions: createTransactionRepository(db),
  });

  const app = express();
  app.disable('x-powered-by'); // don't advertise the framework to clients

  // Reports whether the app can actually reach its database, so a load
  // balancer / uptime check can take an unhealthy instance out of rotation.
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

  // Must be registered after all routes.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
