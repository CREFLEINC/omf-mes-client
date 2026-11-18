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
  judgment: string | null;
  resultAt: string;
  nonconformanceNo: string | null;
}

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
                judgment: lot.replacement.judgment,
                resultAt: lot.replacement.resultAt,
                nonconformanceNo: lot.replacement.nonconformanceNo,
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

/** 창고·위치별 몫 한 줄 — 「창고 위치 수량」. 위치가 없으면 창고만. */
export const portionText = (portion: RequestLot['portions'][number]): string =>
  portion.locationCode === null
    ? `${portion.warehouseName} ${String(portion.qty)}`
    : `${portion.warehouseName} ${portion.locationCode} ${String(portion.qty)}`;
