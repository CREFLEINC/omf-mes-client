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

/**
 * ⛔ **배열 질의는 쉼표로 잇는다** — 계약이 그렇게 정했다(`style: form` · `explode: false`).
 * 기본 직렬화는 `k=a&k=b` 로 반복해 보내는데, 반복 키를 하나만 취하는 서버에서는 **조건이
 * 조용히 좁아지고** 그 결과가 오류가 아니라 «모자란 목록»으로 나타나 알아채기 어렵다.
 */
describe('createApiClient — 질의 직렬화', () => {
  const capture = () => {
    const urls: string[] = [];
    const { client } = createApiClient({
      baseUrl: 'http://mock.test',
      fetch: async (request) => {
        urls.push(request.url);
        return jsonResponse({ items: [] });
      },
    });

    return { client, urls };
  };

  const queryOf = (url: string | undefined, key: string): string | null =>
    new URL(url ?? 'http://mock.test').searchParams.get(key);

  it('배열은 쉼표로 이어 한 값으로 보낸다', async () => {
    const { client, urls } = capture();

    await client.GET('/mdm/equipments', {
      params: { query: { equipmentTypeCode: ['CALIPER', 'MICROMETER', 'GAUGE'] } },
    });

    expect(queryOf(urls[0], 'equipmentTypeCode')).toBe('CALIPER,MICROMETER,GAUGE');
  });

  it('반복 키로 보내지 않는다', async () => {
    const { client, urls } = capture();

    await client.GET('/mdm/equipments', {
      params: { query: { equipmentTypeCode: ['CALIPER', 'MICROMETER'] } },
    });

    expect(
      new URL(urls[0] ?? 'http://mock.test').searchParams.getAll('equipmentTypeCode'),
    ).toHaveLength(1);
  });

  /** ⛔ 빈 배열은 조건이 아니다 — 보내면 「빈 조건」이 되어 계약(`minItems: 1`)이 거절한다. */
  it('빈 배열은 아예 싣지 않는다', async () => {
    const { client, urls } = capture();

    await client.GET('/mdm/equipments', { params: { query: { equipmentTypeCode: [] } } });

    expect(queryOf(urls[0], 'equipmentTypeCode')).toBeNull();
  });

  it('값 하나인 배열도 그 값 하나로 나간다', async () => {
    const { client, urls } = capture();

    await client.GET('/mdm/equipments', {
      params: { query: { equipmentTypeCode: ['CALIPER'] } },
    });

    expect(queryOf(urls[0], 'equipmentTypeCode')).toBe('CALIPER');
  });

  /** 배열이 아닌 값은 지금까지와 똑같이 나간다 — 규약을 더하면서 기존 동작을 바꾸지 않는다. */
  it('배열이 아닌 값은 그대로 나간다', async () => {
    const { client, urls } = capture();

    await client.GET('/mdm/equipments', {
      params: { query: { q: '캘리퍼', includeInactive: true, page: 2 } },
    });

    expect(queryOf(urls[0], 'q')).toBe('캘리퍼');
    expect(queryOf(urls[0], 'includeInactive')).toBe('true');
    expect(queryOf(urls[0], 'page')).toBe('2');
  });

  /** ⛔ 값이 없는 조건은 싣지 않는다 — 「빈 문자열로 거른다」가 되면 아무것도 안 걸린다. */
  it('undefined 조건은 싣지 않는다', async () => {
    const { client, urls } = capture();

    await client.GET('/mdm/equipments', {
      params: { query: { q: undefined, includeInactive: false } },
    });

    expect(queryOf(urls[0], 'q')).toBeNull();
    expect(queryOf(urls[0], 'includeInactive')).toBe('false');
  });
});

describe('createApiClient — 단말 토큰', () => {
  const capture = (authToken?: () => string | null) => {
    const headers: Headers[] = [];
    const { client } = createApiClient({
      baseUrl: 'http://mock.test',
      authToken,
      fetch: async (request) => {
        headers.push(request.headers);
        return jsonResponse([]);
      },
    });

    return { client, headers };
  };

  it('토큰이 있으면 Bearer 로 싣는다', async () => {
    const { client, headers } = capture(() => 'tok-1');

    await client.GET('/mdm/warehouses');

    expect(headers[0]?.get('Authorization')).toBe('Bearer tok-1');
  });

  it('토큰이 없으면 헤더를 붙이지 않는다', async () => {
    const { client, headers } = capture(() => null);

    await client.GET('/mdm/warehouses');

    expect(headers[0]?.get('Authorization')).toBeNull();
  });

  /* 등록·해제로 값이 바뀐다. 만들 때 고정하면 재등록 뒤에도 옛 토큰을 보낸다. */
  it('요청마다 다시 읽는다', async () => {
    let token = 'tok-1';
    const { client, headers } = capture(() => token);

    await client.GET('/mdm/warehouses');
    token = 'tok-2';
    await client.GET('/mdm/warehouses');

    expect(headers[1]?.get('Authorization')).toBe('Bearer tok-2');
  });

  it('토큰 공급자를 주지 않으면 헤더가 없다', async () => {
    const { client, headers } = capture();

    await client.GET('/mdm/warehouses');

    expect(headers[0]?.get('Authorization')).toBeNull();
  });
});
