import type { components } from '@omf-mes/api-client';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { ApiRequestError } from '../../patterns/request';
import {
  adjustmentDetailBody,
  approvalRequestDetailBody,
  approvalRequestRefBody,
  balanceFixtures,
  countFixtures,
  countVarianceLineFixtures,
} from './fixtures';
import {
  detailPathOf,
  isApprovalForbidden,
  isApprovalNotFound,
  stockAdjustKeys,
  useAdjustmentDetailFetcher,
  useApprovalRequest,
  useCountVarianceLines,
  useCreateStockAdjustment,
  useInventoryCounts,
  useLocationBalances,
  useRequestAdjustmentApproval,
  VARIANCE_LINE_PAGE_SIZE,
} from './queries';
import type { CreatedAdjustmentResult } from './types';

/**
 * 이 회차의 읽기 셋과 쓰기 하나 — 실사 목록 · 실사 차이 라인 · 재고 잔액 · 조정 등록.
 *
 * 훅 층에서 재는 것은 **계약에 맞는 요청을 만드는가**이고, 화면 층에서 재는 것은
 * **그 훅을 언제 몇 번 부르는가**다.
 */

type InventoryAdjustmentCreate = components['schemas']['InventoryAdjustmentCreate'];

const COUNTS_PATH = '/inventory/counts';
const VARIANCE_PATH = '/inventory/counts/9101/lines';
const BALANCES_PATH = '/inventory/balances';

interface RecordedRequest {
  url: URL;
}

/** 쓰기는 **헤더까지** 본다 — 계약이 요구하는 것과 금지하는 것이 둘 다 헤더에 있다. */
interface WriteRequest {
  method: string;
  url: URL;
  headers: Headers;
}

const listBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 50, total },
});

const recordingFetch = (
  routes: StubRoute[],
): { fetch: (request: Request) => Promise<Response>; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: async (request) => {
      requests.push({ url: new URL(request.url) });

      return stub(request);
    },
    requests,
  };
};

const getRoute = (pathname: string, body: unknown): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(body),
});

describe('stockAdjustKeys', () => {
  it('읽는 대상마다 앞머리가 갈린다', () => {
    expect(stockAdjustKeys.counts).toEqual(['stock-adjust', 'counts']);
    expect(stockAdjustKeys.varianceLines(9101)).toEqual(['stock-adjust', 'variance-lines', 9101]);
  });

  /** 잔액 키에 **창고와 위치가 함께 있다** — 창고가 바뀌면 같은 위치 번호라도 다른 자료다. */
  it('잔액은 창고·위치마다 캐시가 갈린다', () => {
    expect(stockAdjustKeys.balances(9201, 9401)).toEqual(['stock-adjust', 'balances', 9201, 9401]);
    expect(stockAdjustKeys.balances(9202, 9401)).not.toEqual(stockAdjustKeys.balances(9201, 9401));
  });

  it('대상 실사가 없는 상태도 자기 키를 갖는다 — 키가 없으면 조회 상태를 가릴 수 없다', () => {
    expect(stockAdjustKeys.varianceLines(null)).toEqual(['stock-adjust', 'variance-lines', null]);
  });
});

