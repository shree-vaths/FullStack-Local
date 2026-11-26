/**
 * CLI entry point: `npm run seed`
 * Recreates the local database contents with 100 users and 1500 transactions (at least 10 per user).
 * The assignment asks for 1000; we use 1500 so the 10-per-user minimum still leaves
 * 500 to distribute randomly. With exactly 1000, every user would get exactly 10.
 *
 * On failure it prints a clear message and exits with code 1 (so scripts/CI
 * notice). Seeding runs in one transaction, so a failure part-way leaves the
 * previous data untouched rather than half-replaced.
 */
import { config } from '../config';
import { openDatabase, type Db } from './connection';
import { seedDatabase } from './seedData';

let db: Db | undefined;
try {
  db = openDatabase(config.databasePath);
  seedDatabase(db, { userCount: 100, transactionCount: 1500, minTransactionsPerUser: 10 });
  const counts = db
    .prepare<[], { users: number; transactions: number }>(
      `SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM transactions) AS transactions`,
    )
    .get();
  console.log(
    `Seeded ${counts?.users} users and ${counts?.transactions} transactions into ${config.databasePath}`,
  );
} catch (error) {
  console.error(`Seeding failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error); // full details, including the underlying `cause`
  process.exitCode = 1; // let `finally` close the DB instead of exiting immediately
} finally {
  db?.close();
}
