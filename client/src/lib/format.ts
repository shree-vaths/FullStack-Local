/**
 * Display formatting. Kept as pure functions so they are trivial to test and
 * the components stay free of formatting details.
 *
 * Locale and currency are fixed for now; a real product would take them from
 * the user's settings or the account.
 */
const LOCALE = 'en-US';

const currencyFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD' });

/** 12345 -> "$123.45". The API sends money as integer cents. */
export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

// timeZone UTC matters: new Date('2024-02-15') is midnight UTC, which would
// display as Feb 14 for anyone west of Greenwich in their local zone.
const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: 'UTC' });

/** "2024-02-15" -> "Feb 15, 2024". */
export function formatIsoDate(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : dateFormatter.format(date);
}
