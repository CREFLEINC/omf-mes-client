import type { components } from '@omf-mes/api-client';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { LOT_STATUS_GROUP_CODE, LOT_TYPE_GROUP_CODE, useLotCodeOptions } from './options';

const PATH = '/mdm/code-values';

const value = (code: string, displayOrder: number): components['schemas']['CodeValue'] => ({
  codeValueId: 1000 + displayOrder,
  codeGroupId: 2001,
  code,
  codeName: `${code} 이름`,
  displayOrder,
  isActive: displayOrder !== 2,
});

const route = (body: unknown, status = 200): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === PATH,
  respond: () => jsonResponse(body, { status }),
});

const listBody = (items: components['schemas']['CodeValue'][], total = items.length) => ({
  items,
  page: { page: 1, size: 50, total },
});

describe('LOT 코드 선택지', () => {
  it.each([LOT_TYPE_GROUP_CODE, LOT_STATUS_GROUP_CODE] as const)(
    '%s를 codeGroupCode로 직접 조회하고 codeGroupId는 보내지 않는다',
    async (codeGroupCode) => {
      const urls: URL[] = [];
      const stub = createStubFetch([route(listBody([value('SAMPLE_A', 1)]))]);
      const fetch = async (request: Request): Promise<Response> => {
        urls.push(new URL(request.url));
        return stub(request);
      };
      const { result } = renderHookWithProviders(() => useLotCodeOptions(codeGroupCode), {
        fetch,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(urls[0]?.searchParams.get('codeGroupCode')).toBe(codeGroupCode);
      expect(urls[0]?.searchParams.has('codeGroupId')).toBe(false);
    },
  );

  it('서버 순서·이름·활성 여부를 보존하고 잘림을 밝힌다', async () => {
    const items = [value('SAMPLE_B', 9), value('SAMPLE_A', 2)];
    const { result } = renderHookWithProviders(() => useLotCodeOptions(LOT_TYPE_GROUP_CODE), {
      fetch: createStubFetch([route(listBody(items, 3))]),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      items: [
        { code: 'SAMPLE_B', label: 'SAMPLE_B 이름', displayOrder: 9, isActive: true },
        { code: 'SAMPLE_A', label: 'SAMPLE_A 이름', displayOrder: 2, isActive: false },
      ],
      isSeeded: true,
      isTruncated: true,
    });
  });

  /* G-33 — 고객이 늘리는 코드의 표시명은 다국어 컬럼이 먼저고 기본 이름은 fallback이다. */
  it('다국어 이름이 있으면 그것을 라벨로 쓰고, 비면 기본 이름으로 물러난다', async () => {
    const items = [
      { ...value('SAMPLE_L', 1), nameKo: '현지 이름' },
      { ...value('SAMPLE_M', 3), nameKo: '   ' },
      { ...value('SAMPLE_N', 4), nameKo: null },
    ];
    const { result } = renderHookWithProviders(() => useLotCodeOptions(LOT_STATUS_GROUP_CODE), {
      fetch: createStubFetch([route(listBody(items, 3))]),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.items.map((item) => item.label)).toEqual([
      '현지 이름',
      'SAMPLE_M 이름',
      'SAMPLE_N 이름',
    ]);
  });

  it('성공한 빈 seed와 조회 실패를 구분한다', async () => {
    const empty = renderHookWithProviders(() => useLotCodeOptions(LOT_STATUS_GROUP_CODE), {
      fetch: createStubFetch([route(listBody([]))]),
    });
    const failed = renderHookWithProviders(() => useLotCodeOptions(LOT_TYPE_GROUP_CODE), {
      fetch: createStubFetch([route({ message: '' }, 500)]),
    });

    await waitFor(() => expect(empty.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(failed.result.current.isError).toBe(true));
    expect(empty.result.current.data).toEqual({
      items: [],
      isSeeded: false,
      isTruncated: false,
    });
    expect(failed.result.current.data).toBeUndefined();
  });
});
