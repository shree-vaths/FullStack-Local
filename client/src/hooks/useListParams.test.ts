import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { nextSortOrder, useListParams } from './useListParams';

describe('nextSortOrder', () => {
  it('starts a newly clicked column ascending', () => {
    expect(nextSortOrder({ sortBy: 'name', sortOrder: 'desc' }, 'date')).toBe('asc');
  });

  it('flips the direction of the active column', () => {
    expect(nextSortOrder({ sortBy: 'name', sortOrder: 'asc' }, 'name')).toBe('desc');
    expect(nextSortOrder({ sortBy: 'name', sortOrder: 'desc' }, 'name')).toBe('asc');
  });
});

describe('useListParams', () => {
  const initial = { page: 3, pageSize: 10, sortBy: 'name' as const, sortOrder: 'asc' as const };

  it('changes page without touching the sort', () => {
    const { result } = renderHook(() => useListParams<'name' | 'date'>(initial));
    act(() => result.current.setPage(5));
    expect(result.current.params).toEqual({ ...initial, page: 5 });
  });

  it('resets to page 1 when the sort changes', () => {
    const { result } = renderHook(() => useListParams<'name' | 'date'>(initial));
    act(() => result.current.toggleSort('date'));
    expect(result.current.params).toMatchObject({ page: 1, sortBy: 'date', sortOrder: 'asc' });
  });
});
