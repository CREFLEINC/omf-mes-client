import { describe, expect, it } from 'vitest';

import { createApiClient } from './client';

const jsonResponse = (body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('createApiClient', () => {
  it('응답의 ETag를 경로별로 자동 캡처한다', async () => {
    const { client, etags } = createApiClient({
      baseUrl: 'http://mock.test',
      fetch: async () => jsonResponse({ warehouseId: '3' }, { ETag: '"7"' }),
    });

    await client.GET('/mdm/warehouses/{warehouseId}', {
      params: { path: { warehouseId: 3 } },
    });

    expect(etags.ifMatch('/mdm/warehouses/3')).toBe('"7"');
  });

  it('ETag가 없는 응답은 캡처하지 않는다', async () => {
    const { client, etags } = createApiClient({
      baseUrl: 'http://mock.test',
      fetch: async () => jsonResponse([]),
    });

    await client.GET('/mdm/warehouses');

    expect(etags.ifMatch('/mdm/warehouses')).toBeUndefined();
  });
});
