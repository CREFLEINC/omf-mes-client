import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { productionOrderKeys, toProductionOrderFact, useProductionOrderDetail } from './queries';

const LIST_PATH = '/planning/production-orders';
const DETAIL_PATH = '/planning/production-orders/202';

const isExactly = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

const productionOrder = (productionOrderId: number) => ({
  productionOrderId,
  productionOrderNo: `PO-${String(productionOrderId)}`,
  itemId: 7000 + productionOrderId,
  orderQty: 12.5,
  uomId: 8001,
  statusCode: 'RELEASED',
  expandedWorkOrderCount: 2,
  plannedWorkOrderCount: 3,
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

describe('toProductionOrderFact', () => {
  it('목록과 상세가 공유하는 선택적 계약 필드의 안전한 fact를 만든다', () => {
    expect(toProductionOrderFact(productionOrder(101))).toMatchObject({
      erpOrderNo: null,
      parentProductionOrderId: null,
      bomLevel: 0,
      businessUnitId: null,
      plantId: null,
      dueDate: null,
      remarks: null,
      expandedWorkOrderCount: 2,
      plannedWorkOrderCount: 3,
    });
  });
});

describe('useProductionOrderDetail', () => {
  it('선택 전에는 상세 요청을 보내지 않는다', async () => {
    const fetch: StubFetch = async () => {
      throw new Error('선택 전 상세 요청을 보내면 안 됩니다.');
    };
    const { result } = renderHookWithProviders(() => useProductionOrderDetail(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('ID별 exact path를 조회하고 목록과 같은 fact로 옮긴다', async () => {
    const { fetch, urls } = recordingFetch({
      match: (request) => isExactly(request, DETAIL_PATH),
      respond: () =>
        jsonResponse({
          ...productionOrder(202),
          erpOrderNo: 'ERP-202',
          parentProductionOrderId: 101,
          bomLevel: 2,
          plantId: 3101,
          dueDate: '2026-08-14',
          businessUnitId: 2101,
          remarks: 'Synthetic remarks',
          versionNo: 7,
          expandedWorkOrderCount: 4,
          plannedWorkOrderCount: 5,
        }),
    });
    const { result } = renderHookWithProviders(() => useProductionOrderDetail(202), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe(DETAIL_PATH);
    expect(result.current.data).toEqual({
      productionOrderId: 202,
      productionOrderNo: 'PO-202',
      erpOrderNo: 'ERP-202',
      parentProductionOrderId: 101,
      bomLevel: 2,
      businessUnitId: 2101,
      plantId: 3101,
      itemId: 7202,
      orderQty: 12.5,
      uomId: 8001,
      dueDate: '2026-08-14',
      remarks: 'Synthetic remarks',
      statusCode: 'RELEASED',
      expandedWorkOrderCount: 4,
      plannedWorkOrderCount: 5,
      autoPlan: null,
      worklistState: null,
      worklistReasons: [],
    });
    expect(productionOrderKeys.detail(202)).not.toEqual(productionOrderKeys.detail(203));
  });

  it('상세 HTTP 실패를 성공 데이터로 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch({
      match: (request) => isExactly(request, DETAIL_PATH),
      respond: () => jsonResponse({ message: 'synthetic missing detail' }, { status: 404 }),
    });
    const { result } = renderHookWithProviders(() => useProductionOrderDetail(202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('상세 네트워크 실패를 성공 데이터로 바꾸지 않는다', async () => {
    const fetch: StubFetch = async () => {
      throw new TypeError('synthetic detail network failure');
    };
    const { result } = renderHookWithProviders(() => useProductionOrderDetail(202), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
