import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import type { ColumnDef } from './types';

interface Fruit {
  id: number;
  name: string;
  price: number;
}
type FruitSort = 'name' | 'price';

const FRUITS: Fruit[] = [
  { id: 1, name: 'Apple', price: 3 },
  { id: 2, name: 'Banana', price: 1 },
];

const COLUMNS: ColumnDef<Fruit, FruitSort>[] = [
  { id: 'name', header: 'Name', sortField: 'name', cell: (f) => f.name },
  { id: 'price', header: 'Price', sortField: 'price', align: 'right', cell: (f) => `$${f.price}` },
  { id: 'id', header: 'Code', cell: (f) => `F-${f.id}` }, // not sortable
];

function renderTable(props: Partial<Parameters<typeof DataTable<Fruit, FruitSort>>[0]> = {}) {
  return render(
    <DataTable<Fruit, FruitSort>
      caption="Fruits"
      columns={COLUMNS}
      rows={FRUITS}
      getRowKey={(f) => f.id}
      {...props}
    />,
  );
}

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row');

describe('DataTable', () => {
  it('renders a header per column and a row per item, using each column’s cell renderer', () => {
    renderTable();

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      expect.stringContaining('Name'),
      expect.stringContaining('Price'),
      'Code',
    ]);
    expect(bodyRows()).toHaveLength(2);
    expect(within(bodyRows()[0]!).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'Apple',
      '$3',
      'F-1',
    ]);
  });

  it('keeps the row order it was given (sorting is the parent’s job)', () => {
    renderTable({ sort: { sortBy: 'price', sortOrder: 'asc' } });
    expect(bodyRows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('Apple'),
      expect.stringContaining('Banana'),
    ]);
  });

  it('makes only sortable columns clickable, and reports the requested field', async () => {
    const onSortChange = vi.fn();
    renderTable({ onSortChange });

    await userEvent.click(screen.getByRole('button', { name: /price/i }));
    expect(onSortChange).toHaveBeenCalledWith('price');
    expect(screen.queryByRole('button', { name: /code/i })).not.toBeInTheDocument();
  });

  it('marks the sorted column with aria-sort', () => {
    renderTable({ sort: { sortBy: 'name', sortOrder: 'desc' }, onSortChange: vi.fn() });

    const [nameHeader, priceHeader] = screen.getAllByRole('columnheader');
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    expect(priceHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('reports row clicks, by mouse and by keyboard', async () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });

    await userEvent.click(screen.getByText('Banana'));
    expect(onRowClick).toHaveBeenLastCalledWith(FRUITS[1]);

    bodyRows()[0]!.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(FRUITS[0]);
  });

  it('rows are not focusable when there is no click handler', () => {
    renderTable();
    expect(bodyRows()[0]).not.toHaveAttribute('tabindex');
  });

  it('highlights the selected row', () => {
    renderTable({ selectedRowKey: 2 });
    expect(bodyRows()[1]).toHaveAttribute('aria-current', 'true');
    expect(bodyRows()[0]).not.toHaveAttribute('aria-current');
  });

  it('shows the empty message, or a loading message while loading', () => {
    const { rerender } = renderTable({ rows: [], emptyMessage: 'No fruit today' });
    expect(screen.getByText('No fruit today')).toBeInTheDocument();

    rerender(
      <DataTable<Fruit, FruitSort> caption="Fruits" columns={COLUMNS} rows={[]} getRowKey={(f) => f.id} isLoading />,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });
});
