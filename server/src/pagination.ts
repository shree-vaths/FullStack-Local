import type { PageInfo, SortOrder } from './types';

/**
 * Pagination building blocks shared by every list endpoint, so the page math
 * lives in exactly one place.
 *
 * Flow: route parses `?page&pageSize&sortBy&sortOrder` into a ListQuery ->
 * repository turns it into LIMIT/OFFSET + ORDER BY and returns a PageResult ->
 * service wraps that into a Page with PageInfo for the response.
 */

/** What the caller asked for: which page, how big, in which order. */
export interface ListQuery<SortField extends string> {
  page: number;
  pageSize: number;
  sortBy: SortField;
  sortOrder: SortOrder;
}

/** What a repository returns: one page of items plus the total across all pages. */
export interface PageResult<T> {
  items: T[];
  totalItems: number;
}

/** What a service returns: the page of items and where it sits in the full list. */
export interface Page<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** Converts a 1-based page into SQL LIMIT/OFFSET. */
export function toLimitOffset({ page, pageSize }: Pick<ListQuery<string>, 'page' | 'pageSize'>): {
  limit: number;
  offset: number;
} {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export function toPage<T>(result: PageResult<T>, query: ListQuery<string>): Page<T> {
  return {
    items: result.items,
    pageInfo: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / query.pageSize),
    },
  };
}
