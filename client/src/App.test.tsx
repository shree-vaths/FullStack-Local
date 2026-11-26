import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { ApiPage, Transaction, User } from './types';

/**
 * Whole-app tests with a fake API behind fetch(): covers the wiring between
 * the tables, hooks and API client that the unit tests can't see.
 */

const USERS: User[] = [
  { id: 1, name: 'Ada Lovelace', registrationDate: '2024-02-15', country: 'UK', serviceLevel: 'elite' },
  { id: 2, name: 'Alan Turing', registrationDate: '2023-06-01', country: 'UK', serviceLevel: 'basic' },
];
const TRANSACTIONS: Transaction[] = [
  { id: 501, userId: 1, serviceId: 7, priceCents: 12345, serviceDate: '2025-01-10' },
];

const page = <T,>(data: T[]): ApiPage<T> => ({
  data,
  pagination: { page: 1, pageSize: 10, totalItems: data.length, totalPages: 1 },
});
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/users') return ok(page(USERS));
    if (url.pathname === '/api/users/1/transactions') return ok(page(TRANSACTIONS));
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nope' } }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const requestedUrls = () => fetchMock.mock.calls.map(([input]) => String(input));

describe('App', () => {
  it('loads the first page of users, sorted by name', async () => {
    render(<App />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(requestedUrls()[0]).toBe('/api/users?page=1&pageSize=10&sortBy=name&sortOrder=asc');
  });

  it('asks the server for a new order when a column header is clicked', async () => {
    render(<App />);
    await screen.findByText('Ada Lovelace');

    await userEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(requestedUrls().at(-1)).toContain('sortBy=name&sortOrder=desc');

    await userEvent.click(screen.getByRole('button', { name: /registered/i }));
    expect(requestedUrls().at(-1)).toContain('sortBy=registrationDate&sortOrder=asc');
  });

  it("shows a user's transactions when their row is clicked, and hides them on a second click", async () => {
    render(<App />);
    await userEvent.click(await screen.findByText('Ada Lovelace'));

    const panel = await screen.findByRole('region', { name: /transactions/i });
    expect(await within(panel).findByText('#501')).toBeInTheDocument();
    expect(within(panel).getByText('$123.45')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Ada Lovelace'));
    expect(screen.queryByRole('region', { name: /transactions/i })).not.toBeInTheDocument();
  });

  it('shows an error with a working Retry button when loading fails', async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch');
    });
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
