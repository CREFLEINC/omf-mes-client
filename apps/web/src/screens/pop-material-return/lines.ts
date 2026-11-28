import type { components } from '@omf-mes/api-client';

import { formatBaseQty, isCountUom, parseQtyInput } from '../../patterns/package-qty';
import { plantToday } from '../../patterns/plant-time';

/**
 * P-01-03 반납 입고의 줄 목록 — 화면에서 떼어 시험한다(피처 019 · 시안 ②).
 *
 * ⭐ 사람이 주는 것은 LOT 과 수량뿐이다(FR-001). 어느 W/O 에 붙는지는 서버가 정하고 화면은 그 값을 들고만 있다가
 *    「W/O 로 찾기」로 담은 줄에만 실어 보낸다(FR-016). 귀속 W/O 는 어디에도 그리지 않는다(FR-013).
 * ⭐ 수량 처음 값은 빈칸이다(시안 확정 「확인 2」) — 반납 가능 양을 채워 두면 「다 돌려줬다」로 잘못 보낼 수 있다.
 */

export type MaterialReturnLotLookup = components['schemas']['MaterialReturnLotLookup'];
export type MaterialReturnReceive = components['schemas']['MaterialReturnReceive'];

export interface ReturnLine {
  lotId: number;
  lotNo: string;
  itemCode: string;
  itemName: string;
  uomCode: string;
  returnableQty: number;
  /** 그 LOT 을 출고한 생산창고 — 위치 없이 받으면 이 창고 적치 대기로 들어간다. */
  issueWarehouse: { warehouseId: number; warehouseName: string };
  /** 「W/O 로 찾기」로 담은 줄만 — 고른 W/O. LOT 스캔 줄은 `null`(서버가 자동 귀속). */
  pickedWorkOrderId: number | null;
  /** 사람이 적은 수량(키패드 글자 그대로). 빈칸에서 시작한다. */
  qtyText: string;
}

export const lineOf = (
  lookup: MaterialReturnLotLookup,
  pickedWorkOrderId: number | null = null,
  qtyText = '',
): ReturnLine => ({
  lotId: lookup.lotId,
  lotNo: lookup.lotNo,
  itemCode: lookup.item.itemCode,
  itemName: lookup.item.itemName,
  uomCode: lookup.uom.uomCode,
  returnableQty: lookup.returnableQty,
  issueWarehouse: {
    warehouseId: lookup.issueWarehouse.warehouseId,
    warehouseName: lookup.issueWarehouse.warehouseName,
  },
  pickedWorkOrderId,
  qtyText,
});

/**
 * 스캔·담기 — 같은 LOT 이 이미 있으면 새 줄을 만들지 않고 그 줄을 고른다(화면 설계 「같은 LOT 두 번 스캔」).
 * 「W/O 로 찾기」로 다시 담으면 그 줄에 고른 W/O · 수량을 얹는다. 새 줄은 맨 아래에 붙고 고른 줄이 된다.
 */
export const addLine = (
  lines: readonly ReturnLine[],
  line: ReturnLine,
): { lines: ReturnLine[]; selected: number } => {
  const index = lines.findIndex((each) => each.lotId === line.lotId);

  if (index < 0) return { lines: [...lines, line], selected: lines.length };

  const current = lines[index] as ReturnLine;
  const merged: ReturnLine =
    line.pickedWorkOrderId === null
      ? { ...current, returnableQty: line.returnableQty }
      : {
          ...current,
          returnableQty: line.returnableQty,
          pickedWorkOrderId: line.pickedWorkOrderId,
          qtyText: line.qtyText === '' ? current.qtyText : line.qtyText,
        };

  return { lines: lines.map((each, at) => (at === index ? merged : each)), selected: index };
};

export const removeLine = (
  lines: readonly ReturnLine[],
  index: number,
  selected: number | null,
): { lines: ReturnLine[]; selected: number | null } => {
  const next = lines.filter((_, at) => at !== index);

  if (next.length === 0) return { lines: next, selected: null };
  if (selected === null) return { lines: next, selected: null };
  if (selected === index) return { lines: next, selected: Math.min(index, next.length - 1) };

  return { lines: next, selected: selected > index ? selected - 1 : selected };
};

