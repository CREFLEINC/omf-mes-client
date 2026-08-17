import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { purchaseOrderDetailBody } from './fixtures';
import { poRegisterKeys, useCreatePurchaseOrder } from './queries';
import type { PoDetailResult } from './types';

/**
 * 캐시 키의 모양. **앞머리가 갈려 있어야** 한쪽을 다시 불러도 다른 쪽이 함께 무효화되지 않는다.
 */

const CREATE_PATH = '/logistics/purchase-orders';

const BODY = {
  supplierId: 9301,
  businessUnitId: 9201,
  plantId: 9401,
  orderDate: '2026-08-17',
  sourceInboundReceiptLineId: 9111,
  lines: [{ itemId: 9501, orderedQty: 12, uomId: 9601 }],
};

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
}

const createFetch = (
  routes: StubRoute[],
): { fetch: (request: Request) => Promise<Response>; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
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

const createRoute = (): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === CREATE_PATH,
  respond: () => jsonResponse(purchaseOrderDetailBody(), { status: 201 }),
});

describe('poRegisterKeys', () => {
  it('넘어온 전표와 만들어진 발주는 서로 다른 앞머리를 쓴다', () => {
    expect(poRegisterKeys.sourceReceipt(9101)).toEqual(['po-register', 'source-receipt', 9101]);
    expect(poRegisterKeys.detail(9801)).toEqual(['po-register', 'purchase-order', 9801]);
  });

  it('맥락이 없는 상태도 자기 키를 갖는다 — 키가 없으면 조회 상태를 가릴 수 없다', () => {
    expect(poRegisterKeys.sourceReceipt(null)).toEqual(['po-register', 'source-receipt', null]);
  });
});

/**
 * 등록 쓰기 — **헤더 규약이 계약과 맞는지 훅 층에서 잰다**(완료 조건 C14·C15).
 *
 * 화면 층 감지기와 겹치는 것이 아니다: 여기서 재는 것은 **훅이 계약에 맞는 요청을 만드는가**이고,
 * 화면 쪽은 **그 훅을 한 번만 부르는가**를 잰다.
 */
describe('useCreatePurchaseOrder', () => {
  it('컬렉션 경로로 한 번 보내고 멱등 키를 싣는다', async () => {
    const { fetch, requests } = createFetch([createRoute()]);
    const { result } = renderHookWithProviders(
      () => useCreatePurchaseOrder({ onSuccess: vi.fn() }),
      {
        fetch,
      },
    );

    act(() => {
      result.current.write(BODY);
    });

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url.pathname).toBe(CREATE_PATH);
    expect(requests[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  /**
   * **잠금 토큰을 싣지 않는다**(`etagPath: null` · 계획 §5.2.1 ③).
   *
   * 계약의 parameters에 `If-Match`가 없고 응답에 409가 없다 — 새 전표라 견줄 판이 없다.
   * 화면이 들고 있는 토큰은 **다른 자원**(넘어온 입하 전표)의 것이라, 실으면 서로 다른 자원의
   * 버전을 비교하게 된다.
   */
  it('If-Match를 싣지 않는다', async () => {
    const { fetch, requests } = createFetch([createRoute()]);
    const { result } = renderHookWithProviders(
      () => useCreatePurchaseOrder({ onSuccess: vi.fn() }),
      {
        fetch,
      },
    );

    act(() => {
      result.current.write(BODY);
    });

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(requests[0]?.headers.has('If-Match')).toBe(false);
  });

  /** 응답을 **화면 타입으로 옮겨** 넘긴다 — 내부 번호와 표시 타입이 갈린 채로 온다. */
  it('응답을 화면 타입으로 옮겨 넘긴다', async () => {
    const onSuccess = vi.fn<(data: PoDetailResult) => void>();
    const { fetch } = createFetch([createRoute()]);
    const { result } = renderHookWithProviders(() => useCreatePurchaseOrder({ onSuccess }), {
      fetch,
    });

    act(() => {
      result.current.write(BODY);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess.mock.calls[0]?.[0]).toEqual({
      purchaseOrderId: 9001,
      created: {
        purchaseOrderNo: 'SAMPLE-PO-9001',
        statusCode: 'SAMPLE_PO_STATUS_A',
        erpPurchaseOrderNo: 'SAMPLE-EPO-9001',
        lineCount: 1,
      },
    });
  });
});
