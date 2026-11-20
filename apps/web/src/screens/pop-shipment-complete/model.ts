import type { ApiError, components } from '@omf-mes/api-client';

/**
 * P-04-07 출하 완료의 화면 규칙 — 서버 값(`ShipmentRequestCompletion`)을 화면이 읽는 모양으로 옮긴다.
 *
 * ⛔ 판정을 다시 하지 않는다. 막는 이유는 서버의 `blockers[]` 그대로이고, 화면은 묶어 보이기만 한다.
 * ⛔ ERP 송신 여부는 다루지 않는다 — 확인 값에 싣지도 않는다(사용자 결정 2026-11-18).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type Completion = components['schemas']['ShipmentRequestCompletion'];
export type CompletionResult = components['schemas']['ShipmentCompletionResult'];
export type CompletionBlocker = components['schemas']['ShipmentCompletionBlocker'];
export type ShipmentRequestRow = components['schemas']['ShipmentRequest'];
export type CompletionLot = Completion['lots'][number];
export type CompletionLine = Completion['lines'][number];
export type OqcLotStatus = NonNullable<CompletionLot['oqcLotStatus']>;

/** 막는 이유 중 화면이 «이유 카드»로 그리는 것. 이미 완료는 막힘이 아니라 끝난 일이라 따로 그린다. */
export type BlockerCode = Exclude<CompletionBlocker['code'], 'ALREADY_COMPLETED'>;

/** 카드 순서 — 시안(④)의 순서: 피킹 → 미검사 → 불합격 → 보류 → 수주 라인 취소. */
export const BLOCKER_ORDER: readonly BlockerCode[] = [
  'PICKING_SHORT',
  'NOT_INSPECTED',
  'REJECTED',
  'HELD',
  'SALES_ORDER_LINE_CANCELLED',
];

export interface BlockerGroup {
  code: BlockerCode;
  /** 이유가 짚는 라인 번호(피킹 부족·수주 라인 취소). */
  lineNos: number[];
  /** 이유가 짚는 LOT 번호(미검사·불합격·보류). */
  lotNos: string[];
}

/** 같은 이유를 한 카드로 묶는다. 서버가 준 순서와 무관하게 `BLOCKER_ORDER` 로 선다. */
export const groupBlockers = (blockers: readonly CompletionBlocker[]): BlockerGroup[] =>
  BLOCKER_ORDER.flatMap((code) => {
    const matched = blockers.filter((blocker) => blocker.code === code);
    if (matched.length === 0) return [];

    return [
      {
        code,
        lineNos: [
          ...new Set(matched.flatMap(({ lineNo }) => (lineNo === undefined ? [] : [lineNo]))),
        ],
        lotNos: [...new Set(matched.flatMap(({ lotNo }) => (lotNo === undefined ? [] : [lotNo])))],
      },
    ];
  });

/** 이미 POP 에서 완료한 지시서인가 — 확인 화면 대신 「이미 출하 완료」 안내를 연다. */
export const isAlreadyCompleted = (completion: Completion): boolean =>
  completion.completedShipment !== null ||
  completion.blockers.some((blocker) => blocker.code === 'ALREADY_COMPLETED');

/** [출하 완료]를 누를 수 있는 확인 값인가 — 막는 이유가 하나도 없다. */
export const isCompletable = (completion: Completion): boolean =>
  !isAlreadyCompleted(completion) && completion.blockers.length === 0;

/** 표에서 붉게 짚을 LOT 과 라인. */
export const blockedTargetsOf = (
  completion: Completion,
): { lotNos: Set<string>; lineNos: Set<number> } => ({
  lotNos: new Set(completion.blockers.flatMap(({ lotNo }) => (lotNo === undefined ? [] : [lotNo]))),
  lineNos: new Set(
    completion.blockers.flatMap(({ lineNo }) => (lineNo === undefined ? [] : [lineNo])),
  ),
});