describe('useInventoryCounts', () => {
  /**
   * ⛔ **승인 대기 조건을 싣지 않는다**(D-3). 계약에 `pendingApprovalOnly`가 남아 있으나
   * 승인 대기는 결재함이 소유한다 — 이 화면에는 그 탭이 없다.
   */
  it('실사 목록을 좁히지 않고 부른다', async () => {
    const { fetch, requests } = recordingFetch([getRoute(COUNTS_PATH, listBody(countFixtures))]);
    const { result } = renderHookWithProviders(() => useInventoryCounts(), { fetch });

    await waitFor(() => {
      expect(result.current.data?.counts).toHaveLength(2);
    });

    expect([...(requests[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  /** 잘린 목록으로 「없는 실사」를 판정하면 안 되므로, 잘렸다는 사실이 함께 올라온다. */
  it('목록이 잘렸으면 그 사실을 함께 낸다', async () => {
    const { fetch } = recordingFetch([getRoute(COUNTS_PATH, listBody(countFixtures, 9))]);
    const { result } = renderHookWithProviders(() => useInventoryCounts(), { fetch });

    await waitFor(() => {
      expect(result.current.data?.truncated).toBe(true);
    });
  });

  it('온전한 목록은 잘리지 않았다고 낸다', async () => {
    const { fetch } = recordingFetch([getRoute(COUNTS_PATH, listBody(countFixtures))]);
    const { result } = renderHookWithProviders(() => useInventoryCounts(), { fetch });

    await waitFor(() => {
      expect(result.current.data?.truncated).toBe(false);
    });
  });
});

describe('useCountVarianceLines', () => {
  it('차이가 있는 줄만 부른다', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(VARIANCE_PATH, listBody(countVarianceLineFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useCountVarianceLines(9101), { fetch });

    await waitFor(() => {
      expect(result.current.data?.lines).toHaveLength(3);
    });

    expect(requests[0]?.url.searchParams.get('varianceOnly')).toBe('true');
  });

  /**
   * **쪽 크기를 싣는다.** 계약이 이 오퍼레이션에 페이지네이션을 못 박았으므로, 싣지 않으면
   * 서버 기본 쪽 크기에 조용히 잘린다 — 그 목록은 조정 대상 자체를 정한다.
   */
  it('쪽 크기를 실어 부른다', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(VARIANCE_PATH, listBody(countVarianceLineFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useCountVarianceLines(9101), { fetch });

    await waitFor(() => {
      expect(result.current.data?.lines).toHaveLength(3);
    });

    expect(requests[0]?.url.searchParams.get('size')).toBe(String(VARIANCE_LINE_PAGE_SIZE));
  });

  /**
   * **받은 것이 전부인지를 함께 낸다**(리뷰 R-2). 잘린 줄 모르고 「N행을 가져왔습니다」로
   * 말하면 조정되지 않은 차이가 남은 채로 전표가 올라간다.
   */
  it('앞쪽 일부만 왔으면 그 사실과 전체 건수를 함께 낸다', async () => {
    const { fetch } = recordingFetch([
      getRoute(VARIANCE_PATH, listBody(countVarianceLineFixtures, 12)),
    ]);
    const { result } = renderHookWithProviders(() => useCountVarianceLines(9101), { fetch });

    await waitFor(() => {
      expect(result.current.data?.truncated).toBe(true);
    });

    expect(result.current.data?.total).toBe(12);
    expect(result.current.data?.lines).toHaveLength(3);
  });

  /** 짝 방향 — 전부 왔으면 잘리지 않았다고 낸다. 「늘 잘렸다」로 통과하지 않게 한다. */
  it('전부 왔으면 잘리지 않았다고 낸다', async () => {
    const { fetch } = recordingFetch([
      getRoute(VARIANCE_PATH, listBody(countVarianceLineFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useCountVarianceLines(9101), { fetch });

    await waitFor(() => {
      expect(result.current.data?.truncated).toBe(false);
    });
  });

  it('세 열의 값이 계약 그대로 온다', async () => {
    const { fetch } = recordingFetch([
      getRoute(VARIANCE_PATH, listBody(countVarianceLineFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useCountVarianceLines(9101), { fetch });

    await waitFor(() => {
      expect(result.current.data?.lines[0]).toMatchObject({ systemQty: 100, varianceQty: -2 });
    });
  });

  it('대상 실사가 없으면 요청이 나가지 않는다', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(VARIANCE_PATH, listBody(countVarianceLineFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useCountVarianceLines(null), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(requests).toHaveLength(0);
  });
});

/**
 * 잔액은 **위치당 한 번**이다(D-6 · C7). 줄마다 부르면 같은 위치의 줄이 늘수록 요청이 는다.
 */
describe('useLocationBalances', () => {
  it('위치마다 한 번씩만 부른다', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(BALANCES_PATH, listBody(balanceFixtures)),
    ]);
    const { result } = renderHookWithProviders(
      () => useLocationBalances(9201, [9401, 9401, 9402]),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.sources[9401]?.isLoading).toBe(false);
    });

    expect(requests.map((request) => request.url.searchParams.get('locationId'))).toEqual([
      '9401',
      '9402',
    ]);
  });

  /**
   * **창고가 함께 실린다.** 계약이 「창고·품목·LOT 중 적어도 하나」를 요구하는데 위치는
   * 그 셋에 들지 않아, 위치만 실으면 400이다.
   */
  it('창고·LOT 축·0인 줄 포함을 함께 싣는다', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(BALANCES_PATH, listBody(balanceFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useLocationBalances(9201, [9401]), { fetch });

    await waitFor(() => {
      expect(result.current.sources[9401]?.isLoading).toBe(false);
    });

    const query = requests[0]?.url.searchParams;

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.get('groupBy')).toBe('LOT');
    expect(query?.get('includeZero')).toBe('true');
  });

  it('대상 창고를 모르면 요청이 나가지 않는다', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(BALANCES_PATH, listBody(balanceFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useLocationBalances(null, [9401]), { fetch });

    await waitFor(() => {
      expect(result.current.sources[9401]?.isAsked).toBe(false);
    });

    expect(requests).toHaveLength(0);
  });

  it('받은 줄을 그 위치의 장부로 낸다', async () => {
    const { fetch } = recordingFetch([getRoute(BALANCES_PATH, listBody(balanceFixtures))]);
    const { result } = renderHookWithProviders(() => useLocationBalances(9201, [9401]), { fetch });

    await waitFor(() => {
      expect(result.current.sources[9401]?.rows).toHaveLength(2);
    });

    expect(result.current.sources[9401]?.rows[0]).toEqual({
      itemId: 9501,
      lotId: 9701,
      onHandQty: 120,
    });
  });

  /**
   * **복구 수단을 함께 낸다**(리뷰 R-3 · C16). 없으면 장부 조회가 실패한 사용자에게 남는
   * 조치가 줄을 지웠다 다시 더하거나 새로고침뿐이다 — 같은 위치를 다시 골라도 관측자가
   * 그대로라 요청이 다시 나가지 않는다.
   */
  it('다시 부르면 그 위치의 요청이 다시 나간다', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(BALANCES_PATH, listBody(balanceFixtures)),
    ]);
    const { result } = renderHookWithProviders(() => useLocationBalances(9201, [9401]), { fetch });

    await waitFor(() => {
      expect(result.current.sources[9401]?.isLoading).toBe(false);
    });

    result.current.refetch();

    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === BALANCES_PATH)).toHaveLength(2);
    });
  });
});

