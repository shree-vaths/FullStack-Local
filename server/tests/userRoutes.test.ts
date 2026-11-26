import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  DEFAULT_PAGE_SIZE,
  SERVICE_LEVELS,
  type ApiPage,
  type Transaction,
  type User,
} from '../src/types';
import { createApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/connection';
import { seedDatabase } from '../src/db/seedData';

/**
 * API tests against a fresh in-memory database per test: fast, isolated,
 * and exercising the real SQL rather than mocks.
 */

const USER_COUNT = 25; // > DEFAULT_PAGE_SIZE, so the users list spans 2 pages

/** Asserts `values` never go "backwards" for the given direction. */
function expectSorted<T>(values: T[], order: 'asc' | 'desc', key: (v: T) => string | number = String) {
  for (let i = 1; i < values.length; i++) {
    const [prev, curr] = [key(values[i - 1]!), key(values[i]!)];
    if (order === 'asc') expect(prev <= curr, `${prev} should come before ${curr}`).toBe(true);
    else expect(prev >= curr, `${prev} should come after ${curr}`).toBe(true);
  }
}

describe('/api/users', () => {
  let db: Db;
  let app: Express;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db, { userCount: USER_COUNT, transactionCount: 300, minTransactionsPerUser: 10 });
    app = createApp(db);
  });

  afterEach(() => db.close());

  const getPage = async <T>(url: string): Promise<ApiPage<T>> =>
    (await request(app).get(url).expect(200)).body;

  describe('GET /api/users', () => {
    it('returns the first page with default size, order and pagination metadata', async () => {
      const body = await getPage<User>('/api/users');

      expect(body.data).toHaveLength(DEFAULT_PAGE_SIZE);
      expect(body.pagination).toEqual({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalItems: USER_COUNT,
        totalPages: 2,
      });
      expectSorted(body.data, 'asc', (u) => u.id);
    });

    it('returns users in the API (camelCase) shape', async () => {
      const { data } = await getPage<User>('/api/users');

      expect(Object.keys(data[0]!).sort()).toEqual(
        ['country', 'id', 'name', 'registrationDate', 'serviceLevel'].sort(),
      );
      for (const user of data) {
        expect(SERVICE_LEVELS).toContain(user.serviceLevel);
        expect(user.registrationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('walks every user exactly once across pages', async () => {
      const page1 = await getPage<User>('/api/users?pageSize=10&page=1');
      const page2 = await getPage<User>('/api/users?pageSize=10&page=2');
      const page3 = await getPage<User>('/api/users?pageSize=10&page=3');

      expect(page3.data).toHaveLength(5); // the partial last page
      const ids = [...page1.data, ...page2.data, ...page3.data].map((u) => u.id);
      expect(new Set(ids).size).toBe(USER_COUNT);
    });

    it('returns an empty page (not an error) past the last page', async () => {
      const body = await getPage<User>('/api/users?page=99');
      expect(body.data).toEqual([]);
      expect(body.pagination.totalItems).toBe(USER_COUNT);
    });

    it.each(['asc', 'desc'] as const)('sorts by name %s, case-insensitively', async (order) => {
      const { data } = await getPage<User>(`/api/users?sortBy=name&sortOrder=${order}&pageSize=100`);
      expectSorted(data, order, (u) => u.name.toLowerCase());
    });

    it('sorts by registration date across pages, not just within one', async () => {
      const first = await getPage<User>('/api/users?sortBy=registrationDate&pageSize=10&page=1');
      const second = await getPage<User>('/api/users?sortBy=registrationDate&pageSize=10&page=2');
      expectSorted([...first.data, ...second.data], 'asc', (u) => u.registrationDate);
    });

    it.each([
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['pageSize=0', 'pageSize'],
      ['pageSize=101', 'pageSize'],
      ['sortBy=country', 'sortBy'],
      ['sortBy=name;DROP TABLE users', 'sortBy'],
      ['sortOrder=up', 'sortOrder'],
    ])('returns 400 for ?%s', async (query, field) => {
      const res = await request(app).get(`/api/users?${query}`).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain(field);
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns a single user', async () => {
      const res = await request(app).get('/api/users/1').expect(200);
      expect(res.body.data.id).toBe(1);
    });

    it('returns 404 for an unknown user', async () => {
      const res = await request(app).get('/api/users/999').expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it.each(['abc', '0', '-1', '1.5'])('returns 400 for invalid id "%s"', async (id) => {
      const res = await request(app).get(`/api/users/${id}`).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/users/:id/transactions', () => {
    const totalFor = (userId: number) =>
      db
        .prepare<[number], { n: number }>(`SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?`)
        .get(userId)!.n;

    it("returns only that user's transactions, newest first, with pagination", async () => {
      const body = await getPage<Transaction>('/api/users/1/transactions');

      expect(body.data.every((t) => t.userId === 1)).toBe(true);
      expectSorted(body.data, 'desc', (t) => t.serviceDate);
      expect(body.pagination.totalItems).toBe(totalFor(1));
    });

    it('pages through all of a user\'s transactions', async () => {
      const total = totalFor(1);
      const pageSize = 3;
      const pages = Math.ceil(total / pageSize);

      const seen: number[] = [];
      for (let page = 1; page <= pages; page++) {
        const body = await getPage<Transaction>(
          `/api/users/1/transactions?pageSize=${pageSize}&page=${page}`,
        );
        expect(body.pagination.totalPages).toBe(pages);
        seen.push(...body.data.map((t) => t.id));
      }
      expect(new Set(seen).size).toBe(total);
    });

    it('sorts by price', async () => {
      const { data } = await getPage<Transaction>(
        '/api/users/1/transactions?sortBy=priceCents&sortOrder=asc&pageSize=100',
      );
      expectSorted(data, 'asc', (t) => t.priceCents);
    });

    it('returns an empty page for a user with no transactions', async () => {
      db.prepare(`DELETE FROM transactions WHERE user_id = 1`).run();
      const body = await getPage<Transaction>('/api/users/1/transactions');
      expect(body.data).toEqual([]);
      expect(body.pagination).toMatchObject({ totalItems: 0, totalPages: 0 });
    });

    it('returns 404 for an unknown user rather than an empty page', async () => {
      await request(app).get('/api/users/999/transactions').expect(404);
    });

    it('rejects sort fields that belong to users, not transactions', async () => {
      await request(app).get('/api/users/1/transactions?sortBy=name').expect(400);
    });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
