import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { purchaseOrderDetailBody } from './fixtures';
import {
  poDetailPath,
  poRegisterKeys,
  useCreatePurchaseOrder,
  usePurchaseOrderDetailFetcher,
  useRequestApproval,
} from './queries';
import type { PoDetailResult } from './types';

/**
 * 캐시 키의 모양. **앞머리가 갈려 있어야** 한쪽을 다시 불러도 다른 쪽이 함께 무효화되지 않는다.
 */

const CREATE_PATH = '/logistics/purchase-orders';
const DETAIL_PATH = '/logistics/purchase-orders/9001';
const SUBMIT_PATH = '/logistics/purchase-orders/9001:request-approval';

/**
 * **등록 201과 상세 200이 서로 다른 토큰을 준다.**
 *
 * 두 값을 같게 두면 상신이 어느 경로의 토큰을 실었는지 가릴 수 없다 — 컬렉션 경로로 잘못
 * 앉힌 배선이 「우연히 맞는」 값으로 통과한다(계획 §5.2.1의 함정 · 뮤테이션 M-3).
 */
const CREATE_ETAG = 'W/"po-9001-create"';
const DETAIL_ETAG = 'W/"po-9001-detail"';

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
  respond: () =>
    jsonResponse(purchaseOrderDetailBody(), { status: 201, headers: { ETag: CREATE_ETAG } }),
});

const detailRoute = (): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === DETAIL_PATH,
  respond: () => jsonResponse(purchaseOrderDetailBody(), { headers: { ETag: DETAIL_ETAG } }),
});

/** 상신 202. **응답에 `ETag`가 없다**(계약 실측) — 다음 쓰기의 토큰이 여기서 나오지 않는다. */
const submitRoute = (): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === SUBMIT_PATH,
  respond: () => jsonResponse({ approvalRequestId: 9801 }, { status: 202 }),
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

/**
 * **잠금 토큰이 앉는 경로**(계획 결정 10 · 완료 조건 C28).
 *
 * 토큰 보관소가 요청 URL의 **경로별로** `ETag`를 담으므로(실측) 상신의 `If-Match`는 상세
 * 경로에서 나와야 한다. 컬렉션 경로는 목록 조회와 열쇠가 겹치고, 액션 경로는 토큰이 늘 비어
 * 훅이 요청을 만들지 않고 멈춘다(「눌러도 아무 일이 없다」).
 */
describe('poDetailPath', () => {
  it('상세 경로다 — 컬렉션도 액션 경로도 아니다', () => {
    expect(poDetailPath(9001)).toBe(DETAIL_PATH);
    expect(poDetailPath(9001)).not.toBe(CREATE_PATH);
    expect(poDetailPath(9001)).not.toContain(':request-approval');
  });
});

describe('usePurchaseOrderDetailFetcher', () => {
  it('상세를 한 번 부르고 응답을 화면 타입으로 옮긴다', async () => {
    const { fetch, requests } = createFetch([detailRoute()]);
    const { result } = renderHookWithProviders(() => usePurchaseOrderDetailFetcher(), { fetch });

    const data = await result.current(9001);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(DETAIL_PATH);
    expect(data.purchaseOrderId).toBe(9001);
    expect(data.created.purchaseOrderNo).toBe('SAMPLE-PO-9001');
  });

  /**
   * **앱의 기본 신선도(30초)에서도 다시 부른다**(`staleTime: 0`).
   *
   * 이 조회의 목적은 값이 아니라 **토큰**이다. 캐시가 신선하다는 이유로 요청이 나가지 않으면
   * `ETag`가 갱신되지 않아 다음 상신이 낡은 토큰으로 나가고, 409를 받은 뒤 「최신 불러오기」를
   * 눌러도 30초 동안 아무것도 달라지지 않는다.
   *
   * 시험 하네스의 기본 신선도는 0이라 그대로 두면 이 갈래가 재지지 않는다 — **앱과 같은 값을
   * 이 키에 심어** 실제 조건을 만든다.
   */
  it('캐시가 신선해도 토큰을 얻으려 다시 부른다', async () => {
    const { fetch, requests } = createFetch([detailRoute()]);
    const { result, queryClient } = renderHookWithProviders(() => usePurchaseOrderDetailFetcher(), {
      fetch,
    });

    queryClient.setQueryDefaults(poRegisterKeys.detail(9001), { staleTime: 30_000 });

    await result.current(9001);
    await result.current(9001);

    expect(requests).toHaveLength(2);
  });
});

/**
 * 상신 훅 — **계약이 요구하는 두 헤더를 훅 층에서 잰다**(완료 조건 C28·C29).
 *
 * 화면 층 감지기와 겹치는 것이 아니다: 여기서 재는 것은 **훅이 계약에 맞는 요청을 만드는가**
 * 이고, 화면 쪽은 **그 훅을 언제 부르는가**를 잰다.
 */