/** 확인 값의 단위 — 라인이 모두 같은 단위면 그 코드, 섞였거나 없으면 빈 글(합계에 단위를 붙이지 않는다). */
export const uomOf = (completion: Completion): string => {
  const codes = [
    ...new Set(completion.lines.map((line) => line.uomCode).filter((code) => code !== '')),
  ];
  return codes.length === 1 ? (codes[0] ?? '') : '';
};

/** 수량에 단위를 붙인다 — 단위가 없으면 수량만. */
export const qtyWithUom = (qty: number, uom: string): string =>
  uom === '' ? formatQty(qty) : `${formatQty(qty)} ${uom}`;

/**
 * [직접 입력] 값 → 조회 코드(둘러보기 W-2). 손으로 친 지시서 번호(SR-…)는 앞머리 `SHPREQ:` 를 붙인다 — 서버
 * `:lookup` 은 코드만 받는다. 이미 코드면 그대로 둔다. 스캔 칸은 이 변환을 하지 않는다(스캔은 코드만).
 */
export const SHIPMENT_REQUEST_CODE_PREFIX = 'SHPREQ:';
export const directCodeOf = (raw: string): string => {
  const value = raw.trim();
  return value.toUpperCase().startsWith(SHIPMENT_REQUEST_CODE_PREFIX)
    ? `${SHIPMENT_REQUEST_CODE_PREFIX}${value.slice(SHIPMENT_REQUEST_CODE_PREFIX.length)}`
    : `${SHIPMENT_REQUEST_CODE_PREFIX}${value}`;
};

/** 409 `COMPLETION_BLOCKED` 가 실어 온 막는 이유 — 계약 코드만 남긴다. 없으면 null(확인 값을 다시 읽는다). */
export const blockersOfConflict = (error: ApiError): CompletionBlocker[] | null => {
  if (error.kind !== 'conflict' || error.blockers === undefined) return null;
  const known: readonly string[] = [...BLOCKER_ORDER, 'ALREADY_COMPLETED'];
  return error.blockers.flatMap((blocker) =>
    known.includes(blocker.code) ? [blocker as CompletionBlocker] : [],
  );
};

export interface CompletionTotals {
  /** 피킹 합계 = 이번에 나갈 수량. */
  qty: number;
  /** 초과 합계. 0 이면 「초과 포함」을 말하지 않는다. */
  over: number;
  lineCount: number;
  lotCount: number;
}

export const totalsOf = (completion: Completion): CompletionTotals => ({
  qty: completion.lines.reduce((sum, line) => sum + line.pickedQty, 0),
  over: completion.lines.reduce((sum, line) => sum + Math.max(line.overQty, 0), 0),
  lineCount: completion.lines.length,
  lotCount: completion.lots.length,
});

/**
 * 수량 글자. 소수는 셋째 자리까지(서버 `app.qty_t`). 천 단위 쉼표를 넣지 않는다 — 라벨·PDA 와 같은 글자로
 * 눈 대조한다.
 */
export const formatQty = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);

/** 초과 칸 — 넘었으면 「+10 EA」, 아니면 「0 EA」(단위는 라인 단위, 모르면 수량만). 음수(목표 미달)는 보이지 않는다(C-21). */
export const overText = (overQty: number, uom = ''): string =>
  overQty > 0 ? `+${qtyWithUom(overQty, uom)}` : qtyWithUom(0, uom);

/** OQC 판정 칩의 색. 미검사·보류는 할 일이 남은 상태라 경고, 불합격은 오류다. */
export type ChipTone = 'idle' | 'info' | 'success' | 'warning' | 'error';

export const OQC_TONE: Record<OqcLotStatus, ChipTone> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
  NOT_INSPECTED: 'warning',
  NOT_REQUIRED: 'idle',
  SKIPPED: 'idle',
};

/* ── 실패 가르기 ─────────────────────────────────────────────────────────── */

