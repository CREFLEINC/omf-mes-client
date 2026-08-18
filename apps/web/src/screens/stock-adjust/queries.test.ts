import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { balanceFixtures, countFixtures, countVarianceLineFixtures } from './fixtures';
import {
  stockAdjustKeys,
  useCountVarianceLines,
  useInventoryCounts,
  useLocationBalances,
  VARIANCE_LINE_PAGE_SIZE,
} from './queries';

/**
 * 이 회차의 읽기 셋 — 실사 목록 · 실사 차이 라인 · 재고 잔액.
 *
 * 훅 층에서 재는 것은 **계약에 맞는 요청을 만드는가**이고, 화면 층에서 재는 것은
 * **그 훅을 언제 몇 번 부르는가**다.
 */

const COUNTS_PATH = '/inventory/counts';
const VARIANCE_PATH = '/inventory/counts/9101/lines';
const BALANCES_PATH = '/inventory/balances';

interface RecordedRequest {
  url: URL;
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
