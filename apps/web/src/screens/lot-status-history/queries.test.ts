import type { components } from '@omf-mes/api-client';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { EMPTY_LOT_FILTERS, type LotFilters } from './filters';
import { useLotStatusList, useLotStatusSummary } from './queries';

const LIST_PATH = '/quality/lot-statuses';
const SUMMARY_PATH = '/quality/lot-status-summary';

const statusRow: components['schemas']['LotQualityStatus'] = {
  lotId: 1001,
  lotNo: 'SAMPLE-LOT-001',
  itemId: 2001,
  lotTypeCode: 'SAMPLE_TYPE',
  lotStatusCode: 'SAMPLE_STATUS',
  fullyHeld: false,
  versionNo: 1,
};

const listBody = {
  items: [statusRow],
  page: { page: 3, size: 50, total: 51 },
};

const summaryBody: components['schemas']['LotStatusSummary'] = {
  counts: [{ statusCode: 'SAMPLE_STATUS', lotCount: 51, lotTypeCode: 'SAMPLE_TYPE' }],
  asOf: '2026-08-21T13:00:00+09:00',
};

const route = (path: string, body: unknown, status = 200): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === path,
  respond: () => jsonResponse(body, { status }),
});

const FILTERS: LotFilters = {
  lotType: 'SAMPLE_TYPE',
  q: 'SAMPLE-LOT',
  item: '101',
  status: 'SAMPLE_STATUS',
  warehouse: '202',
  location: '303',
  sort: 'itemDesc',
};

describe('현재 LOT 상태 조회 hooks', () => {
  it('LOT 유형을 고르기 전에는 목록과 요약을 부르지 않는다', async () => {
    const urls: URL[] = [];
    const fetch = async (request: Request): Promise<Response> => {
      urls.push(new URL(request.url));
      return jsonResponse({});
    };
    const { result } = renderHookWithProviders(
      () => ({
        list: useLotStatusList(EMPTY_LOT_FILTERS, 1),
        summary: useLotStatusSummary(EMPTY_LOT_FILTERS),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.list.fetchStatus).toBe('idle');
      expect(result.current.summary.fetchStatus).toBe('idle');
    });
    expect(urls).toHaveLength(0);
  });

  it('같은 모집단 조건을 두 경로에 보내고 목록에만 page와 sort를 더한다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([route(LIST_PATH, listBody), route(SUMMARY_PATH, summaryBody)]);
    const fetch = async (request: Request): Promise<Response> => {
      urls.push(new URL(request.url));
      return stub(request);
    };
    const { result } = renderHookWithProviders(
      () => ({ list: useLotStatusList(FILTERS, 3), summary: useLotStatusSummary(FILTERS) }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.list.isSuccess && result.current.summary.isSuccess).toBe(true);
    });
    const listUrl = urls.find((url) => url.pathname === LIST_PATH);
    const summaryUrl = urls.find((url) => url.pathname === SUMMARY_PATH);
    expect(listUrl?.searchParams.get('page')).toBe('3');
    expect(listUrl?.searchParams.get('sort')).toBe('itemDesc');
    expect(listUrl?.searchParams.has('size')).toBe(false);
    expect(summaryUrl?.searchParams.has('page')).toBe(false);
    expect(summaryUrl?.searchParams.has('sort')).toBe(false);
    for (const key of [
      'lotTypeCode',
      'q',
      'itemId',
      'lotStatusCode',
      'warehouseId',
      'locationId',
    ]) {
      expect(summaryUrl?.searchParams.get(key)).toBe(listUrl?.searchParams.get(key));
    }
  });

  it('목록 행·페이지와 요약을 화면 표시 모델로 옮긴다', async () => {
    const { result } = renderHookWithProviders(
      () => ({ list: useLotStatusList(FILTERS, 3), summary: useLotStatusSummary(FILTERS) }),
      {
        fetch: createStubFetch([route(LIST_PATH, listBody), route(SUMMARY_PATH, summaryBody)]),
      },
    );

    await waitFor(() => {
      expect(result.current.list.isSuccess && result.current.summary.isSuccess).toBe(true);
    });
    expect(result.current.list.data?.rows[0]?.lotNo).toBe('SAMPLE-LOT-001');
    expect(result.current.list.data?.page).toEqual({ page: 3, size: 50, total: 51 });
    expect(result.current.summary.data?.counts[0]?.lotCount).toBe(51);
  });

  it('목록 실패가 요약 성공을 가리지 않는다', async () => {
    const { result } = renderHookWithProviders(
      () => ({ list: useLotStatusList(FILTERS, 3), summary: useLotStatusSummary(FILTERS) }),
      {
        fetch: createStubFetch([
          route(LIST_PATH, { message: '' }, 500),
          route(SUMMARY_PATH, summaryBody),
        ]),
      },
    );

    await waitFor(() => {
      expect(result.current.list.isError && result.current.summary.isSuccess).toBe(true);
    });
  });
});
