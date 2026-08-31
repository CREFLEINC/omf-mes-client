import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { salesOrderDetailFixture, salesOrderListFixtures } from './fixtures';
import { useSalesOrderDetail, useSalesOrderList } from './source-queries';

const LIST_PATH = '/logistics/sales-orders';
const DETAIL_PATH = '/logistics/sales-orders/8101';

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

describe('useSalesOrderList', () => {
  it('목록과 쪽 정보를 화면 타입으로 옮긴다', async () => {
    const routes: StubRoute[] = [
      {
        match: (request) => isGet(request, LIST_PATH),
        respond: () =>
          jsonResponse({
            items: salesOrderListFixtures,
            page: { page: 1, size: 50, total: 2 },
          }),
      },
    ];

    const { result } = renderHookWithProviders(() => useSalesOrderList({}), {
      fetch: createStubFetch(routes),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0]?.salesOrderNo).toBe('SAMPLE-SO-0001');
  });
});

describe('useSalesOrderDetail', () => {
  it('고르기 전에는 부르지 않는다', () => {
    const { result } = renderHookWithProviders(() => useSalesOrderDetail(null));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('상세를 화면 타입으로 옮긴다 — 라인을 함께 낸다', async () => {
    const routes: StubRoute[] = [
      {
        match: (request) => isGet(request, DETAIL_PATH),
        respond: () => jsonResponse(salesOrderDetailFixture),
      },
    ];

    const { result } = renderHookWithProviders(() => useSalesOrderDetail(8101), {
      fetch: createStubFetch(routes),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.lines).toHaveLength(2);
    expect(result.current.data?.customerId).toBe(8201);
  });
});
