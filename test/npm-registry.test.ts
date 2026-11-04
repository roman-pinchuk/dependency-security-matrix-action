import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestVersions } from '../src/npm-registry.js';

describe('fetchLatestVersions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('deduplicates registry requests while preserving dependency output order', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const packageName = String(input).split('/').at(-2);
      return new Response(JSON.stringify({ version: `${packageName}-latest` }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await fetchLatestVersions([
      { name: 'pino', requestedVersion: '1.0.0', scope: 'production' },
      { name: 'pino', requestedVersion: '1.0.0', scope: 'development' },
      { name: 'zod', requestedVersion: '1.0.0', scope: 'development' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { packageName: 'pino', version: 'pino-latest' },
      { packageName: 'pino', version: 'pino-latest' },
      { packageName: 'zod', version: 'zod-latest' },
    ]);
  });

  it('passes a timeout signal and converts request failures into unavailable versions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'));

    const result = await fetchLatestVersions([
      { name: 'pino', requestedVersion: '1.0.0', scope: 'production' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.npmjs.org/pino/latest',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toEqual([{ packageName: 'pino' }]);
  });
});
