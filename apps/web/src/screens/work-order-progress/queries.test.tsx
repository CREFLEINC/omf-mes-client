import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { type ProgressFilters, toProgressListQuery } from './filters';
import { useWorkOrderDetail, useWorkOrderProgressList, workOrderProgressKeys } from './queries';
import { DEFAULT_SORT } from './sort';

const KST = 540;

const filters = (overrides: Partial<ProgressFilters> = {}): ProgressFilters => ({
  from: '2026-08-01',
  to: '2026-08-30',
  productionLineId: '',
  statusCode: '',
  productionOrderId: '',
  keyword: '',
  ...overrides,
});

const queryFor = (overrides: Partial<ProgressFilters> = {}) =>
  toProgressListQuery(filters(overrides), DEFAULT_SORT, 1, KST);

const collecting = (): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];
  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    urls.push(`${url.pathname}${url.search}`);
    return jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } });
  };

  return { urls, fetch };
};

describe('workOrderProgressKeys', () => {
  it('조건이 다르면 캐시도 갈린다 — 앞 조건의 결과를 보이지 않는다', () => {
    expect(workOrderProgressKeys.list(queryFor())).not.toEqual(
      workOrderProgressKeys.list(queryFor({ productionLineId: '7' })),
    );
  });

  it('고른 W/O 가 다르면 상세 캐시도 갈린다', () => {
    expect(workOrderProgressKeys.detail(7001)).not.toEqual(workOrderProgressKeys.detail(7002));
  });

  it('무효화 뿌리 키가 모든 갈래를 덮는다', () => {
    for (const key of [
      workOrderProgressKeys.list(queryFor()),
      workOrderProgressKeys.detail(7001),
    ]) {
      expect(key.slice(0, 1)).toEqual([...workOrderProgressKeys.all]);
    }
  });
});

describe('조회를 열지 않는 자리', () => {
  /*
   * 요청이 안 나가는 것만으로는 부족하다. 조회를 열어 둔 채 안에서 던지게 두어도 요청은
   * 안 나가지만 **훅이 오류 상태가 된다** — 고르기도 전에 화면에 조회 실패가 뜬다.
   */
  it('⛔ 기간이 막히면 요청도 없고 오류도 아니다', async () => {
    const { urls, fetch } = collecting();

    const { result } = renderHookWithProviders(() => useWorkOrderProgressList(null), { fetch });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
    expect(urls).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it('⛔ 고르기 전에는 상세를 부르지 않는다 — 0 으로 부르지도 않는다', async () => {
    const { urls, fetch } = collecting();

    const { result } = renderHookWithProviders(() => useWorkOrderDetail(null), { fetch });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
    expect(urls).toEqual([]);
    expect(result.current.isError).toBe(false);
  });
});

describe('useWorkOrderProgressList', () => {
  it('조건을 그대로 싣는다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useWorkOrderProgressList(queryFor({ productionLineId: '7' })), {
      fetch,
    });

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    const params = new URLSearchParams(urls[0]?.split('?')[1] ?? '');
    expect(params.get('plannedStartFrom')).toBe('2026-08-01T00:00:00+09:00');
    expect(params.get('plannedStartTo')).toBe('2026-08-31T00:00:00+09:00');
    expect(params.get('productionLineId')).toBe('7');
    expect(params.get('sort')).toBe('priorityNo,asc');
    expect(params.get('size')).toBe('50');
  });

  it('실적 누계를 함께 받는다 — 목록의 양품·달성률이 여기서 온다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useWorkOrderProgressList(queryFor()), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    expect(new URLSearchParams(urls[0]?.split('?')[1] ?? '').get('withProgress')).toBe('true');
  });

  /*
   * ⛔ **L-6 — 자동 갱신을 두지 않는다.** 관리자 조회 화면에 폴링을 두면 서버 부하가 사용자
   * 수만큼 곱해진다. 갱신은 사람이 새로고침을 누를 때만 일어난다.
   */
  it('⛔ 가만히 두면 다시 부르지 않는다 — 폴링이 없다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useWorkOrderProgressList(queryFor()), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(urls).toHaveLength(1);
  });

  it('조회 실패를 오류로 알린다 — 조용히 빈 목록으로 두지 않는다', async () => {
    const fetch: StubFetch = async () => jsonResponse({ message: '실패' }, { status: 500 });

    const { result } = renderHookWithProviders(() => useWorkOrderProgressList(queryFor()), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useWorkOrderDetail', () => {
  it('고른 W/O 의 상세를 부른다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useWorkOrderDetail(7001), { fetch });

    await waitFor(() => {
      expect(urls).toEqual(['/production/work-orders/7001']);
    });
  });
});
