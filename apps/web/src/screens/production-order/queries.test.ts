import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { DEFAULT_PRODUCTION_ORDER_FILTERS } from './filters';
import { productionOrderKeys, useProductionOrderList } from './queries';

const LIST_PATH = '/planning/production-orders';

const isExactly = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

const productionOrder = (productionOrderId: number) => ({
  productionOrderId,
  productionOrderNo: `PO-${String(productionOrderId)}`,
  itemId: 7000 + productionOrderId,
  orderQty: 12.5,
  uomId: 8001,
  statusCode: 'RELEASED',
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

describe('useProductionOrderList', () => {
  it('빈 조건도 실제 목록으로 보내고 서버 순서·쪽 정보를 보존한다', async () => {
    const { fetch, urls } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () =>
        jsonResponse({
          items: [
            {
              ...productionOrder(202),
              erpOrderNo: 'ERP-202',
              parentProductionOrderId: 101,
              bomLevel: 2,
              plantId: 3101,
              dueDate: '2026-08-14',
              businessUnitId: 2101,
              remarks: 'Synthetic remarks',
              versionNo: 7,
            },
            productionOrder(101),
          ],
          page: { page: 1, size: 25, total: 47 },
        }),
    });
    const { result } = renderHookWithProviders(
      () => useProductionOrderList(DEFAULT_PRODUCTION_ORDER_FILTERS, 1),
      { fetch },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(urls).toHaveLength(1);
    expect(urls[0]?.search).toBe('');
    expect(result.current.data).toEqual({
      items: [
        {
          productionOrderId: 202,
          productionOrderNo: 'PO-202',
          erpOrderNo: 'ERP-202',
          parentProductionOrderId: 101,
          bomLevel: 2,
          plantId: 3101,
          itemId: 7202,
          orderQty: 12.5,
          uomId: 8001,
          dueDate: '2026-08-14',
          statusCode: 'RELEASED',
        },
        {
          productionOrderId: 101,
          productionOrderNo: 'PO-101',
          erpOrderNo: null,
          parentProductionOrderId: null,
          bomLevel: 0,
          plantId: null,
          itemId: 7101,
          orderQty: 12.5,
          uomId: 8001,
          dueDate: null,
          statusCode: 'RELEASED',
        },
      ],
      page: { page: 1, size: 25, total: 47 },
    });
  });

  it('canonical 조건만 보내며 다른 조건은 다른 캐시 키를 쓴다', async () => {
    const { fetch, urls } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () => jsonResponse({ items: [], page: { page: 3, size: 20, total: 0 } }),
    });
    const { result } = renderHookWithProviders(
      () =>
        useProductionOrderList(
          {
            q: 'PO-A',
            plant: '3101',
            item: '4101',
            status: 'RELEASED',
            dueFrom: '2026-08-01',
            dueTo: '2026-08-31',
          },
          3,
        ),
      { fetch },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.from(urls[0]?.searchParams.entries() ?? [])).toEqual([
      ['q', 'PO-A'],
      ['plantId', '3101'],
      ['itemId', '4101'],
      ['statusCode', 'RELEASED'],
      ['dueDateFrom', '2026-08-01'],
      ['dueDateTo', '2026-08-31'],
      ['page', '3'],
    ]);
    expect(
      productionOrderKeys.list({ ...DEFAULT_PRODUCTION_ORDER_FILTERS, q: 'PO-A' }, 1),
    ).not.toEqual(
      productionOrderKeys.list({ ...DEFAULT_PRODUCTION_ORDER_FILTERS, status: 'RELEASED' }, 1),
    );
  });

  it('목록 HTTP 실패를 빈 성공으로 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch({
      match: (request) => isExactly(request, LIST_PATH),
      respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
    });
    const { result } = renderHookWithProviders(
      () => useProductionOrderList(DEFAULT_PRODUCTION_ORDER_FILTERS, 1),
      { fetch },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('목록 네트워크 실패를 빈 성공으로 바꾸지 않는다', async () => {
    const fetch: StubFetch = async () => {
      throw new TypeError('synthetic network failure');
    };
    const { result } = renderHookWithProviders(
      () => useProductionOrderList(DEFAULT_PRODUCTION_ORDER_FILTERS, 1),
      { fetch },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