/** 서버가 준 사람 글(충돌 봉투 `message` · 오류 봉투 첫 줄). 없으면 null. */
export const serverMessageOf = (error: ApiError): string | null => {
  switch (error.kind) {
    case 'validation':
    case 'stateLocked':
      return error.errors.find((item) => item.message.trim() !== '')?.message ?? null;
    case 'conflict':
    case 'http':
      return error.message === undefined || error.message.trim() === '' ? null : error.message;
    case 'network':
      return null;
  }
};

/** 오류 봉투(`errors[]`)의 업무 코드들. 충돌·HTTP 오류는 `code` 한 칸이다. */
const codesOf = (error: ApiError): string[] => {
  switch (error.kind) {
    case 'validation':
    case 'stateLocked':
      return error.errors.map((item) => item.code);
    case 'conflict':
    case 'http':
      return error.code === undefined ? [] : [error.code];
    case 'network':
      return [];
  }
};

export type LookupFailure = 'notCode' | 'notFound' | 'failed';

/**
 * 지시서 코드 해석(`:lookup`)의 실패. 400 `NOT_SHIPMENT_REQUEST_CODE` 는 LOT 라벨 같은 다른 바코드,
 * 404 `SHIPMENT_REQUEST_NOT_FOUND` 는 형식은 맞지만 이 공장에 없는 지시서다. 그 밖은 연결·서버 문제다.
 */
export const lookupFailureOf = (error: ApiError): LookupFailure => {
  const codes = codesOf(error);
  if (codes.includes('NOT_SHIPMENT_REQUEST_CODE')) return 'notCode';
  if (codes.includes('SHIPMENT_REQUEST_NOT_FOUND')) return 'notFound';
  return 'failed';
};

export type CompleteFailure = 'alreadyCompleted' | 'blocked' | 'changed' | 'network' | 'other';

/**
 * [출하 완료]의 실패. 이미 완료(다른 POP 이 먼저 눌렀음)와 막힘·바뀜은 확인 값을 다시 읽어 그리고,
 * 연결이 끊긴 것은 같은 멱등 키로 다시 누르게 한다.
 */
export const completeFailureOf = (error: ApiError): CompleteFailure => {
  if (error.kind === 'network') return 'network';
  const codes = codesOf(error);
  if (codes.includes('ALREADY_COMPLETED')) return 'alreadyCompleted';
  if (codes.includes('COMPLETION_BLOCKED')) return 'blocked';
  if (codes.includes('VERSION_CONFLICT') || codes.includes('INVALID_STATE')) return 'changed';
  return 'other';
};

/* ── 찾기 ─────────────────────────────────────────────────────────────────── */

/**
 * 찾기가 보는 출하일 범위 — 오늘부터 이만큼 앞까지. 목록 조회는 시작일이 필수다(공유계약 L-3).
 * 지난 지시서가 늦게 끝나는 일이 있어 한 달을 본다.
 */
export const SEARCH_LOOKBACK_DAYS = 30;
export const SEARCH_PAGE_SIZE = 20;

/** `YYYY-MM-DD` 에서 날수를 뺀다(달력 날짜 계산 — 시간대를 타지 않게 UTC 로 센다). */
export const minusDays = (date: string, days: number): string => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day - days));

  return value.toISOString().slice(0, 10);
};

export interface SearchCriteria {
  q: string;
  readyOnly: boolean;
  page: number;
  /** 한 쪽 건수 — 창 목록 칸에 드는 만큼(`useFitCount`). 비우면 `SEARCH_PAGE_SIZE`. */
  size?: number;
}

/**
 * 목록 조회 조건. 「완료 대기만」이면 서버의 `completionReadyOnly`, 끄면 출하가 남은 지시서만
 * (`shippableRemainderOnly`) — 어느 쪽이든 출하 완료된 지시서는 나오지 않는다.
 */
