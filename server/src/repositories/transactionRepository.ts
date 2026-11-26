import type { Transaction, TransactionSortField } from '../types';
import type { Db } from '../db/connection';
import { withDbErrorHandling } from '../db/dbErrors';
import { toLimitOffset, type ListQuery, type PageResult } from '../pagination';
import { createStatementCache, orderByClause } from './sqlHelpers';

/** Data access for transactions. Mirrors userRepository's structure. */

interface TransactionRow {
  id: number;
  user_id: number;
  service_id: number;
  price_cents: number;
  service_date: string;
}

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  userId: row.user_id,
  serviceId: row.service_id,
  priceCents: row.price_cents,
  serviceDate: row.service_date,
});

const COLUMNS = 'id, user_id, service_id, price_cents, service_date';

/** API sort field -> SQL expression (the allow-list used by orderByClause). */
const SORT_COLUMNS: Record<TransactionSortField, string> = {
  id: 'id',
  serviceDate: 'service_date',
  priceCents: 'price_cents',
};

export interface TransactionRepository {
  findPageByUserId(userId: number, query: ListQuery<TransactionSortField>): PageResult<Transaction>;
}

export function createTransactionRepository(db: Db): TransactionRepository {
  // Both queries filter on user_id and use idx_transactions_user_id.
  const countByUserId = db.prepare<[number], { total: number }>(
    `SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?`,
  );
  const preparePage = createStatementCache<
    [userId: number, limit: number, offset: number],
    TransactionRow
  >(db);

  // Same pattern as userRepository.findPage: rows + total in one snapshot.
  const findPageByUserId = db.transaction(
    (userId: number, query: ListQuery<TransactionSortField>): PageResult<Transaction> => {
      const { limit, offset } = toLimitOffset(query);
      const rows = preparePage(
        `SELECT ${COLUMNS} FROM transactions
          WHERE user_id = ?
          ${orderByClause(SORT_COLUMNS, query.sortBy, query.sortOrder)}
          LIMIT ? OFFSET ?`,
      ).all(userId, limit, offset);
      return {
        items: rows.map(toTransaction),
        totalItems: countByUserId.get(userId)?.total ?? 0,
      };
    },
  );

  return {
    findPageByUserId: withDbErrorHandling(db, 'list transactions', findPageByUserId),
  };
}
