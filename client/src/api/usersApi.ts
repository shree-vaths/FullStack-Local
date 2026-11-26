import type {
  ApiPage,
  SortOrder,
  Transaction,
  TransactionSortField,
  User,
  UserSortField,
} from '../types';
import { getJson } from './httpClient';

/** Typed functions for each endpoint the UI uses. Mirrors the server's routes. */

/** Query params accepted by the API's list endpoints. */
export interface ListParams<SortField extends string> {
  page: number;
  pageSize: number;
  sortBy: SortField;
  sortOrder: SortOrder;
}

function toQueryString(params: ListParams<string>): string {
  return new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  }).toString();
}

export function fetchUsers(
  params: ListParams<UserSortField>,
  signal?: AbortSignal,
): Promise<ApiPage<User>> {
  return getJson(`/api/users?${toQueryString(params)}`, { signal });
}

export function fetchUserTransactions(
  userId: number,
  params: ListParams<TransactionSortField>,
  signal?: AbortSignal,
): Promise<ApiPage<Transaction>> {
  return getJson(`/api/users/${userId}/transactions?${toQueryString(params)}`, { signal });
}