export type QtyProblem = 'range' | 'integer';

/**
 * 수량 판정 — 0 < 수량 ≤ 반납 가능, 정수 단위(EA)는 정수만. 비었으면 판정하지 않는다(null · 보내기만 꺼진다).
 * 서버가 다시 본다(400 RANGE) — 화면 판정은 누르기 전에 알리는 것뿐이다.
 */
export const qtyProblemOf = (line: ReturnLine): QtyProblem | null => {
  const qty = parseQtyInput(line.qtyText);
  if (qty === null) return null;
  if (isCountUom(line.uomCode) && !Number.isInteger(qty)) return 'integer';
  if (!(qty > 0) || qty > line.returnableQty) return 'range';

  return null;
};

/** 보낼 수 있는 줄인가 — 수량이 적혀 있고 판정이 깨끗하다. */
export const isReady = (line: ReturnLine): boolean =>
  parseQtyInput(line.qtyText) !== null && qtyProblemOf(line) === null;

export const canSubmit = (lines: readonly ReturnLine[]): boolean =>
  lines.length > 0 && lines.every(isReady);

/** 소수 꼬리를 걷는다(0.1 + 0.2). */
const roundQty = (qty: number): number => Math.round(qty * 1_000_000) / 1_000_000;

/** 「60 EA · 3.2 KG」 — 단위별 합. 수량이 비어 있는 줄은 세지 않는다. */
export const totalsOf = (lines: readonly ReturnLine[]): string => {
  const sums = new Map<string, number>();

  for (const line of lines) {
    const qty = parseQtyInput(line.qtyText);
    if (qty === null) continue;
    sums.set(line.uomCode, roundQty((sums.get(line.uomCode) ?? 0) + qty));
  }

  return [...sums.entries()].map(([uom, qty]) => formatBaseQty(qty, uom)).join(' · ');
};

/**
 * 보낼 본문. 업무일·발생 시각은 단말 값이다(공유계약 C-8 — 오프라인 대기분도 누른 순간의 값).
 * `workOrderId` 는 「W/O 로 찾기」 줄에만 싣는다 — LOT 스캔 줄은 서버가 정한다.
 */
export const toReceiveBody = (
  lines: readonly ReturnLine[],
  now: Date = new Date(),
): MaterialReturnReceive => ({
  businessDate: plantToday(now),
  occurredAt: now.toISOString(),
  lines: lines.map((line) => ({
    lotId: line.lotId,
    returnQty: parseQtyInput(line.qtyText) ?? 0,
    ...(line.pickedWorkOrderId === null ? {} : { workOrderId: line.pickedWorkOrderId }),
  })),
});

export type Destination =
  /** 이 단말 창고의 적치 대기 — 회색 칩 「적치 대기」. */
  | { kind: 'staging' }
  /** 다른 생산창고의 적치 대기 — 주황 칩 「다른 창고 · {창고}」. */
  | { kind: 'other'; warehouseName: string }
  /** 단말 창고를 모른다 — 창고 이름을 붙여 「적치 대기 · {창고}」. */
  | { kind: 'stagingOf'; warehouseName: string };

/** 받는 곳 칩 — 대개 이 창고 하나라서 다른 창고인 줄만 따로 표시한다(시안 ②). */
export const destinationOf = (
  line: Pick<ReturnLine, 'issueWarehouse'>,
  terminalWarehouseId: number | null,
): Destination => {
  if (terminalWarehouseId === null) {
    return { kind: 'stagingOf', warehouseName: line.issueWarehouse.warehouseName };
  }

  return line.issueWarehouse.warehouseId === terminalWarehouseId
    ? { kind: 'staging' }
    : { kind: 'other', warehouseName: line.issueWarehouse.warehouseName };
};

/** 서버 오류 항목의 칸(`lines[2].returnQty`)에서 줄 차례를 꺼낸다. 줄 칸이 아니면 null. */
export const lineIndexOfField = (field: string | undefined): number | null => {
  if (field === undefined) return null;
  const matched = /^lines\[(\d+)\]/u.exec(field);

  return matched === null ? null : Number(matched[1]);
};
