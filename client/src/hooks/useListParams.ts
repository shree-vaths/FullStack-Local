import { useCallback, useState } from 'react';
import type { ListParams } from '../api/usersApi';
import type { SortOrder } from '../types';

/**
 * Sort direction after clicking a column header: a new column starts
 * ascending; clicking the active column flips the direction.
 */
export function nextSortOrder<F extends string>(
  current: { sortBy: F; sortOrder: SortOrder },
  clicked: F,
): SortOrder {
  if (current.sortBy !== clicked) return 'asc';
  return current.sortOrder === 'asc' ? 'desc' : 'asc';
}

/**
 * Page + sort state for one paginated table.
 * Changing the sort jumps back to page 1: "page 4" of a different order is
 * an arbitrary slice the user didn't ask for.
 */
export function useListParams<F extends string>(initial: ListParams<F>) {
  const [params, setParams] = useState(initial);

  const setPage = useCallback((page: number) => {
    setParams((current) => ({ ...current, page }));
  }, []);

  const toggleSort = useCallback((field: F) => {
    setParams((current) => ({
      ...current,
      page: 1,
      sortBy: field,
      sortOrder: nextSortOrder(current, field),
    }));
  }, []);

  return { params, setPage, toggleSort };
}
