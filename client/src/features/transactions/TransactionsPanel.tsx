import { useCallback } from 'react';
import { fetchUserTransactions, type ListParams } from '../../api/usersApi';
import { DataTable } from '../../components/DataTable/DataTable';
import type { ColumnDef } from '../../components/DataTable/types';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Pagination } from '../../components/Pagination';
import { useListParams } from '../../hooks/useListParams';
import { usePaginatedFetch } from '../../hooks/usePaginatedFetch';
import { formatCents, formatIsoDate } from '../../lib/format';
import type { Transaction, TransactionSortField, User } from '../../types';

const PAGE_SIZE = 10;

const COLUMNS: ColumnDef<Transaction, TransactionSortField>[] = [
  { id: 'id', header: 'Transaction', sortField: 'id', cell: (t) => `#${t.id}` },
  { id: 'serviceId', header: 'Service', cell: (t) => `Service ${t.serviceId}` },
  {
    id: 'serviceDate',
    header: 'Service date',
    sortField: 'serviceDate',
    cell: (t) => formatIsoDate(t.serviceDate),
  },
  {
    id: 'price',
    header: 'Price',
    sortField: 'priceCents',
    align: 'right',
    cell: (t) => <span className="tabular-nums">{formatCents(t.priceCents)}</span>,
  },
];

interface TransactionsPanelProps {
  user: User;
  onClose: () => void;
}

/**
 * Shows one user's transactions, reusing the same DataTable as the users list.
 *
 * The parent renders this with `key={user.id}`, so switching users remounts
 * it and the page/sort state starts fresh instead of carrying over.
 */
export function TransactionsPanel({ user, onClose }: TransactionsPanelProps) {
  const { params, setPage, toggleSort } = useListParams<TransactionSortField>({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: 'serviceDate',
    sortOrder: 'desc', // most recent activity first
  });

  // Stable per user, as usePaginatedFetch requires.
  const fetchPage = useCallback(
    (listParams: ListParams<TransactionSortField>, signal: AbortSignal) =>
      fetchUserTransactions(user.id, listParams, signal),
    [user.id],
  );
  const { page, error, isLoading, retry } = usePaginatedFetch(fetchPage, params);

  return (
    <section aria-labelledby="transactions-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id="transactions-heading" className="text-lg font-semibold">
          Transactions <span className="font-normal text-slate-500">· {user.name}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-200 hover:text-slate-900"
        >
          Close
        </button>
      </div>
      {error && <ErrorMessage error={error} onRetry={retry} />}
      <DataTable
        caption={`Transactions for ${user.name}`}
        columns={COLUMNS}
        rows={page?.data ?? []}
        getRowKey={(t) => t.id}
        sort={params}
        onSortChange={toggleSort}
        isLoading={isLoading}
        emptyMessage="This user has no transactions yet."
      />
      {page && <Pagination pageInfo={page.pagination} onPageChange={setPage} disabled={isLoading} />}
    </section>
  );
}
