import { faker } from '@faker-js/faker';
import { SERVICE_LEVELS, type ServiceLevel } from '../types';
import type { Db } from './connection';

/**
 * Fake-data generation, kept separate from the CLI entry point (seed.ts) so
 * tests can seed an in-memory database with the exact same logic.
 */

export interface SeedOptions {
  userCount: number;
  transactionCount: number;
  /** Every user gets at least this many transactions (default 0). */
  minTransactionsPerUser?: number;
  /** Fixed seed => the same data on every run, which makes bugs reproducible. */
  randomSeed?: number;
}

const SERVICE_ID_COUNT = 20;
const MIN_PRICE_CENTS = 10_00;
const MAX_PRICE_CENTS = 500_00;
const REGISTRATION_WINDOW_YEARS = 3;

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Decides which user owns each transaction: every user appears at least
 * `minPerUser` times, the remainder is assigned randomly, and the result is
 * shuffled so transaction IDs aren't grouped by user.
 */
function assignTransactionOwners<T>(users: T[], total: number, minPerUser: number): T[] {
  const guaranteed = users.flatMap((user) => Array<T>(minPerUser).fill(user));
  const extra = Array.from({ length: total - guaranteed.length }, () =>
    faker.helpers.arrayElement(users),
  );
  return faker.helpers.shuffle([...guaranteed, ...extra]);
}

/** Replaces all data in the database with freshly generated fake data. */
export function seedDatabase(db: Db, options: SeedOptions): void {
  const { userCount, transactionCount, minTransactionsPerUser = 0, randomSeed = 42 } = options;
  // Fail before touching the DB if the numbers can't add up.
  if (userCount * minTransactionsPerUser > transactionCount) {
    throw new Error(
      `Cannot give ${userCount} users at least ${minTransactionsPerUser} transactions each ` +
        `with only ${transactionCount} transactions`,
    );
  }
  faker.seed(randomSeed);
  // Anchor "now" so the same seed produces identical dates regardless of when it runs.
  const referenceDate = new Date('2026-01-01T00:00:00Z');

  const insertUser = db.prepare<[string, string, string, ServiceLevel]>(
    `INSERT INTO users (name, registration_date, country, service_level) VALUES (?, ?, ?, ?)`,
  );
  const insertTransaction = db.prepare<[number, number, number, string]>(
    `INSERT INTO transactions (user_id, service_id, price_cents, service_date) VALUES (?, ?, ?, ?)`,
  );

  // A single transaction makes the seed atomic (all-or-nothing) and much faster
  // than letting SQLite commit (and fsync) after every insert.
  const run = db.transaction(() => {
    db.exec('DELETE FROM transactions; DELETE FROM users;');
    // Reset AUTOINCREMENT counters so IDs start at 1 on every run.
    db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'transactions');`);

    const users: { id: number; registeredAt: Date }[] = [];
    for (let i = 0; i < userCount; i++) {
      const registeredAt = faker.date.past({ years: REGISTRATION_WINDOW_YEARS, refDate: referenceDate });
      const result = insertUser.run(
        faker.person.fullName(),
        toIsoDate(registeredAt),
        faker.location.country(),
        faker.helpers.arrayElement(SERVICE_LEVELS),
      );
      users.push({ id: Number(result.lastInsertRowid), registeredAt });
    }

    for (const user of assignTransactionOwners(users, transactionCount, minTransactionsPerUser)) {
      // Keep data plausible: a user can't receive a service before they registered.
      const serviceDate = faker.date.between({ from: user.registeredAt, to: referenceDate });
      insertTransaction.run(
        user.id,
        faker.number.int({ min: 1, max: SERVICE_ID_COUNT }),
        faker.number.int({ min: MIN_PRICE_CENTS, max: MAX_PRICE_CENTS }),
        toIsoDate(serviceDate),
      );
    }
  });

  run();
}