/**
 * 등록 — **이 화면에서 되돌릴 수 없는 첫 쓰기**다.
 *
 * 훅 층에서 재는 것은 **계약에 맞는 요청을 만드는가**이고(경로·메서드·헤더), 화면 층에서 재는
 * 것은 **언제 몇 번 부르는가**다.
 */
describe('useCreateStockAdjustment', () => {
  const ADJUSTMENTS_PATH = '/inventory/adjustments';

  const createRoute = (): StubRoute => ({
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === ADJUSTMENTS_PATH,
    respond: () =>
      jsonResponse(adjustmentDetailBody(), { status: 201, headers: { ETag: 'W/"ia-9301"' } }),
  });

  const body: InventoryAdjustmentCreate = {
    reasonCode: 'SAMPLE_AR_A',
    sendToErp: true,
    lines: [{ locationId: 9401, itemId: 9501, uomId: 9601, adjustmentQty: -20 }],
  };

  const recordingWriteFetch = (
    routes: StubRoute[],
  ): { fetch: (request: Request) => Promise<Response>; requests: WriteRequest[] } => {
    const requests: WriteRequest[] = [];
    const stub = createStubFetch(routes);

    return {
      fetch: async (request) => {
        requests.push({
          method: request.method,
          url: new URL(request.url),
          headers: request.headers,
        });

        return stub(request);
      },
      requests,
    };
  };

  it('컬렉션 경로로 POST 한 번을 보낸다', async () => {
    const { fetch, requests } = recordingWriteFetch([createRoute()]);
    const created: CreatedAdjustmentResult[] = [];
    const { result } = renderHookWithProviders(
      () =>
        useCreateStockAdjustment({
          onSuccess: (view) => {
            created.push(view);
          },
        }),
      { fetch },
    );

    result.current.write(body);

    await waitFor(() => {
      expect(created).toHaveLength(1);
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url.pathname).toBe(ADJUSTMENTS_PATH);
  });

  /**
   * **멱등 키는 싣고 잠금 토큰은 싣지 않는다**(C18 · D-14).
   *
   * 계약 parameters에 `If-Match`가 없고 응답에 409가 없다 — 새 전표라 견줄 판이 없다.
   */
  it('멱등 키를 싣고 If-Match는 싣지 않는다', async () => {
    const { fetch, requests } = recordingWriteFetch([createRoute()]);
    const { result } = renderHookWithProviders(
      () => useCreateStockAdjustment({ onSuccess: () => undefined }),
      { fetch },
    );

    result.current.write(body);

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });

    expect(requests[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requests[0]?.headers.has('If-Match')).toBe(false);
  });

  /**
   * 응답을 **화면 타입으로 옮겨** 넘긴다.
   *
   * **번호와 표시를 갈라 낸다** — 상신이 필요로 하는 것은 내부 번호이고 결과 구획이 필요로
   * 하는 것은 표시 타입이다(`omf-mes#44`).
   */
  it('되돌려 준 전표를 내부 번호와 표시 타입으로 갈라 넘긴다', async () => {
    const { fetch } = recordingWriteFetch([createRoute()]);
    const created: CreatedAdjustmentResult[] = [];
    const { result } = renderHookWithProviders(
      () =>
        useCreateStockAdjustment({
          onSuccess: (view) => {
            created.push(view);
          },
        }),
      { fetch },
    );

    result.current.write(body);

    await waitFor(() => {
      expect(created).toHaveLength(1);
    });

    expect(created[0]).toEqual({
      inventoryAdjustmentId: 9301,
      created: {
        inventoryAdjustmentNo: 'SAMPLE-IA-9301',
        statusCode: 'SAMPLE_IA_STATUS_A',
        erpMessageQueued: true,
        lineCount: 1,
      },
    });
  });

  /**
   * **다시 부를 조회가 없다**(`invalidateKeys: []`).
   *
   * 실사 차이를 무효화하면 그 응답이 다시 와서 조정 대상이 **다시 서고**, 사용자가 방금 보낸
   * 값과 화면의 값이 갈린다 — 등록 뒤 화면이 잠기는 이 화면에서는 특히 조용한 사고다.
   */
  it('성공해도 실사 차이를 다시 부르지 않는다', async () => {
    const { fetch, requests } = recordingWriteFetch([
      createRoute(),
      getRoute(VARIANCE_PATH, listBody(countVarianceLineFixtures)),
    ]);
    const { result } = renderHookWithProviders(
      () => ({
        variance: useCountVarianceLines(9101),
        register: useCreateStockAdjustment({ onSuccess: () => undefined }),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.variance.data?.lines).toHaveLength(3);
    });

    result.current.register.write(body);

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });

    expect(requests.filter((request) => request.url.pathname === VARIANCE_PATH)).toHaveLength(1);
  });
});

