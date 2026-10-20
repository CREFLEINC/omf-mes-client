import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { ApiClientProvider } from '../../patterns/api-context';
import { toApiError } from '../../patterns/request';
import { DASHBOARD_REFRESH_INTERVAL_MS, useDashboardSummary } from './queries';

/**
 * `GET /app/dashboard-summary` 를 실제로 부른다(omf-all-around#112). 한동안 서버에 경로가 없어
 * 부르지 않고 501로 거부했었다(#1063) — 그 차단이 되살아나면 화면은 다시 「준비 중」에 갇힌다.
 */
const summaryBody = {
  baseDate: '2026-10-16',
  plantId: 1,
  asOf: '2026-10-16T09:20:00+07:00',
  cards: [{ cardCode: 'PRODUCTION_QTY', label: '금일 총생산', value: 4321, unit: 'EA' }],
};

const isSummaryRequest = (request: Request): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === '/app/dashboard-summary';

describe('useDashboardSummary', () => {
  it('기간·공장을 질의로 실어 서버 집계를 부른다', async () => {
    const fetch = vi.fn(
      createStubFetch([{ match: isSummaryRequest, respond: () => jsonResponse(summaryBody) }]),
    );

    const { result } = renderHookWithProviders(
      () => useDashboardSummary({ dateFrom: '2026-10-10', dateTo: '2026-10-16', plantId: 1 }),
      { fetch },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(fetch.mock.calls[0]![0].url);
    expect(url.searchParams.get('dateFrom')).toBe('2026-10-10');
    expect(url.searchParams.get('dateTo')).toBe('2026-10-16');
    expect(url.searchParams.has('baseDate')).toBe(false);
    expect(url.searchParams.get('plantId')).toBe('1');
    expect(result.current.data?.cards[0]).toMatchObject({
      cardCode: 'PRODUCTION_QTY',
      value: 4321,
    });
  });

  it('조건이 비어 있어도 부른다 — 날짜·공장은 서버가 정한다', async () => {
    const fetch = vi.fn(
      createStubFetch([{ match: isSummaryRequest, respond: () => jsonResponse(summaryBody) }]),
    );

    const { result } = renderHookWithProviders(() => useDashboardSummary({}), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = new URL(fetch.mock.calls[0]![0].url);
    expect([...url.searchParams.keys()]).toEqual([]);
  });

  it('서버 실패는 상태 코드 그대로 오류로 정착한다', async () => {
    const fetch = createStubFetch([
      { match: isSummaryRequest, respond: () => jsonResponse({}, { status: 500 }) },
    ]);

    const { result } = renderHookWithProviders(() => useDashboardSummary({}), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toApiError(result.current.error)).toMatchObject({ kind: 'http', status: 500 });
  });
});

/**
 * 다른 화면에서 판정을 확정하고 메뉴로 돌아오면 그 결과가 바로 보여야 한다(omf-all-around#124).
 * 앱 기본 신선도(30초) 안에 돌아와도 캐시만 보이고 끝나면 F5 전까지 옛 숫자가 남는다.
 */
describe('useDashboardSummary — 화면에 다시 들어올 때', () => {
  it('앱 기본 신선도 안이어도 다시 부른다', async () => {
    const fetch = vi.fn(
      createStubFetch([{ match: isSummaryRequest, respond: () => jsonResponse(summaryBody) }]),
    );

    const first = renderHookWithProviders(() => useDashboardSummary({}), { fetch });
    const { queryClient, apiClient } = first;
    // 앱 기본 신선도(app/providers.tsx 의 30초) — screens 는 app 을 참조하지 못해(dep:check) 값만 맞춘다.
    queryClient.setDefaultOptions({
      queries: { ...queryClient.getDefaultOptions().queries, staleTime: 30_000 },
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ApiClientProvider, { client: apiClient, children }),
      );
    renderHook(() => useDashboardSummary({}), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});

/**
 * ⭐ 대시보드만 주기 자동 갱신(사용자 결정 2026-10-16, omf-all-around#115). 앱 전역 기본값에
 * 번지지 않았는지는 `app/providers.test.tsx`가 본다.
 */
describe('useDashboardSummary — 주기 자동 갱신', () => {
  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it('주기마다 서버 집계를 다시 부른다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = vi.fn(
      createStubFetch([{ match: isSummaryRequest, respond: () => jsonResponse(summaryBody) }]),
    );

    const { result } = renderHookWithProviders(() => useDashboardSummary({}), { fetch });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_INTERVAL_MS - 1_000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('지난 기간(live: false)이면 주기가 와도 다시 부르지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = vi.fn(
      createStubFetch([{ match: isSummaryRequest, respond: () => jsonResponse(summaryBody) }]),
    );

    const { result } = renderHookWithProviders(
      () => useDashboardSummary({ dateFrom: '2026-10-01', dateTo: '2026-10-07' }, { live: false }),
      { fetch },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_INTERVAL_MS * 2);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('탭이 숨겨진 동안에는 주기가 와도 다시 부르지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = vi.fn(
      createStubFetch([{ match: isSummaryRequest, respond: () => jsonResponse(summaryBody) }]),
    );

    const { result, queryClient } = renderHookWithProviders(() => useDashboardSummary({}), {
      fetch,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryCache().getAll()[0]?.options).not.toMatchObject({
      refetchIntervalInBackground: true,
    });

    act(() => {
      focusManager.setFocused(false);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_INTERVAL_MS * 2);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('자동 갱신이 실패해도 직전 값을 지우지 않고 오류로 정착한다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let fail = false;
    const fetch = createStubFetch([
      {
        match: isSummaryRequest,
        respond: () => (fail ? jsonResponse({}, { status: 500 }) : jsonResponse(summaryBody)),
      },
    ]);

    const { result } = renderHookWithProviders(() => useDashboardSummary({}), { fetch });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    fail = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_INTERVAL_MS);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data?.cards[0]).toMatchObject({ cardCode: 'PRODUCTION_QTY' });
  });

  it('주기는 1분이다', () => {
    expect(DASHBOARD_REFRESH_INTERVAL_MS).toBe(60_000);
  });
});
