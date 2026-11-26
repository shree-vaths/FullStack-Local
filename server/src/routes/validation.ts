import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SORT_ORDERS, type SortOrder } from '../types';

/**
 * Request-validation helpers shared by the routers. Untrusted input (params,
 * query strings) is checked here, at the edge, so inner layers can rely on types.
 */

/** Parses `input` with `schema`, or throws a 400 that names every bad field. */
export function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
      .join('; ');
    throw new ValidationError(details);
  }
  return result.data;
}

/** `:id` route param: a positive integer (rejects "abc", "1.5", "-1", "1 OR 1=1"). */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Query schema for a paginated, sortable list:
 * `?page=1&pageSize=20&sortBy=<one of sortFields>&sortOrder=asc|desc`.
 * Every param is optional and falls back to a default; unknown params are ignored.
 */
export function listQuerySchema<const SortFields extends readonly [string, ...string[]]>(
  sortFields: SortFields,
  defaults: { sortBy: SortFields[number]; sortOrder: SortOrder },
) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    sortBy: z.enum(sortFields).default(defaults.sortBy),
    sortOrder: z.enum(SORT_ORDERS).default(defaults.sortOrder),
  });
}
