import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../src/db/connection';
import { seedDatabase } from '../src/db/seedData';

describe('seedDatabase', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  afterEach(() => db.close());

  const transactionCountsPerUser = () =>
    db
      .prepare<[], { count: number }>(
        `SELECT COUNT(t.id) AS count
           FROM users u LEFT JOIN transactions t ON t.user_id = u.id
          GROUP BY u.id`,
      )
      .all()
      .map((row) => row.count);

  it('creates the requested number of users and transactions', () => {
    seedDatabase(db, { userCount: 10, transactionCount: 120, minTransactionsPerUser: 5 });

    const counts = transactionCountsPerUser();
    expect(counts).toHaveLength(10);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(120);
  });

  it('gives every user at least the minimum number of transactions', () => {
    seedDatabase(db, { userCount: 10, transactionCount: 120, minTransactionsPerUser: 5 });

    expect(Math.min(...transactionCountsPerUser())).toBeGreaterThanOrEqual(5);
  });

  it('rejects a minimum that the total cannot satisfy, without writing anything', () => {
    expect(() =>
      seedDatabase(db, { userCount: 10, transactionCount: 40, minTransactionsPerUser: 5 }),
    ).toThrow(/at least 5 transactions/);
    expect(transactionCountsPerUser()).toHaveLength(0);
  });

  it('never dates a transaction before the user registered', () => {
    seedDatabase(db, { userCount: 10, transactionCount: 120, minTransactionsPerUser: 5 });

    const violations = db
      .prepare<[], { n: number }>(
        `SELECT COUNT(*) AS n
           FROM transactions t JOIN users u ON u.id = t.user_id
          WHERE t.service_date < u.registration_date`,
      )
      .get();
    expect(violations?.n).toBe(0);
  });
});
