import { fetchUsers } from '../../api/usersApi';
import { DataTable } from '../../components/DataTable/DataTable';
import type { ColumnDef } from '../../components/DataTable/types';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Pagination } from '../../components/Pagination';
import { useListParams } from '../../hooks/useListParams';
import { usePaginatedFetch } from '../../hooks/usePaginatedFetch';
import { formatIsoDate } from '../../lib/format';
import type { ServiceLevel, User, UserSortField } from '../../types';

const PAGE_SIZE = 10;

// Defined outside the component: column config is static, so it isn't
// rebuilt on every render.
const COLUMNS: ColumnDef<User, UserSortField>[] = [
  { id: 'name', header: 'Name', sortField: 'name', cell: (user) => <span className="font-medium">{user.name}</span> },
  {
    id: 'registrationDate',
    header: 'Registered',
    sortField: 'registrationDate',
    cell: (user) => formatIsoDate(user.registrationDate),
  },
  { id: 'country', header: 'Country', cell: (user) => user.country },
  { id: 'serviceLevel', header: 'Service level', cell: (user) => <ServiceLevelBadge level={user.serviceLevel} /> },
];

interface UsersTableProps {
  selectedUserId?: number;
  onSelectUser: (user: User) => void;
}

/** The users list: fetches one sorted page at a time and reports row clicks. */
export function UsersTable({ selectedUserId, onSelectUser }: UsersTableProps) {
  const { params, setPage, toggleSort } = useListParams<UserSortField>({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const { page, error, isLoading, retry } = usePaginatedFetch(fetchUsers, params);

  return (
    <section aria-labelledby="users-heading" className="space-y-3">
      <h2 id="users-heading" className="text-lg font-semibold">
        Users
      </h2>
      {error && <ErrorMessage error={error} onRetry={retry} />}
      <DataTable
        caption="Users. Select a row to see that user's transactions."
        columns={COLUMNS}
        rows={page?.data ?? []}
        getRowKey={(user) => user.id}
        sort={params}
        onSortChange={toggleSort}
        onRowClick={onSelectUser}
        selectedRowKey={selectedUserId}
        isLoading={isLoading}
        emptyMessage="No users found."
      />
      {page && <Pagination pageInfo={page.pagination} onPageChange={setPage} disabled={isLoading} />}
    </section>
  );
}

const LEVEL_STYLES: Record<ServiceLevel, string> = {
  basic: 'bg-slate-100 text-slate-700',
  premium: 'bg-blue-100 text-blue-800',
  elite: 'bg-amber-100 text-amber-800',
};

function ServiceLevelBadge({ level }: { level: ServiceLevel }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${LEVEL_STYLES[level]}`}>
      {level}
    </span>
  );
}
