import { describe, expect, it } from 'vitest';
import { formatCents, formatIsoDate } from './format';

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [12345, '$123.45'],
    [100000, '$1,000.00'],
  ])('%i cents -> %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });
});

describe('formatIsoDate', () => {
  it('formats a calendar date without shifting it by the local time zone', () => {
    expect(formatIsoDate('2024-02-15')).toBe('Feb 15, 2024');
    expect(formatIsoDate('2024-01-01')).toBe('Jan 1, 2024');
  });

  it('returns the input unchanged if it is not a date', () => {
    expect(formatIsoDate('not-a-date')).toBe('not-a-date');
  });
});
