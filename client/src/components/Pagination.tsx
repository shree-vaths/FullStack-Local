import type { PageInfo } from '../types';

interface PaginationProps {
  pageInfo: PageInfo;
  onPageChange: (page: number) => void;
  /** Disables the buttons, e.g. while the next page is loading. */
  disabled?: boolean;
}

/** "Showing 11–20 of 100" with Previous / Next buttons. Renders nothing for an empty list. */
export function Pagination({ pageInfo, onPageChange, disabled = false }: PaginationProps) {
  const { page, pageSize, totalItems, totalPages } = pageInfo;
  if (totalItems === 0) return null;

  const firstItem = Math.min((page - 1) * pageSize + 1, totalItems);
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm text-slate-600">
      <p>
        Showing <span className="font-medium text-slate-900">{firstItem}</span>–
        <span className="font-medium text-slate-900">{lastItem}</span> of{' '}
        <span className="font-medium text-slate-900">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <PageButton disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </PageButton>
        <span aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <PageButton disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton(props: { disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}