/**
 * ⭐ **잠금 토큰이 앉는 자리**(D-14 · C31) — 이 회차에서 가장 조용히 틀리는 자리다.
 *
 * 토큰 보관소가 **요청 URL의 경로별로** `ETag`를 담으므로, 상신의 `If-Match`는 **상세 경로**에서
 * 꺼내야 한다. 등록 201이 준 토큰은 **컬렉션 경로**에 앉는다.
 */
describe('detailPathOf', () => {
  it('상세 경로를 한 곳에서 짓는다', () => {
    expect(detailPathOf(9301)).toBe('/inventory/adjustments/9301');
  });

  /** 컬렉션 경로와 **다른 값**이다 — 같으면 등록 201이 남긴 토큰을 집는다. */
  it('컬렉션 경로가 아니다', () => {
    expect(detailPathOf(9301)).not.toBe('/inventory/adjustments');
  });

  /** 액션 경로도 아니다 — 그 경로에는 토큰이 앉은 적이 없어 요청이 시작조차 되지 않는다. */
  it('액션 경로가 아니다', () => {
    expect(detailPathOf(9301)).not.toContain(':request-approval');
  });
});

/**
 * 상신 — **이 화면의 둘째 쓰기**다. 훅 층에서 재는 것은 **계약에 맞는 요청을 만드는가**다.
 */
