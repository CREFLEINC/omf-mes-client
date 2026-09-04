import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';
import type { DispositionCandidate, DispositionDecision, Nonconformance } from './types';

/**
 * 이 화면의 감지기가 쓰는 목 응답.
 *
 * ⚠ 값은 전부 **지어낸 합성값**이다 — 실 사번·품목코드·LOT 번호·거래처를 쓰지 않는다(공개 저장소 경계).
 */
export interface RequestStubOptions {
  /** 목록 조회를 실패시킨다. */
  listStatus?: number;
  /** 상세 조회를 실패시킨다. */
  detailStatus?: number;
  /** 등록 응답을 갈아 끼운다. */
  registerResponse?: () => Response;
  /** 의뢰 응답을 갈아 끼운다. */
  requestResponse?: () => Response;
  /** 등록이 «응답 없이» 실패한다 — 적용 여부를 모르는 상태를 만든다. */
  registerThrows?: boolean;
  /** 심각도 코드값 목록을 비운다 — G-2 갈래. */
  emptySeverity?: boolean;
  /** 후보 하나(반품·부적합 없음) 대신 셋을 낸다 — 배지 넷과 소스 전환을 잰다. */
  allCandidates?: boolean;
}

let sent: Request[] = [];

export const requestsSent = (): Request[] => sent;
export const requestedPaths = (): string[] =>
  sent.map((request) => {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  });

const pathOf = (request: Request): string => new URL(request.url).pathname;

const listBody = (items: unknown[], total = items.length): Record<string, unknown> => ({
  items,
  page: { page: 1, size: 50, total },
});

/** 반품 갈래 · 부적합 없음 — 등록부터 시작하는 기본 대상. */
export const returnCandidate = (
  overrides: Partial<DispositionCandidate> = {},
): DispositionCandidate => ({
  lotId: 8201,
  lotNo: 'LOT-TEST-0311',
  itemId: 2003,
  itemCode: 'SYN-FG-1',
  itemName: '합성 제품',
  quantity: 200,
  uomId: 7001,
  warehouseId: 1003,
  warehouseName: '합성 불량창고',
  sourceCode: 'RETURN',
  goodsReceiptId: 9601,
  receiptNo: 'RT-TEST-0044',
  receivedAt: '2026-09-01',
  partnerName: '합성 거래처',
  inspectionResultId: null,
  nonconformanceId: null,
  nonconformanceNo: null,
  nonconformanceStatusCode: null,
  ...overrides,
});

/** 제품(OQC) 갈래 · 의뢰 전 — 부적합은 있고 의뢰만 남은 대상. */
export const productCandidate = (
  overrides: Partial<DispositionCandidate> = {},
): DispositionCandidate => ({
  lotId: 8202,
  lotNo: 'LOT-TEST-0305',
  itemId: 2003,
  itemCode: 'SYN-FG-1',
  itemName: '합성 제품',
  quantity: 300,
  uomId: 7001,
  warehouseId: 1003,
  warehouseName: '합성 불량창고',
  sourceCode: 'PRODUCT',
  goodsReceiptId: null,
  receiptNo: null,
  receivedAt: '2026-08-30',
  partnerName: null,
  inspectionResultId: 5301,
  nonconformanceId: 7001,
  nonconformanceNo: 'NC-TEST-0001',
  nonconformanceStatusCode: 'NOT_REQUESTED',
  ...overrides,
});

export const nonconformanceFixture = (overrides: Partial<Nonconformance> = {}): Nonconformance => ({
  nonconformanceId: 7001,
  nonconformanceNo: 'NC-TEST-0001',
  itemId: 2003,
  inspectionResultId: 5301,
  sourceCode: 'PRODUCT',
  severityCode: 'MAJOR',
  description: '외관 스크래치 · 상단 모서리 · 300개 중 60개 육안 확인',
  statusCode: 'NOT_REQUESTED',
  openedAt: '2026-08-30T11:00:00+09:00',
  affectedQtyTotal: 300,
  uomId: 7001,
  dispositionProgressCode: 'NOT_STARTED',
  lots: [
    {
      nonconformanceLotId: 7101,
      lotId: 8202,
      lotNo: 'LOT-TEST-0305',
      affectedQty: 300,
      uomId: 7001,
      qualityStatusBeforeCode: 'NORMAL',
      qualityStatusAfterCode: 'DEFECTIVE',
    },
  ],
  versionNo: 3,
  ...overrides,
});

