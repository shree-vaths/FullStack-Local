/**
 * Domain model and API contract, as the UI receives it from the API.
 *
 * KEEP IN SYNC: this is a copy of server/src/types.ts. If the backend changes a
 * field, change it here too; nothing checks the two files against each other.
 */

/** Allowed service levels. Single source of truth for the DB check, validation and seeding. */
export const SERVICE_LEVELS = ['basic', 'premium', 'elite'] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

/** ISO-8601 calendar date, e.g. "2024-03-15". */
export type IsoDate = string;

export interface User {
  id: number;
  name: string;
  registrationDate: IsoDate;
  country: string;
  serviceLevel: ServiceLevel;
}

export interface Transaction {
  id: number;
  userId: number;
  serviceId: number;
  /** Stored in integer cents to avoid floating-point rounding errors with money. */
  priceCents: number;
  serviceDate: IsoDate;
}

// ---------------------------------------------------------------------------
// Listing: pagination + sorting (query params of list endpoints)
//   ?page=1&pageSize=20&sortBy=name&sortOrder=asc
// ---------------------------------------------------------------------------

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Columns GET /api/users can be sorted by. */
export const USER_SORT_FIELDS = ['id', 'name', 'registrationDate'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

/** Columns GET /api/users/:id/transactions can be sorted by. */
export const TRANSACTION_SORT_FIELDS = ['id', 'serviceDate', 'priceCents'] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageInfo {
  /** 1-based page number that was returned. */
  page: number;
  pageSize: number;
  totalItems: number;
  /** 0 when there are no items. A page past the end returns an empty `data` array. */
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

/** Single-resource responses. Wrapped so metadata can be added without breaking clients. */
export interface ApiSuccess<T> {
  data: T;
}

/** List responses: one page of items plus where that page sits in the whole list. */
export interface ApiPage<T> {
  data: T[];
  pagination: PageInfo;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