describe('useAdjustmentDetailFetcher · useRequestAdjustmentApproval', () => {
  const ADJUSTMENTS_PATH = '/inventory/adjustments';
  const DETAIL_PATH = '/inventory/adjustments/9301';
  const SUBMIT_PATH = '/inventory/adjustments/9301:request-approval';

  /**
   * ⭐ **두 응답의 토큰을 다른 값으로 둔다**(뮤테이션 M-3이 겨누는 자리).
   *
   * 같은 값을 주면 `etagPath`가 컬렉션 경로로 바뀌어도 **우연히 통과한다** — 그때 감지기는
   * 아무 말도 하지 않는다.
   */
  const COLLECTION_ETAG = 'W/"ia-collection-1"';
  const DETAIL_ETAG = 'W/"ia-detail-7"';

  const createRoute = (): StubRoute => ({
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === ADJUSTMENTS_PATH,
    respond: () =>
      jsonResponse(adjustmentDetailBody(), { status: 201, headers: { ETag: COLLECTION_ETAG } }),
  });

  const detailRoute = (): StubRoute => ({
    match: (request) => request.method === 'GET' && new URL(request.url).pathname === DETAIL_PATH,
    respond: () =>
      jsonResponse(adjustmentDetailBody(), { status: 200, headers: { ETag: DETAIL_ETAG } }),
  });

  const submitRoute = (): StubRoute => ({
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === SUBMIT_PATH,
    respond: () => jsonResponse(approvalRequestRefBody(), { status: 202 }),
  });

  const recordingWriteFetch = (
    routes: StubRoute[],
  ): { fetch: (request: Request) => Promise<Response>; requests: WriteRequest[] } => {
    const requests: WriteRequest[] = [];
    const stub = createStubFetch(routes);

    return {
      fetch: async (request) => {
        requests.push({
          method: request.method,
          url: new URL(request.url),
          headers: request.headers,
        });

        return stub(request);
      },
      requests,
    };
  };

  const renderSubmitHooks = (fetch: (request: Request) => Promise<Response>) =>
    renderHookWithProviders(
      () => ({
        fetchDetail: useAdjustmentDetailFetcher(),
        submit: useRequestAdjustmentApproval({
          inventoryAdjustmentId: 9301,
          onSuccess: () => undefined,
        }),
      }),
      { fetch },
    );

  it('상세를 부르면 그 경로로 GET이 나간다', async () => {
    const { fetch, requests } = recordingWriteFetch([detailRoute()]);
    const { result } = renderSubmitHooks(fetch);

    await result.current.fetchDetail(9301);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(DETAIL_PATH);
  });

  /**
   * ⭐ **상세가 준 토큰이 상신의 `If-Match`로 실린다**(C31 · D-14).
   *
   * 등록 201도 `ETag`를 주지만 그 토큰은 **컬렉션 경로**에 앉는다 — 두 값을 다르게 두었으므로,
   * 컬렉션 쪽을 집는 구현이면 이 시험이 문다.
   */
  it('상세가 준 토큰을 If-Match로 싣는다 — 등록 201의 토큰이 아니다', async () => {
    const { fetch, requests } = recordingWriteFetch([createRoute(), detailRoute(), submitRoute()]);
    const { result } = renderHookWithProviders(
      () => ({
        register: useCreateStockAdjustment({ onSuccess: () => undefined }),
        fetchDetail: useAdjustmentDetailFetcher(),
        submit: useRequestAdjustmentApproval({
          inventoryAdjustmentId: 9301,
          onSuccess: () => undefined,
        }),
      }),
      { fetch },
    );

    /* 등록 201이 컬렉션 경로에 토큰을 앉힌다 — 그 값을 집으면 안 된다. */
    result.current.register.write({
      reasonCode: 'SAMPLE_AR_A',
      sendToErp: true,
      lines: [{ locationId: 9401, itemId: 9501, uomId: 9601, adjustmentQty: -20 }],
    });

    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === ADJUSTMENTS_PATH)).toHaveLength(
        1,
      );
    });

    await result.current.fetchDetail(9301);
    result.current.submit.write({ reason: '실사 차이분 조정' });

    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === SUBMIT_PATH)).toHaveLength(1);
    });

    const submitRequest = requests.find((request) => request.url.pathname === SUBMIT_PATH);

    expect(submitRequest?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(submitRequest?.headers.get('If-Match')).not.toBe(COLLECTION_ETAG);
    expect(submitRequest?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  /**
   * **토큰이 없으면 요청을 만들지 않는다**(공통 훅 계약). 빈 `If-Match`는 계약 위반이라 서버가
   * 400으로 되돌린다 — 보내지 않고 「최신 정보를 불러오는 중입니다」를 세운다.
   */
  it('상세를 부르지 않았으면 상신이 나가지 않는다', async () => {
    const { fetch, requests } = recordingWriteFetch([submitRoute()]);
    const { result } = renderSubmitHooks(fetch);

    result.current.submit.write({ reason: '실사 차이분 조정' });

    await waitFor(() => {
      expect(result.current.submit.error).not.toBeNull();
    });

    expect(requests.filter((request) => request.url.pathname === SUBMIT_PATH)).toHaveLength(0);
  });

  /** 상신 본문은 **사유 하나뿐이다**(C31) — 승인 유형·결재선이 실릴 자리가 계약에 없다. */
  it('본문 키 집합이 사유 하나다', async () => {
    const bodies: unknown[] = [];
    const stub = createStubFetch([detailRoute(), submitRoute()]);
    const fetch = async (request: Request): Promise<Response> => {
      if (request.method === 'POST') bodies.push(await request.clone().json());

      return stub(request);
    };
    const { result } = renderSubmitHooks(fetch);

    await result.current.fetchDetail(9301);
    result.current.submit.write({ reason: '실사 차이분 조정' });

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });

    expect(Object.keys(bodies[0] as Record<string, unknown>)).toEqual(['reason']);
  });
});

