import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';

/**
 * 이 화면의 감지기와 라우트 감지기가 함께 쓰는 목 응답.
 *
 * ⚠ 값은 전부 **지어낸 합성값**이다 — 실 사번·품목코드·LOT 번호를 쓰지 않는다(공개 저장소 경계).
 * 코드 문자열도 값 목록이 미확정이라 자리표시(`CODE-*`)로 둔다.
 */
export interface DispositionStubOptions {
  /** 이미 판정된 수량. 남은 수량 계산을 감지기가 짚을 때 쓴다. */
  decidedQty?: number;
  /** 목록 조회를 실패시킨다. */
  listStatus?: number;
}

let sent: Request[] = [];

/** 감지기가 「무엇이 나갔나」를 볼 수 있게 모아 둔다. */
export const requestsSent = (): Request[] => sent;
export const requestedPaths = (): string[] =>
  sent.map((request) => {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  });

export const lotFixture = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  nonconformanceLotId: 9001,
  lotId: 8001,
  lotNo: 'LOT-TEST-0088',
  affectedQty: 320,
  uomId: 7001,
  qualityStatusBeforeCode: 'CODE-D',
  qualityStatusAfterCode: 'CODE-E',
  ...overrides,
});

const nonconformanceFixture = (lots: unknown[]): Record<string, unknown> => ({
  nonconformanceId: 41,
  nonconformanceNo: 'NC-TEST-0041',
  itemId: 5001,
  severityCode: 'CODE-B',
  description: '도장 표면 박리',
  statusCode: 'CODE-C',
  openedAt: '2026-08-12T09:30:00+09:00',
  lots,
});

// prettier-ignore
const itemFixture = {
  itemId: 5001, itemCode: 'SYNTH-ITEM-1', itemName: '합성 품목', itemTypeCode: 'CODE-F',
  baseUomId: 7001, lotControlTypeCode: 'CODE-G', serialControlTypeCode: 'CODE-H',
  inspectionRequired: true, fifoPolicyCode: 'CODE-I', negativeStockAllowed: false, isActive: true,
};

const uomFixture = { uomId: 7001, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true };

// prettier-ignore
const decisionFixture = (decisionQty: number): Record<string, unknown> => ({
  dispositionDecisionId: 3001, nonconformanceId: 41, dispositionTypeCode: 'CODE-A', decisionQty,
  uomId: 7001, reason: '표면만 손상돼 재작업으로 회복된다', decidedBy: 4001,
  decidedAt: '2026-08-12T14:20:00+09:00',
});

const listBody = (items: unknown[], total = items.length): Record<string, unknown> => ({
  items,
  page: { page: 1, size: 50, total },
});

const pathOf = (request: Request): string => new URL(request.url).pathname;

export const dispositionStub = (options: DispositionStubOptions = {}): StubFetch => {
  sent = [];
  const lots = [lotFixture()];
  const decisions = options.decidedQty === undefined ? [] : [decisionFixture(options.decidedQty)];

  const inner = createStubFetch([
    {
      match: (request) => pathOf(request) === '/quality/nonconformances',
      respond: () =>
        options.listStatus === undefined
          ? jsonResponse(listBody([nonconformanceFixture(lots)]))
          : jsonResponse({ message: '' }, { status: options.listStatus }),
    },
    {
      match: (request) =>
        pathOf(request) === '/quality/nonconformances/41/disposition-decisions' &&
        request.method === 'GET',
      respond: () => jsonResponse(listBody(decisions)),
    },
    {
      match: (request) => pathOf(request) === '/quality/nonconformances/41',
      respond: () => jsonResponse(nonconformanceFixture(lots), { headers: { ETag: 'W/"7"' } }),
    },
    {
      match: (request) => pathOf(request) === '/mdm/items',
      respond: () => jsonResponse(listBody([itemFixture])),
    },
    {
      match: (request) => pathOf(request) === '/mdm/uoms',
      respond: () => jsonResponse(listBody([uomFixture])),
    },
  ]);

  return async (request: Request): Promise<Response> => {
    sent.push(request.clone());
    return inner(request);
  };
};
