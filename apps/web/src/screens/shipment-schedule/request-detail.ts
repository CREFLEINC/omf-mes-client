import type { components } from '@omf-mes/api-client';

/**
 * 피처 010 — 지시서 상세 창 · 인쇄가 함께 쓰는 값(시안 W0402-After · Print-Preview).
 *
 * ⛔ 수량·판정·막는 이유는 서버 값 그대로다(L-2). 화면은 모양만 바꾼다.
 */

export type ShipmentRequestDetail = components['schemas']['ShipmentRequest'];
type RequestLine = components['schemas']['ShipmentRequestLine'];
type RequestLot = components['schemas']['ShipmentRequestLot'];
type Blocker = components['schemas']['ShipmentCompletionBlocker'];

export interface ReplacementRow {
  lineNo: number;
  itemId: number;
  lotNo: string;
  qty: number;
  replacedAt: string;
  workerName: string | null;
  workerNo: string | null;
  resultNo: string;
  resultRound: number;
  judgment: string | null;
  resultAt: string;
  nonconformanceNo: string | null;
  /** 같은 라인에서 교체 시각 뒤에 처음 피킹한 LOT — 없으면 `null`(시안 「다음 피킹 LOT」). */
  nextLotNo: string | null;
}

/** 같은 라인의 LOT 중 `after` 뒤에 가장 먼저 피킹한 것. */
const nextPickedAfter = (lots: readonly RequestLot[], after: string): string | null => {
  const at = Date.parse(after);
  const later = lots
    .filter((lot) => Date.parse(lot.pickedAt) > at)
    .sort((a, b) => Date.parse(a.pickedAt) - Date.parse(b.pickedAt));
  return later[0]?.lotNo ?? null;
};

export const linesOf = (detail: ShipmentRequestDetail): RequestLine[] => detail.lines ?? [];

/** 인쇄에 찍는 LOT — 인쇄 시점의 피킹 LOT(교체된 LOT 제외). */
export const printableLots = (
  detail: ShipmentRequestDetail,
): { line: RequestLine; lot: RequestLot }[] =>
  linesOf(detail).flatMap((line) =>
    line.lots.filter((lot) => lot.statusCode !== 'REPLACED').map((lot) => ({ line, lot })),
  );

/** 지시서 전체의 교체 이력 — 시간순. */
export const replacementsOf = (detail: ShipmentRequestDetail): ReplacementRow[] =>
  linesOf(detail)
    .flatMap((line) =>
      line.lots.flatMap((lot) =>
        lot.replacement === null
          ? []
          : [
              {
                lineNo: line.lineNo,
                itemId: line.itemId,
                lotNo: lot.lotNo,
                qty: lot.pickedQty,
                replacedAt: lot.replacement.replacedAt,
                workerName: lot.replacement.worker?.workerName ?? null,
                workerNo: lot.replacement.worker?.workerNo ?? null,
                resultNo: lot.replacement.resultNo,
                resultRound: lot.replacement.resultRound,
                judgment: lot.replacement.judgment,
                resultAt: lot.replacement.resultAt,
                nonconformanceNo: lot.replacement.nonconformanceNo,
                nextLotNo: nextPickedAfter(line.lots, lot.replacement.replacedAt),
              },
            ],
      ),
    )
    .sort((a, b) => a.replacedAt.localeCompare(b.replacedAt));

/** 막는 이유 하나를 가리키는 값 — 라인 번호 또는 LOT 번호. */
export const blockerTarget = (blocker: Blocker): string =>
  blocker.lotNo ?? (blocker.lineNo === undefined ? '' : String(blocker.lineNo));

/** 피킹 창고마다 LOT 수 · 수량(정보 — 지시서는 창고를 정하지 않는다). */
export const warehouseSummary = (
  detail: ShipmentRequestDetail,
): { warehouseName: string; lotCount: number; qty: number }[] => {
  const byName = new Map<string, { lots: Set<number>; qty: number }>();

  for (const { lot } of printableLots(detail)) {
    for (const portion of lot.portions) {
      const entry = byName.get(portion.warehouseName) ?? { lots: new Set<number>(), qty: 0 };
      entry.lots.add(lot.lotId);
      entry.qty += portion.qty;
      byName.set(portion.warehouseName, entry);
    }
  }

  return [...byName.entries()].map(([warehouseName, entry]) => ({
    warehouseName,
    lotCount: entry.lots.size,
    qty: entry.qty,
  }));
};

/** 적치 대기 자리(위치 시스템 역할). */
export const STAGING_ROLE = 'PUTAWAY_STAGING';

/** 지시서 라인이 모두 같은 단위면 그 코드, 섞였거나 없으면 빈 글 — 피킹 창고 합계에 붙인다. */
export const uomOfDetail = (detail: ShipmentRequestDetail): string => {
  const codes = [
    ...new Set(
      linesOf(detail)
        .map((line) => line.uomCode)
        .filter((code) => code !== ''),
    ),
  ];
  return codes.length === 1 ? (codes[0] ?? '') : '';
};

/** 창고·위치별 몫 한 줄 — 「창고 위치 수량」. 위치가 없으면 창고만. 적치 대기 자리면 끝에 「(적치 대기)」. */
export const portionText = (portion: RequestLot['portions'][number], stagingLabel = ''): string => {
  const place =
    portion.locationCode === null
      ? `${portion.warehouseName} ${String(portion.qty)}`
      : `${portion.warehouseName} ${portion.locationCode} ${String(portion.qty)}`;
  return portion.locationSystemRoleCode === STAGING_ROLE && stagingLabel !== ''
    ? `${place} (${stagingLabel})`
    : place;
};

export type SalesOrderRemaining =
  | { kind: 'none' }
  | { kind: 'cancelled' }
  | { kind: 'remaining'; remaining: number; ordered: number }
  | { kind: 'over'; over: number; ordered: number; shipped: number };

/**
 * 수주 잔량(시안 W0402-After ⑧) — 수주 − 출하. 출하가 수주를 넘으면 음수 대신 「0 + 초과 n」(D-16 · ERP 가
 * 초과 출고를 받는다). 수주 없는 라인은 none, ERP 에서 취소된 수주 라인은 cancelled.
 */
export const salesOrderRemainingOf = (line: RequestLine): SalesOrderRemaining => {
  const order = line.salesOrderLine;
  if (order === null) return { kind: 'none' };
  if (order.cancelled) return { kind: 'cancelled' };
  const remaining = order.orderedQty - order.shippedQty;
  return remaining < 0
    ? { kind: 'over', over: -remaining, ordered: order.orderedQty, shipped: order.shippedQty }
    : { kind: 'remaining', remaining, ordered: order.orderedQty };
};
