import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, getJson } from './httpClient';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const mockFetch = (...responses: (Response | Error)[]) => {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
};

afterEach(() => vi.unstubAllGlobals());

describe('getJson', () => {
  it('returns the parsed body on success', async () => {
    mockFetch(json({ data: [1, 2] }));
    await expect(getJson('/api/x')).resolves.toEqual({ data: [1, 2] });
  });

  it("turns the API's error body into an ApiRequestError", async () => {
    mockFetch(json({ error: { code: 'NOT_FOUND', message: 'User 9 not found' } }, 404));

    const error = await getJson('/api/users/9').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'User 9 not found' });
  });

  it('retries a 503 that has Retry-After, then succeeds', async () => {
    const fetch = mockFetch(
      json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'busy' } }, 503, { 'Retry-After': '0' }),
      json({ data: 'ok' }),
    );
    await expect(getJson('/api/x')).resolves.toEqual({ data: 'ok' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxRetries and reports the last error', async () => {
    const busy = () => json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'busy' } }, 503, { 'Retry-After': '0' });
    const fetch = mockFetch(busy(), busy(), busy());

    await expect(getJson('/api/x', { maxRetries: 2 })).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(3); // first try + 2 retries
  });

  it('does not retry permanent errors (500, or 503 without Retry-After)', async () => {
    const fetch = mockFetch(json({ error: { code: 'DATABASE_ERROR', message: 'broken' } }, 500));
    await expect(getJson('/api/x')).rejects.toMatchObject({ code: 'DATABASE_ERROR' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports a network failure as NETWORK_ERROR', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(getJson('/api/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('reports a non-API 5xx (e.g. proxy with API down) as SERVER_UNREACHABLE', async () => {
    mockFetch(new Response('Bad Gateway', { status: 502 }));
    await expect(getJson('/api/x')).rejects.toMatchObject({ code: 'SERVER_UNREACHABLE' });
  });

  it('stops waiting to retry as soon as the request is aborted', async () => {
    mockFetch(json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'busy' } }, 503, { 'Retry-After': '5' }));
    const controller = new AbortController();

    const pending = getJson('/api/x', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
