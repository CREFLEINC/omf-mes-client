import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';

/**
 * 이 화면의 감지기가 쓰는 목 응답.
 *
 * ⚠ 값은 전부 **지어낸 합성값**이다 — 실 사번·품목코드·LOT 번호를 쓰지 않는다(공개 저장소 경계).
 */

export interface ShipmentStub {
  shipmentId: number;
  shipmentNo: string;
  /** 실물 출하 시각. `null`이면 서버가 안 내린 상태다. */
  shippedAt: string | null;
  totalQty?: number;
}

export interface ConfirmStubOptions {
  shipments?: ShipmentStub[];
  /** 출하별 확정 응답. 없으면 성공. */
  confirmResponse?: (shipmentId: number) => Response | undefined;
  /** 상세 조회를 실패시킨다 — 잠금 토큰을 못 받는 갈래. */
  detailFails?: (shipmentId: number) => boolean;
  /** ETag 를 안 내린다 — 토큰이 없는 갈래. */
  omitEtag?: boolean;
  /** 목록 조회를 실패시킨다. */
  listStatus?: number;
  /** 취소 요청 응답을 갈아 끼운다. */
  cancelResponse?: () => Response;
}

let sent: Request[] = [];

export const requestsSent = (): Request[] => sent;

const DEFAULT_SHIPMENTS: ShipmentStub[] = [
  /* 3일 경과 — 일괄에서 빠지는 갈래. */
  { shipmentId: 455, shipmentNo: 'SYNTH-SH-0455', shippedAt: '2026-08-25T17:20:00+09:00' },
  /* 24시간 경과 — 일괄에 담긴다. */
  { shipmentId: 461, shipmentNo: 'SYNTH-SH-0461', shippedAt: '2026-08-31T09:14:00+09:00' },
  /* 막 나간 건. */
  { shipmentId: 470, shipmentNo: 'SYNTH-SH-0470', shippedAt: '2026-09-01T11:02:00+09:00' },
];

const shipmentBody = (stub: ShipmentStub) => ({
  shipmentId: stub.shipmentId,
  shipmentNo: stub.shipmentNo,
  shipmentRequestId: 3001,
  warehouseId: 2001,
  statusCode: 'CODE-UNCONFIRMED',
  expedited: false,
  ...(stub.shippedAt === null ? {} : { shippedAt: stub.shippedAt }),
  lines: [
    {
      shipmentLineId: stub.shipmentId * 10,
      lineNo: 1,
      shipmentRequestLineId: 4001,
      itemId: 5001,
      shippedQty: stub.totalQty ?? 100,
      uomId: 7001,
    },
  ],
});

export const confirmStub = (options: ConfirmStubOptions = {}): StubFetch => {
  sent = [];
  const shipments = options.shipments ?? DEFAULT_SHIPMENTS;

  const routes = [
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/logistics/shipments' && request.method === 'GET',
      respond: () =>
        options.listStatus === undefined
          ? jsonResponse({
              items: shipments.map(shipmentBody),
              page: { page: 1, size: 50, total: shipments.length },
            })
          : new Response('', { status: options.listStatus }),
    },
    {
      match: (request: Request) =>
        /^\/logistics\/shipments\/\d+$/.test(new URL(request.url).pathname) &&
        request.method === 'GET',
      respond: (request: Request) => {
        const id = Number(new URL(request.url).pathname.split('/').pop());
        if (options.detailFails?.(id) === true) return new Response('', { status: 500 });

        const stub = shipments.find((one) => one.shipmentId === id);
        return jsonResponse(shipmentBody(stub ?? DEFAULT_SHIPMENTS[0]!), {
          /* ⭐ 확정에 실을 잠금 토큰이 여기서만 온다 — 없으면 화면이 확정을 시도하지 않는다. */
          headers: options.omitEtag === true ? {} : { ETag: `"v${String(id)}"` },
        });
      },
    },
    {
      match: (request: Request) =>
        new URL(request.url).pathname.endsWith(':confirm') && request.method === 'POST',
      respond: (request: Request) => {
        const id = Number(new URL(request.url).pathname.split('/')[3]?.split(':')[0]);
        return options.confirmResponse?.(id) ?? jsonResponse({ shipmentId: id });
      },
    },
    {
      match: (request: Request) =>
        new URL(request.url).pathname.endsWith(':request-cancel') && request.method === 'POST',
      respond: () => options.cancelResponse?.() ?? jsonResponse({ approvalRequestId: 9001 }),
    },
  ];

  const stub = createStubFetch(routes);

  return async (request: Request) => {
    sent.push(request.clone());
    return stub(request);
  };
};

/** 나간 확정 요청들 — 무엇이 어떤 키로 나갔는지. */
export const confirmRequests = (): Request[] =>
  sent.filter((request) => request.method === 'POST' && request.url.endsWith(':confirm'));