describe('useRequestApproval', () => {
  const renderSubmit = (purchaseOrderId: number | null, routes: StubRoute[]) => {
    const { fetch, requests } = createFetch(routes);
    const onSuccess = vi.fn();
    const rendered = renderHookWithProviders(
      () => ({
        create: useCreatePurchaseOrder({ onSuccess: vi.fn() }),
        fetchDetail: usePurchaseOrderDetailFetcher(),
        submit: useRequestApproval({ purchaseOrderId, onSuccess }),
      }),
      { fetch },
    );

    return { ...rendered, requests, onSuccess };
  };

  /**
   * **상세가 준 토큰이 그대로 실린다**(뮤테이션 M-3이 겨누는 자리).
   *
   * 등록 201도 `ETag`를 주지만 그것은 **컬렉션 경로**에 앉는다 — 두 값을 다르게 두었으므로
   * 컬렉션 경로로 잘못 앉힌 배선은 여기서 운다.
   */
  it('상세 응답의 ETag를 If-Match로 싣고 액션 경로로 보낸다', async () => {
    const { result, requests } = renderSubmit(9001, [createRoute(), detailRoute(), submitRoute()]);

    /*
     * **등록이 컬렉션 경로에 토큰을 먼저 남긴다.** 그 토큰을 집어 가면 안 된다는 것이 이
     * 시험의 요점이라, 실제로 등록을 한 번 보내 그 자리를 채워 둔다.
     */
    act(() => {
      result.current.create.write(BODY);
    });
    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === CREATE_PATH)).toHaveLength(1);
    });

    await result.current.fetchDetail(9001);

    act(() => {
      result.current.submit.write({ reason: '합성 사유' });
    });

    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === SUBMIT_PATH)).toHaveLength(1);
    });

    const submitted = requests.find((request) => request.url.pathname === SUBMIT_PATH);

    expect(submitted?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(submitted?.headers.get('If-Match')).not.toBe(CREATE_ETAG);
    expect(submitted?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  /**
   * **토큰이 없으면 보내지 않는다.** 계약이 `If-Match`를 필수로 두고 목이 없는 요청을 400으로
   * 되돌리므로(실측), 빈 값으로 보내면 사용자가 고칠 수 없는 400을 받는다.
   */
  it('상세를 부르기 전에는 요청을 만들지 않고 멈춘다', async () => {
    const { result, requests } = renderSubmit(9001, [detailRoute(), submitRoute()]);

    act(() => {
      result.current.submit.write({ reason: '합성 사유' });
    });

    await waitFor(() => {
      expect(result.current.submit.error).not.toBeNull();
    });
    expect(requests).toHaveLength(0);
  });

  /**
   * **없는 값을 0으로 메우지 않는다**(계획 결정 10).
   *
   * `etagPath`를 `null`로 두면 공통 훅은 그것을 「잠금이 필요 없다」로 읽어 요청을 **그대로
   * 내보낸다** — 대체값을 두면 `…/0:request-approval`이 실제로 나갈 수 있는 모양이 된다.
   */
  it('올릴 전표가 없으면 요청 자체를 만들지 않는다', async () => {
    const { result, requests } = renderSubmit(null, [detailRoute(), submitRoute()]);

    act(() => {
      result.current.submit.write({ reason: '합성 사유' });
    });

    await waitFor(() => {
      expect(result.current.submit.error).not.toBeNull();
    });
    expect(requests).toHaveLength(0);
  });

  /**
   * **성공 뒤 상세 키를 무효화한다**(계획 결정 10).
   *
   * 상신 응답에는 `ETag`가 없다(계약 실측). **낡은 토큰을 실제로 막는 것은 fetcher의
   * `staleTime: 0`**이고(리뷰 R-26 — 이 키를 구독하는 구획이 없어 무효화는 재조회를 일으키지
   * 않는다), 무효화가 지키는 것은 **캐시에 남은 상신 전 값**이다. 두 줄이 서로를 대신하지
   * 못하므로 잣대도 갈라 둔다 — 신선도 쪽은 「캐시가 신선해도 토큰을 얻으려 다시 부른다」가 잰다.
   */
  it('성공하면 상세 키를 무효화한다', async () => {
    const { result, requests, onSuccess, queryClient } = renderSubmit(9001, [
      detailRoute(),
      submitRoute(),
    ]);

    await result.current.fetchDetail(9001);

    act(() => {
      result.current.submit.write({ reason: '합성 사유' });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess.mock.calls[0]?.[0]).toEqual({ approvalRequestId: 9801 });
    expect(requests.filter((request) => request.url.pathname === SUBMIT_PATH)).toHaveLength(1);
    await waitFor(() => {
      expect(queryClient.getQueryState(poRegisterKeys.detail(9001))?.isInvalidated).toBe(true);
    });
  });
});
