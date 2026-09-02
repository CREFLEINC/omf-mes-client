import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';

/**
 * 이 화면의 감지기가 쓰는 목 응답.
 *
 * ⚠ 값은 전부 **지어낸 합성값**이다 — 실 사번·품목코드·LOT 번호를 쓰지 않는다(공개 저장소 경계).
 */

export interface PoChangeStubOptions {
  /** 확인 처리 응답을 갈아 끼운다. */
  acknowledgeResponse?: () => Response;
  /** 상세가 ETag 를 안 내린다 — 잠금 토큰이 없는 갈래. */
  omitEtag?: boolean;
  /** 영향 W/O 의 양품 실적. `null`이면 실적을 아예 안 내린다. */
  producedQty?: number | null;
  /** 목록 조회를 실패시킨다. */
  listStatus?: number;
}

let sent: Request[] = [];

export const requestsSent = (): Request[] => sent;
export const requestedPaths = (): string[] =>
  sent.map((request) => {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  });

const productionOrder = {
  productionOrderId: 31,
  productionOrderNo: 'SYNTH-PO-0031',
  itemId: 5001,
  orderQty: 4000,
  uomId: 7001,
  dueDate: '2026-08-20',
  statusCode: 'CODE-A',
  versionNo: 3,
};

export const poChangeStub = (options: PoChangeStubOptions = {}): StubFetch => {
  sent = [];
  const producedQty = options.producedQty === undefined ? 1200 : options.producedQty;

  const workOrder = {
    workOrderId: 13,
    workOrderNo: 'SYNTH-WO-013',
    productionPlanId: 1,
    routingOperationId: 1,
    itemId: 5001,
    orderQty: 3000,
    uomId: 7001,
    workOrderTypeCode: 'CODE-C',
    statusCode: 'CODE-B',
    versionNo: 4,
    ...(producedQty === null ? {} : { progress: { goodQty: producedQty } }),
  };

  const routes = [
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/planning/production-orders' && request.method === 'GET',
      respond: () =>
        options.listStatus === undefined
          ? jsonResponse({ items: [productionOrder], page: { page: 1, size: 50, total: 1 } })
          : new Response('', { status: options.listStatus }),
    },
    {
      match: (request: Request) =>
        /^\/planning\/production-orders\/\d+$/.test(new URL(request.url).pathname),
      respond: () =>
        jsonResponse(productionOrder, {
          /* ⭐ 확인 처리에 실을 잠금 토큰이 여기서만 온다(B-1-1). */
          headers: options.omitEtag === true ? {} : { ETag: '"3"' },
        }),
    },
    {
      match: (request: Request) => new URL(request.url).pathname === '/production/work-orders',
      respond: () => jsonResponse({ items: [workOrder], page: { page: 1, size: 50, total: 1 } }),
    },
    {
      match: (request: Request) => new URL(request.url).pathname === '/mdm/uoms',
      respond: () =>
        jsonResponse({
          items: [{ uomId: 7001, uomCode: 'EA', isActive: true }],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (request: Request) => new URL(request.url).pathname.endsWith(':acknowledge'),
      respond: () => options.acknowledgeResponse?.() ?? jsonResponse({ productionOrderId: 31 }),
    },
  ];

  const stub = createStubFetch(routes);

  return async (request: Request) => {
    sent.push(request.clone());
    return stub(request);
  };
};

/** 나간 확인 처리 요청. */
export const acknowledgeRequests = (): Request[] =>
  sent.filter((request) => request.method === 'POST' && request.url.endsWith(':acknowledge'));
