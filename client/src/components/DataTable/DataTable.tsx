import type { KeyboardEvent } from 'react';
import type { ColumnDef, SortState } from './types';

/**
 * A generic, presentational table: it renders whatever rows and columns it is
 * given and reports user intent (sort, row click) through callbacks.
 *
 * Sorting is "controlled": the table never reorders rows itself. It shows
 * the current sort and asks the parent to change it, because the data is
 * paginated on the server and only the server can sort the full list.
 */
export interface DataTableProps<Row, SortField extends string> {
  /** Describes the table for screen readers. */
  caption: string;
  columns: ColumnDef<Row, SortField>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  sort?: SortState<SortField>;
  onSortChange?: (field: SortField) => void;
  /** When set, rows are clickable and keyboard-focusable. */
  onRowClick?: (row: Row) => void;
  selectedRowKey?: string | number;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<Row, SortField extends string = never>({
  caption,
  columns,
  rows,
  getRowKey,
  sort,
  onSortChange,
  onRowClick,
  selectedRowKey,
  isLoading = false,
  emptyMessage = 'No results.',
}: DataTableProps<Row, SortField>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table
        aria-busy={isLoading}
        className={`w-full text-left text-sm transition-opacity ${isLoading ? 'opacity-60' : ''}`}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {columns.map((column) => (
              <HeaderCell key={column.id} column={column} sort={sort} onSortChange={onSortChange} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                {isLoading ? 'Loading…' : emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = getRowKey(row);
              return (
                <DataRow
                  key={key}
                  row={row}
                  columns={columns}
                  isSelected={key === selectedRowKey}
                  onClick={onRowClick}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

const alignClass = (align: 'left' | 'right' = 'left') =>
  align === 'right' ? 'text-right' : 'text-left';

function HeaderCell<Row, SortField extends string>({
  column,
  sort,
  onSortChange,
}: {
  column: ColumnDef<Row, SortField>;
  sort?: SortState<SortField>;
  onSortChange?: (field: SortField) => void;
}) {
  const { sortField } = column;
  const baseClass = `px-4 py-3 font-semibold ${alignClass(column.align)}`;

  if (sortField === undefined || !onSortChange) {
    return (
      <th scope="col" className={baseClass}>
        {column.header}
      </th>
    );
  }

  const isActive = sort?.sortBy === sortField;
  const direction = isActive ? sort.sortOrder : undefined;

  return (
    <th
      scope="col"
      // Tells screen readers which column is sorted, and in which direction.
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
      className={baseClass}
    >
      <button
        type="button"
        onClick={() => onSortChange(sortField)}
        // Tooltip says what the click will do next, so the control explains itself.
        title={`Sort by ${column.header} (${direction === 'asc' ? 'descending' : 'ascending'})`}
        // Negative margin offsets the padding: the hover background extends
        // around the label without shifting it out of line with the cells.
        className={`group -mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 uppercase tracking-wide transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500 ${
          isActive ? 'text-slate-900' : ''
        }`}
      >
        {column.header}
        <SortIcon direction={direction} />
      </button>
    </th>
  );
}

/**
 * Two stacked chevrons, always visible so every sortable column looks
 * clickable. The active direction is highlighted in blue; the other stays faint.
 * Inline SVG (not Unicode arrows) so it renders the same in every font/OS.
 */
function SortIcon({ direction }: { direction?: 'asc' | 'desc' }) {
  const tone = (active: boolean) =>
    active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500';
  const dim = direction ? 'opacity-30' : ''; // fade the inactive half once a direction is chosen

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 16"
      className="h-4 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M3 6l3-3 3 3"
        className={direction === 'asc' ? tone(true) : `${tone(false)} ${dim}`}
      />
      <path
        d="M3 10l3 3 3-3"
        className={direction === 'desc' ? tone(true) : `${tone(false)} ${dim}`}
      />
    </svg>
  );
}

function DataRow<Row, SortField extends string>({
  row,
  columns,
  isSelected,
  onClick,
}: {
  row: Row;
  columns: ColumnDef<Row, SortField>[];
  isSelected: boolean;
  onClick?: (row: Row) => void;
}) {
  // Clickable rows also work from the keyboard: Tab focuses a row, Enter/Space opens it.
  const interactiveProps = onClick
    ? {
        tabIndex: 0,
        onClick: () => onClick(row),
        onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); // stop Space from scrolling the page
            onClick(row);
          }
        },
      }
    : {};

  return (
    <tr
      {...interactiveProps}
      aria-current={isSelected ? 'true' : undefined}
      className={[
        isSelected ? 'bg-blue-50' : '',
        onClick
          ? 'cursor-pointer hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500'
          : '',
      ].join(' ')}
    >
      {columns.map((column) => (
        <td key={column.id} className={`px-4 py-3 ${alignClass(column.align)}`}>
          {column.cell(row)}
        </td>
      ))}
    </tr>
  );
}
