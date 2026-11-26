import type { ReactNode } from 'react';
import type { SortOrder } from '../../types';

/**
 * Describes one column of a DataTable.
 *
 * @typeParam Row       The row object type (e.g. User).
 * @typeParam SortField The sort keys the data source accepts; a column is
 *                      sortable only if it names one of them.
 */
export interface ColumnDef<Row, SortField extends string = never> {
  /** Unique, stable key for the column. */
  id: string;
  header: string;
  /** Renders the cell content for a row. */
  cell: (row: Row) => ReactNode;
  /** Makes the header a sort button that requests this field. */
  sortField?: SortField;
  /** Numbers read best right-aligned. */
  align?: 'left' | 'right';
}

export interface SortState<SortField extends string> {
  sortBy: SortField;
  sortOrder: SortOrder;
}