export const searchQueryOf = (criteria: SearchCriteria, today: string) => ({
  shipDateFrom: minusDays(today, SEARCH_LOOKBACK_DAYS),
  ...(criteria.q.trim() === '' ? {} : { q: criteria.q.trim() }),
  ...(criteria.readyOnly ? { completionReadyOnly: true } : { shippableRemainderOnly: true }),
  sort: 'requestedShipDate' as const,
  page: criteria.page,
  size: criteria.size ?? SEARCH_PAGE_SIZE,
});

export interface SearchRowView {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  code: string;
  customerId: number;
  /** 고객 이름 — 지시서 행의 `customer`(POP 은 거래처 목록을 못 읽는다). 없으면 빈 글. */
  customerName: string;
  requestedShipDate: string;
  ready: boolean;
  /** 막는 이유 수(이유 코드별 합). */
  blockedCount: number;
  /** 라인을 짚지 않은 피킹 부족이 있다 — 서버가 «낼 피킹 LOT 이 없을 때» 내는 것(보이는 글만 가른다). */
  noPickedLot: boolean;
  blockerSummary: { code: BlockerCode; count: number }[];
  /** 첫 품목(코드·이름)과 그 밖의 품목 수 — 찾기 줄 「FG-A100 센서 모듈 A 외 1」. 라인이 없으면 null. */
  firstItem: { code: string; name: string } | null;
  moreItems: number;
  lineCount: number;
  lotCount: number;
  picked: number;
  target: number;
  /** 라인 단위가 하나면 그 단위, 섞이거나 없으면 빈 글(수량만 보인다). */
  uom: string;
}

export const toSearchRow = (row: ShipmentRequestRow): SearchRowView => {
  const lines = row.lines ?? [];
  const blockerSummary = BLOCKER_ORDER.flatMap((code) => {
    const count = row.blockerSummary[code] ?? 0;
    return count > 0 ? [{ code, count }] : [];
  });

  const items = [...new Map(lines.map((line) => [line.itemId, line])).values()];
  const first = items[0];

  return {
    shipmentRequestId: row.shipmentRequestId,
    shipmentRequestNo: row.shipmentRequestNo,
    code: row.code,
    firstItem: first === undefined ? null : { code: first.itemCode, name: first.itemName },
    moreItems: Math.max(items.length - 1, 0),
    customerId: row.customerId,
    customerName: row.customer?.partnerName ?? '',
    requestedShipDate: row.requestedShipDate,
    ready: row.completionBlockers.length === 0,
    blockedCount: blockerSummary.reduce((sum, entry) => sum + entry.count, 0),
    noPickedLot: row.completionBlockers.some(
      (blocker) => blocker.code === 'PICKING_SHORT' && blocker.lineNo === undefined,
    ),
    blockerSummary,
    lineCount: lines.length,
    lotCount: lines.reduce(
      (sum, line) => sum + line.lots.filter((lot) => lot.statusCode !== 'REPLACED').length,
      0,
    ),
    picked: lines.reduce((sum, line) => sum + line.pickedQty, 0),
    target: lines.reduce((sum, line) => sum + line.allocatedQty, 0),
    uom: (() => {
      const codes = [...new Set(lines.map((line) => line.uomCode ?? '').filter((c) => c !== ''))];
      return codes.length === 1 ? (codes[0] ?? '') : '';
    })(),
  };
};

/** 완료 대기 먼저, 그 안에서는 서버 순서(출하일·번호)를 지킨다. */
export const orderSearchRows = (rows: readonly SearchRowView[]): SearchRowView[] => [
  ...rows.filter((row) => row.ready),
  ...rows.filter((row) => !row.ready),
];

/**
 * 두 창고 이상에 몫이 있는 LOT 번호(살아 있는 피킹 LOT 순서) — 창고마다 LOT 수를 셀 때 양쪽에 모두 들어간다는 안내를 붙인다(시안 ③).
 */
export const splitLotsOf = (completion: Completion): string[] =>
  completion.lots
    .filter((lot) => new Set(lot.portions.map((portion) => portion.warehouseId)).size > 1)
    .map((lot) => lot.lotNo);