export const decisionFixture = (
  overrides: Partial<DispositionDecision> = {},
): DispositionDecision => ({
  dispositionDecisionId: 7201,
  nonconformanceId: 7001,
  dispositionTypeCode: 'REWORK',
  decisionQty: 240,
  uomId: 7001,
  reason: '표면 손상만 있어 재작업으로 회복된다',
  decidedBy: 4001,
  decidedAt: '2026-09-02T14:20:00+09:00',
  approvalRequestId: null,
  followUpStatusCode: 'NOT_STARTED',
  followUpQty: 0,
  ...overrides,
});

const severityValues = [
  {
    codeValueId: 1,
    codeGroupId: 10,
    code: 'CRITICAL',
    codeName: '중대',
    displayOrder: 1,
    isActive: true,
  },
  {
    codeValueId: 2,
    codeGroupId: 10,
    code: 'MAJOR',
    codeName: '중',
    displayOrder: 2,
    isActive: true,
  },
  {
    codeValueId: 3,
    codeGroupId: 10,
    code: 'MINOR',
    codeName: '경',
    displayOrder: 3,
    isActive: true,
  },
];

const uomFixture = { uomId: 7001, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true };
const warehouseFixture = {
  warehouseId: 1003,
  warehouseCode: 'SYN-WH-3',
  warehouseName: '합성 불량창고',
  plantId: 11,
  managementLevelCode: 'ZONE',
  isDefect: true,
  isActive: true,
};
const departmentFixture = {
  departmentId: 3101,
  departmentCode: 'SYN-QA',
  departmentName: '합성 품질팀',
  isActive: true,
};

/** 등록 뒤 상세가 서야 의뢰가 열린다 — 상태 저장소로 등록된 부적합을 기억한다. */
interface StubState {
  created: Nonconformance[];
  requested: Set<number>;
}