/**
 * 결재 진행 — **상신을 확인한 뒤에만 부른다**(C36).
 */
describe('useApprovalRequest', () => {
  const APPROVAL_PATH = '/app/approval-requests/9801';

  const approvalRoute = (status = 200): StubRoute => ({
    match: (request) => request.method === 'GET' && new URL(request.url).pathname === APPROVAL_PATH,
    respond: () =>
      status === 200
        ? jsonResponse(approvalRequestDetailBody())
        : jsonResponse({ message: '' }, { status }),
  });

  it('상신된 요청은 그 번호로 한 번 부른다', async () => {
    const { fetch, requests } = recordingFetch([approvalRoute()]);
    const { result } = renderHookWithProviders(
      () => useApprovalRequest({ kind: 'submitted', approvalRequestId: 9801 }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.data?.request.approvalRequestNo).toBe('SAMPLE-AP-0001');
    });

    expect(requests.filter((request) => request.url.pathname === APPROVAL_PATH)).toHaveLength(1);
  });

  /** ⭐ **상신되지 않았으면 부르지 않는다**(C36) — 목이 채워 준 값으로 여는 길을 막는 자리다. */
  it.each([['notSubmitted' as const], ['unusable' as const]])(
    '%s 갈래에서는 요청이 0건이다',
    async (kind) => {
      const { fetch, requests } = recordingFetch([approvalRoute()]);

      renderHookWithProviders(() => useApprovalRequest({ kind }), { fetch });

      await waitFor(() => {
        expect(requests).toHaveLength(0);
      });
    },
  );
});

/**
 * 못 읽은 갈래를 가른다 — **403에만 다시 시도를 붙이지 않는다**(같은 권한으로 다시 불러도
 * 같은 답이 온다).
 */
describe('isApprovalForbidden · isApprovalNotFound', () => {
  it('403과 404를 갈라 읽는다', () => {
    const forbidden = new ApiRequestError({ kind: 'http', status: 403, message: '' });
    const notFound = new ApiRequestError({ kind: 'http', status: 404, message: '' });

    expect(isApprovalForbidden(forbidden)).toBe(true);
    expect(isApprovalNotFound(forbidden)).toBe(false);
    expect(isApprovalNotFound(notFound)).toBe(true);
    expect(isApprovalForbidden(notFound)).toBe(false);
  });

  /** 그 밖의 실패는 둘 다 거짓이다 — 셋째 갈래가 서야 서버 문구가 그대로 선다. */
  it('그 밖의 실패는 둘 다 거짓이다', () => {
    const serverError = new ApiRequestError({ kind: 'http', status: 500, message: '' });

    expect(isApprovalForbidden(serverError)).toBe(false);
    expect(isApprovalNotFound(serverError)).toBe(false);
  });
});
