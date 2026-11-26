import type { ServiceLevel, User, UserSortField } from '../types';
import type { Db } from '../db/connection';
import { withDbErrorHandling } from '../db/dbErrors';
import { toLimitOffset, type ListQuery, type PageResult } from '../pagination';
import { createStatementCache, orderByClause } from './sqlHelpers';

/**
 * Data access for users. This is the only place that knows the `users` table
 * layout; everything above it works with the `User` domain type.
 */

/** Row shape exactly as SQLite returns it (snake_case). */
interface UserRow {
  id: number;
  name: string;
  registration_date: string;
  country: string;
  service_level: ServiceLevel;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  registrationDate: row.registration_date,
  country: row.country,
  serviceLevel: row.service_level,
});

const COLUMNS = 'id, name, registration_date, country, service_level';

/** API sort field -> SQL expression (the allow-list used by orderByClause). */
const SORT_COLUMNS: Record<UserSortField, string> = {
  id: 'id',
  name: 'name COLLATE NOCASE',
  registrationDate: 'registration_date',
};

export interface UserRepository {
  findPage(query: ListQuery<UserSortField>): PageResult<User>;
  findById(id: number): User | undefined;
}

export function createUserRepository(db: Db): UserRepository {
  // Values are always bound as parameters (never string-concatenated), which
  // prevents SQL injection. Statements are prepared once and reused.
  const selectById = db.prepare<[number], UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = ?`);
  const countAll = db.prepare<[], { total: number }>(`SELECT COUNT(*) AS total FROM users`);
  const preparePage = createStatementCache<[limit: number, offset: number], UserRow>(db);

  // Page + count run in one read transaction, so the total always describes
  // the same snapshot as the rows, even if a write lands in between
  const findPage = db.transaction((query: ListQuery<UserSortField>): PageResult<User> => {
    const { limit, offset } = toLimitOffset(query);
    const rows = preparePage(
      `SELECT ${COLUMNS} FROM users
        ${orderByClause(SORT_COLUMNS, query.sortBy, query.sortOrder)}
        LIMIT ? OFFSET ?`,
    ).all(limit, offset);
    return { items: rows.map(toUser), totalItems: countAll.get()?.total ?? 0 };
  });

  // Every public method is wrapped, so any SQLite failure reaches callers as a
  // DatabaseError (503 if retryable, else 500) with a client-safe message.
  return {
    findPage: withDbErrorHandling(db, 'list users', findPage),
    findById: withDbErrorHandling(db, 'load the user', (id: number) => {
      const row = selectById.get(id);
      return row ? toUser(row) : undefined;
    }),
  };
}
