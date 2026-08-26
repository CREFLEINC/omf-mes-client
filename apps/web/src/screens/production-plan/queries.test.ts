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
  useAllProductionPlans,
  useProductionPlanDetail,
  useProductionPlanList,
} from './queries';

const LIST_PATH = '/planning/production-plans';
const DETAIL_PATH = '/planning/production-plans/202';

const isExactly = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const productionPlan = (productionPlanId: number) => ({
  productionPlanId,
  productionOrderId: 1202,
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
  it('생략된 선택 필드는 공개 fact에서 모두 null로 통일한다', () => {
    expect(toProductionPlanFact(productionPlan(101))).toMatchObject({
      plannedLineId: null,
      confirmedAt: null,
      remarks: null,
    });
  });

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

describe('useAllProductionPlans', () => {
  it('P/O 선택 전에는 전체 목록 요청을 보내지 않는다', () => {
    const fetch: StubFetch = async () => {
      throw new Error('P/O 선택 전 전체 목록 요청을 보내면 안 됩니다.');
    };
    const { result } = renderHookWithProviders(() => useAllProductionPlans(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('한 쪽으로 완결되면 편집용 크기만 보내고 서버 순서를 보존한다', async () => {
    const { fetch, urls } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () =>
        jsonResponse({
          items: [productionPlan(202), productionPlan(101)],
          page: { page: 1, size: 50, total: 2 },
        }),
    });
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(urls).toHaveLength(1);
    expect(Array.from(urls[0]?.searchParams.entries() ?? [])).toEqual([
      ['productionOrderId', '1202'],
      ['size', '100'],
    ]);
    expect(result.current.data).toEqual({
      items: [toProductionPlanFact(productionPlan(202)), toProductionPlanFact(productionPlan(101))],
      total: 2,
    });
  });

  it('서버가 정한 쪽 크기로 끝까지 읽고 중복 ID를 제거한다', async () => {
    const urls: URL[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      urls.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const ids = page === 1 ? [201, 202] : page === 2 ? [202, 203] : [204, 205];
      return jsonResponse({
        items: ids.map(productionPlan),
        page: { page, size: 2, total: 5 },
      });
    };
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(urls.map((url) => url.searchParams.get('page'))).toEqual([null, '2', '3']);
    expect(urls.every((url) => url.searchParams.get('size') === '100')).toBe(true);
    expect(result.current.data?.items.map((item) => item.productionPlanId)).toEqual([
      201, 202, 203, 204, 205,
    ]);
    expect(result.current.data?.total).toBe(5);
  });

  it('남은 쪽이 있는데 서버 쪽 크기가 유효하지 않으면 실패한다', async () => {
    const { fetch, urls } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () =>
        jsonResponse({
          items: [productionPlan(201)],
          page: { page: 1, size: 0, total: 2 },
        }),
    });
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(urls).toHaveLength(1);
    expect(result.current.error).toEqual(
      new Error('생산계획 전체 목록의 쪽 크기를 확인할 수 없습니다.'),
    );
  });

  it('첫 응답의 고유 계획이 서버 total을 넘으면 불일치 정본을 캐시하지 않는다', async () => {
    const { fetch } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () =>
        jsonResponse({
          items: [productionPlan(201), productionPlan(202)],
          page: { page: 1, size: 100, total: 1 },
        }),
    });
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(
      new Error('생산계획 전체 목록의 쪽 정보가 일관되지 않습니다.'),
    );
  });

  it.each([
    { label: '시작 쪽 번호', page: { page: 2, size: 100, total: 0 } },
    { label: '전체 건수', page: { page: 1, size: 100, total: -1 } },
  ])('첫 응답의 $label 메타가 유효하지 않으면 실패한다', async ({ page }) => {
    const { fetch } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () => jsonResponse({ items: [], page }),
    });
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(
      new Error('생산계획 전체 목록의 쪽 정보가 일관되지 않습니다.'),
    );
  });

  it('조회 도중 서버 쪽 메타가 바뀌면 서로 다른 스냅샷을 합치지 않는다', async () => {
    const fetch: StubFetch = async (request) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
      return jsonResponse({
        items: page === 1 ? [productionPlan(201), productionPlan(202)] : [productionPlan(203)],
        page: { page, size: 2, total: page === 1 ? 3 : 4 },
      });
    };
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(
      new Error('생산계획 전체 목록의 쪽 정보가 일관되지 않습니다.'),
    );
  });

  it.each([
    { label: '쪽 번호', page: 3, size: 2 },
    { label: '쪽 크기', page: 2, size: 1 },
  ])('조회 도중 서버 $label가 바뀌면 실패한다', async ({ page: returnedPage, size }) => {
    const fetch: StubFetch = async (request) => {
      const requestedPage = Number(new URL(request.url).searchParams.get('page') ?? '1');
      return jsonResponse({
        items:
          requestedPage === 1 ? [productionPlan(201), productionPlan(202)] : [productionPlan(203)],
        page: {
          page: requestedPage === 1 ? 1 : returnedPage,
          size: requestedPage === 1 ? 2 : size,
          total: 3,
        },
      });
    };
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(
      new Error('생산계획 전체 목록의 쪽 정보가 일관되지 않습니다.'),
    );
  });

  it('끝까지 읽어도 서버 total보다 고유 계획이 적으면 부분 성공으로 숨기지 않는다', async () => {
    const urls: URL[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      urls.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      return jsonResponse({
        items: page === 1 ? [productionPlan(201), productionPlan(202)] : [],
        page: { page, size: 2, total: 3 },
      });
    };
    const { result } = renderHookWithProviders(() => useAllProductionPlans(1202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(urls.map((url) => url.searchParams.get('page'))).toEqual([null, '2']);
    expect(result.current.error).toEqual(new Error('생산계획 전체 목록을 완성하지 못했습니다.'));
  });

  it('P/O가 다르면 전체 목록 캐시 키도 다르다', () => {
    expect(productionPlanKeys.allForOrder(1202)).not.toEqual(productionPlanKeys.allForOrder(1203));
    expect(productionPlanKeys.allForOrder(1202)).not.toEqual(productionPlanKeys.list(1202, 1));
    expect(productionPlanKeys.allForOrder(1202)).not.toEqual(productionPlanKeys.detail(1202));
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
    expect(urls[0]?.search).toBe('');
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
