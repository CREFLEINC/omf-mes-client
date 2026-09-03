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
  /** 상세 조회를 실패시킨다. */
  detailStatus?: number;
  /** 저장 응답을 갈아 끼운다. */
  saveResponse?: () => Response;
  /** 저장이 «응답 없이» 실패한다 — 적용 여부를 모르는 상태를 만든다. */
  saveThrows?: boolean;
  /** 목록에 부적합을 둘 둔다 — 선택을 옮기는 감지기가 쓴다. */
  secondNonconformance?: boolean;
  /** 대상 LOT을 갈아 끼운다(단위 혼재 등). */
  lots?: unknown[];
}

let sent: Request[] = [];

/** 감지기가 「무엇이 나갔나」를 볼 수 있게 모아 둔다. */
export const requestsSent = (): Request[] => sent;
export const requestedPaths = (): string[] =>
  sent.map((request) => {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** 대상 LOT 수량 합. 부적합 픽스처와 판정 이력 summary가 같은 값을 쓰도록 한곳에 모은다. */
const affectedQtyTotalOf = (lots: unknown[]): number =>
  lots.reduce<number>(
    (sum, lot) =>
      sum + (isRecord(lot) && typeof lot.affectedQty === 'number' ? lot.affectedQty : 0),
    0,
  );

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

const nonconformanceFixture = (
  lots: unknown[],
  nonconformanceId = 41,
): Record<string, unknown> => ({
  nonconformanceId,
  nonconformanceNo: `NC-TEST-00${String(nonconformanceId)}`,
  itemId: 5001,
  severityCode: 'CODE-B',
  description: '도장 표면 박리',
  statusCode: 'CODE-C',
  openedAt: '2026-08-12T09:30:00+09:00',
  affectedQtyTotal: affectedQtyTotalOf(lots),
  uomId: 7001,
  dispositionProgressCode: 'NOT_STARTED',
  lots,
});

/** 저장 409 응답 몸통. 코드별 필드까지 채운 완성형이라 테스트는 필요한 것만 덮어쓴다. */
export const conflictResponseFixture = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  code: 'INVALID_STATE',
  message: '합성 충돌 문구',
  ...overrides,
});

// prettier-ignore
const itemFixture = {
  itemId: 5001, itemCode: 'SYNTH-ITEM-1', itemName: '합성 품목', itemTypeCode: 'CODE-F',
  baseUomId: 7001, lotControlled: true, serialControlTypeCode: 'CODE-H',
  inspectionRequired: true, fifoPolicyCode: 'CODE-I', negativeStockAllowed: false, isActive: true,
};

const uomFixture = { uomId: 7001, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true };

// prettier-ignore
const decisionFixture = (decisionQty: number): Record<string, unknown> => ({
  dispositionDecisionId: 3001, nonconformanceId: 41, dispositionTypeCode: 'REWORK', decisionQty,
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
  const lots = options.lots ?? [lotFixture()];
  const decisions = options.decidedQty === undefined ? [] : [decisionFixture(options.decidedQty)];
  const decidedQtyTotal = options.decidedQty ?? 0;
  const affectedQtyTotal = affectedQtyTotalOf(lots);
  /** W-03-10 ② 「남은 수량」 구획 — 서버가 이미 뺀 값이라 화면은 그대로 읽기만 한다. */
  const summary = {
    affectedQtyTotal,
    decidedQtyTotal,
    remainingQty: affectedQtyTotal - decidedQtyTotal,
    uomId: 7001,
  };

  const inner = createStubFetch([
    {
      match: (request) => pathOf(request) === '/quality/nonconformances',
      respond: () =>
        options.listStatus === undefined
          ? jsonResponse(
              listBody(
                options.secondNonconformance === true
                  ? [nonconformanceFixture(lots), nonconformanceFixture(lots, 42)]
                  : [nonconformanceFixture(lots)],
              ),
            )
          : jsonResponse({ message: '' }, { status: options.listStatus }),
    },
    {
      match: (request) =>
        /^\/quality\/nonconformances\/\d+\/disposition-decisions$/.test(pathOf(request)) &&
        request.method === 'GET',
      respond: () => jsonResponse({ ...listBody(decisions), summary }),
    },
    {
      match: (request) =>
        /^\/quality\/nonconformances\/\d+\/disposition-decisions$/.test(pathOf(request)) &&
        request.method === 'POST',
      respond: () => {
        if (options.saveThrows === true) throw new Error('연결이 끊겼습니다');
        return options.saveResponse?.() ?? jsonResponse({}, { status: 201 });
      },
    },
    {
      match: (request) => /^\/quality\/nonconformances\/\d+$/.test(pathOf(request)),
      respond: (request) =>
        options.detailStatus === undefined
          ? jsonResponse(nonconformanceFixture(lots, Number(pathOf(request).split('/').pop())), {
              headers: { ETag: `W/"${pathOf(request).split('/').pop() ?? '7'}"` },
            })
          : jsonResponse({ message: '권한이 없습니다' }, { status: options.detailStatus }),
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
