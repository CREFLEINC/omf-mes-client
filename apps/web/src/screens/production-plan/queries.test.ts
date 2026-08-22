import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  productionPlanKeys,
  toProductionPlanFact,
  useProductionPlanDetail,
  useProductionPlanList,
} from './queries';

const LIST_PATH = '/planning/production-plans';
const DETAIL_PATH = '/planning/production-plans/202';

const isExactly = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const productionPlan = (productionPlanId: number) => ({
  productionPlanId,
  productionOrderId: 1000 + productionPlanId,
  planNo: `PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-22',
  plannedQty: 12.5,
  uomId: 8001,
  bomId: 9001,
  routingId: 9101,
  statusCode: 'DRAFT',
});

const recordingFetch = (route: StubRoute): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch([route]);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
  };
};

describe('toProductionPlanFact', () => {
  it('계획 목록과 상세가 함께 쓰는 공개 fact에 허용 필드만 남긴다', () => {
    expect(
      toProductionPlanFact({
        ...productionPlan(202),
        plannedLineId: 7001,
        confirmedAt: '2026-08-22T09:15:00+09:00',
        confirmedBy: 8101,
        remarks: 'Synthetic plan remark',
        versionNo: 7,
      }),
    ).toEqual({
      productionPlanId: 202,
      productionOrderId: 1202,
      planNo: 'PLAN-202',
      planDate: '2026-08-22',
      plannedQty: 12.5,
      uomId: 8001,
      bomId: 9001,
      routingId: 9101,
      plannedLineId: 7001,
      statusCode: 'DRAFT',
      confirmedAt: '2026-08-22T09:15:00+09:00',
      remarks: 'Synthetic plan remark',
    });
  });
});

describe('useProductionPlanList', () => {
  it('P/O 선택 전에는 목록 요청을 보내지 않는다', () => {
    const fetch: StubFetch = async () => {
      throw new Error('P/O 선택 전 목록 요청을 보내면 안 됩니다.');
    };
    const { result } = renderHookWithProviders(() => useProductionPlanList(null, 1), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('정확한 목록 경로와 허용된 query만 보내며 서버 순서와 쪽 정보를 보존한다', async () => {
    const { fetch, urls } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () =>
        jsonResponse({
          items: [productionPlan(202), productionPlan(101)],
          page: { page: 3, size: 20, total: 47 },
        }),
    });
    const { result } = renderHookWithProviders(() => useProductionPlanList(1202, 3), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe(LIST_PATH);
    expect(Array.from(urls[0]?.searchParams.entries() ?? [])).toEqual([
      ['productionOrderId', '1202'],
      ['page', '3'],
    ]);
    expect(result.current.data).toEqual({
      items: [toProductionPlanFact(productionPlan(202)), toProductionPlanFact(productionPlan(101))],
      page: { page: 3, size: 20, total: 47 },
    });
  });

  it('P/O와 쪽이 다르면 목록 캐시 키도 다르다', () => {
    expect(productionPlanKeys.list(1202, 1)).not.toEqual(productionPlanKeys.list(1203, 1));
    expect(productionPlanKeys.list(1202, 1)).not.toEqual(productionPlanKeys.list(1202, 2));
  });

  it('목록 HTTP 실패를 빈 성공으로 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
    });
    const { result } = renderHookWithProviders(() => useProductionPlanList(1202, 1), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useProductionPlanDetail', () => {
  it('계획 선택 전에는 상세 요청을 보내지 않는다', () => {
    const fetch: StubFetch = async () => {
      throw new Error('계획 선택 전 상세 요청을 보내면 안 됩니다.');
    };
    const { result } = renderHookWithProviders(() => useProductionPlanDetail(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('정확한 상세 경로를 같은 mapper로 읽고 ID별 캐시 키를 쓴다', async () => {
    const { fetch, urls } = recordingFetch({
      match: (request) => isExactly(request, DETAIL_PATH),
      respond: () => jsonResponse(productionPlan(202)),
    });
    const { result } = renderHookWithProviders(() => useProductionPlanDetail(202), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe(DETAIL_PATH);
    expect(result.current.data).toEqual(toProductionPlanFact(productionPlan(202)));
    expect(productionPlanKeys.detail(202)).not.toEqual(productionPlanKeys.detail(203));
  });

  it('상세 404를 성공 데이터로 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch({
      match: (request) => isExactly(request, DETAIL_PATH),
      respond: () => jsonResponse({ message: 'synthetic missing detail' }, { status: 404 }),
    });
    const { result } = renderHookWithProviders(() => useProductionPlanDetail(202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('상세 네트워크 실패를 성공 데이터로 바꾸지 않는다', async () => {
    const fetch: StubFetch = async () => {
      throw new TypeError('synthetic detail network failure');
    };
    const { result } = renderHookWithProviders(() => useProductionPlanDetail(202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