export const requestStub = (options: RequestStubOptions = {}): StubFetch => {
  sent = [];
  const state: StubState = { created: [], requested: new Set() };
  const candidates =
    options.allCandidates === true
      ? [
          returnCandidate(),
          productCandidate(),
          productCandidate({
            lotId: 8203,
            lotNo: 'LOT-TEST-0299',
            nonconformanceId: 7002,
            nonconformanceNo: 'NC-TEST-0002',
            nonconformanceStatusCode: 'DECIDED',
          }),
        ]
      : [returnCandidate()];

  const detailOf = (nonconformanceId: number): Nonconformance | undefined => {
    const created = state.created.find((each) => each.nonconformanceId === nonconformanceId);
    if (created !== undefined) return created;
    if (nonconformanceId === 7001) {
      return nonconformanceFixture({
        statusCode: state.requested.has(7001) ? 'PENDING_DECISION' : 'NOT_REQUESTED',
      });
    }
    if (nonconformanceId === 7002) {
      return nonconformanceFixture({
        nonconformanceId: 7002,
        nonconformanceNo: 'NC-TEST-0002',
        statusCode: 'DECIDED',
        dispositionProgressCode: 'PARTIAL',
      });
    }
    return undefined;
  };

  const inner = createStubFetch([
    {
      match: (request) => pathOf(request) === '/quality/disposition-candidates',
      respond: (request) => {
        if (options.listStatus !== undefined) {
          return jsonResponse({ message: '' }, { status: options.listStatus });
        }
        const params = new URL(request.url).searchParams;
        const rows = candidates
          .map((candidate) => {
            const created = state.created.find((each) => each.lots[0]?.lotId === candidate.lotId);
            return created === undefined
              ? candidate
              : {
                  ...candidate,
                  nonconformanceId: created.nonconformanceId,
                  nonconformanceNo: created.nonconformanceNo,
                  nonconformanceStatusCode: created.statusCode,
                };
          })
          .filter(
            (candidate) =>
              params.get('withoutNonconformanceOnly') !== 'true' ||
              candidate.nonconformanceId === null,
          )
          .filter(
            (candidate) =>
              params.get('sourceCode') === null ||
              candidate.sourceCode === params.get('sourceCode'),
          );
        return jsonResponse(listBody(rows));
      },
    },
    {
      match: (request) =>
        pathOf(request) === '/quality/nonconformances' && request.method === 'GET',
      respond: (request) => {
        const status = new URL(request.url).searchParams.get('statusCode');
        const rows = [nonconformanceFixture(), detailOf(7002)].filter(
          (each): each is Nonconformance =>
            each !== undefined && (status === null || each.statusCode === status),
        );
        return jsonResponse(listBody(rows));
      },
    },
    {
      match: (request) =>
        pathOf(request) === '/quality/nonconformances' && request.method === 'POST',
      respond: () => {
        if (options.registerThrows === true) throw new Error('연결이 끊겼습니다');
        if (options.registerResponse !== undefined) return options.registerResponse();
        const created = nonconformanceFixture({
          nonconformanceId: 7009,
          nonconformanceNo: 'NC-TEST-0009',
          sourceCode: 'RETURN',
          inspectionResultId: null,
          statusCode: 'NOT_REQUESTED',
          affectedQtyTotal: 200,
          lots: [
            {
              nonconformanceLotId: 7109,
              lotId: 8201,
              lotNo: 'LOT-TEST-0311',
              affectedQty: 200,
              uomId: 7001,
              qualityStatusBeforeCode: 'NORMAL',
              qualityStatusAfterCode: 'DEFECTIVE',
            },
          ],
          versionNo: 1,
        });
        state.created.push(created);
        return jsonResponse(created, { status: 201 });
      },
    },
    {
      match: (request) =>
        /^\/quality\/nonconformances\/\d+:request-disposition$/.test(pathOf(request)) &&
        request.method === 'POST',
      respond: (request) => {
        if (options.requestResponse !== undefined) return options.requestResponse();
        const id = Number(pathOf(request).split('/').pop()?.split(':')[0]);
        state.requested.add(id);
        const detail = detailOf(id);
        return jsonResponse(
          detail === undefined ? {} : { ...detail, statusCode: 'PENDING_DECISION' },
        );
      },
    },
    {
      match: (request) => /^\/quality\/nonconformances\/\d+$/.test(pathOf(request)),
      respond: (request) => {
        if (options.detailStatus !== undefined) {
          return jsonResponse({ message: '권한이 없습니다' }, { status: options.detailStatus });
        }
        const id = Number(pathOf(request).split('/').pop());
        const detail = detailOf(id);
        return detail === undefined
          ? jsonResponse({ message: '없는 부적합' }, { status: 404 })
          : jsonResponse(detail, { headers: { ETag: `W/"${String(detail.versionNo ?? 1)}"` } });
      },
    },
    {
      match: (request) => pathOf(request) === '/quality/disposition-decisions',
      respond: (request) => {
        const id = Number(new URL(request.url).searchParams.get('nonconformanceId'));
        const rows =
          id === 7002
            ? [
                decisionFixture({ nonconformanceId: 7002 }),
                decisionFixture({
                  dispositionDecisionId: 7202,
                  nonconformanceId: 7002,
                  dispositionTypeCode: 'SCRAP',
                  decisionQty: 60,
                  reason: '균열이 있어 회복할 수 없다',
                }),
              ]
            : [];
        return jsonResponse(listBody(rows));
      },
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: () => jsonResponse(listBody(options.emptySeverity === true ? [] : severityValues)),
    },
    {
      match: (request) => pathOf(request) === '/mdm/uoms',
      respond: () => jsonResponse(listBody([uomFixture])),
    },
    {
      match: (request) => pathOf(request) === '/mdm/warehouses',
      respond: () => jsonResponse(listBody([warehouseFixture])),
    },
    {
      match: (request) => pathOf(request) === '/mdm/departments',
      respond: () => jsonResponse(listBody([departmentFixture])),
    },
  ]);

  return async (request: Request): Promise<Response> => {
    sent.push(request.clone());
    return inner(request);
  };
};
