import { toPlantDateTimeParts } from '../../patterns/plant-time';
import type { TargetRow } from './types';

/**
 * 발행 대기 줄을 **공급사로 묶는다**(개편안 승인 2026-10-24 · omf-all-around#184).
 *
 * ⭐ **왜 공급사인가.** 현장은 한 공급사가 한 번 납품한 자재에 라벨을 한꺼번에 붙인다. 모든 공급사가
 *    섞인 목록에서 한 줄씩 고르던 옛 화면은 29줄이면 29번 고르고 29번 찍게 했고, 먼저 온 공급사가
 *    맨 뒤 쪽으로 밀렸다(로컬 실측 — 33줄 중 29줄이 한 공급사).
 *
 * ⛔ **입하 건 단계는 두지 않는다.** 서버가 2026-10-24 부터 일괄 입하도 품목마다 입하번호를 따로
 *    붙인다(장부 P-117) — 입하 건이 곧 줄이라 건으로 한 번 더 묶으면 한 줄짜리 묶음만 늘어난다.
 */
export interface SupplierGroup {
  supplierId: number;
  /** 입하 시각 순서(먼저 온 것이 위). */
  rows: TargetRow[];
  /** 이 공급사에서 가장 먼저 들어온 입하 시각 — 왼쪽 목록의 차례가 이것이다. */
  firstReceiptDatetime: string;
  /** 줄이 나뉘어 온 입하 건 수. 1이면 「09:37 입하」, 둘 이상이면 「11:51 입하부터」로 적는다. */
  receiptCount: number;
}

const instant = (value: string): number => {
  const time = Date.parse(value);

  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/**
 * 줄의 차례 — 입하 시각 → 입하번호 → 라인 번호.
 *
 * ⚠ 시각은 문자열이 아니라 순간으로 견준다. 서버는 `Z` 로 보내지만 오프셋이 섞여 오면 글자 순서가
 *   시각 순서와 어긋난다.
 */
export const compareArrival = (left: TargetRow, right: TargetRow): number =>
  instant(left.receiptDatetime) - instant(right.receiptDatetime) ||
  left.inboundReceiptNo.localeCompare(right.inboundReceiptNo) ||
  left.lineNo - right.lineNo;

/**
 * 공급사 묶음 — **먼저 입하된 공급사가 위**다. 같은 시각이면 공급사 번호 순(늘 같은 차례).
 *
 * ⭐ 먼저 온 자재부터 라벨을 붙이는 것이 현장 차례다. 옛 목록은 최근 입하가 위라 그 반대였다.
 */
export const groupBySupplier = (rows: readonly TargetRow[]): SupplierGroup[] => {
  const bySupplier = new Map<number, TargetRow[]>();

  for (const row of [...rows].sort(compareArrival)) {
    const list = bySupplier.get(row.supplierId);

    if (list === undefined) bySupplier.set(row.supplierId, [row]);
    else list.push(row);
  }

  return [...bySupplier.entries()]
    .map(([supplierId, list]) => ({
      supplierId,
      rows: list,
      firstReceiptDatetime: list[0]?.receiptDatetime ?? '',
      receiptCount: new Set(list.map((row) => row.inboundReceiptId)).size,
    }))
    .sort(
      (left, right) =>
        instant(left.firstReceiptDatetime) - instant(right.firstReceiptDatetime) ||
        left.supplierId - right.supplierId,
    );
};

/** 찾기 칸의 값을 견줄 모양으로 — 앞뒤 공백을 떼고 대소문자를 가리지 않는다. */
export const normalizeQuery = (query: string): string => query.trim().toLocaleLowerCase('en-US');

/**
 * 찾기 칸에 맞는 줄인가 — **품목코드나 입하번호의 일부**와 맞으면 맞는다. 칸이 비었으면 모두 맞는다.
 *
 * ⭐ 스캐너도 이 칸에 쏜다. 공급사 상자의 품목 바코드나 입하번호를 찍으면 그 줄만 남는다.
 * ⚠ 품목코드를 아직 풀지 못한 줄은 입하번호로만 견준다 — 풀리면 다시 그려지며 맞춰진다.
 */
export const matchesQuery = (
  row: TargetRow,
  normalized: string,
  itemCode: string | null,
): boolean => {
  if (normalized === '') return true;
  if (row.inboundReceiptNo.toLocaleLowerCase('en-US').includes(normalized)) return true;

  return itemCode !== null && itemCode.toLocaleLowerCase('en-US').includes(normalized);
};

export interface PageView<Item> {
  items: Item[];
  /** 1부터. 범위를 넘긴 값은 마지막 쪽으로 잡는다. */
  page: number;
  totalPages: number;
  /** 보이는 첫·끝 줄 번호(1부터). 비었으면 0. */
  from: number;
  to: number;
  total: number;
}

/**
 * 한 쪽 — **쪽 크기는 화면 높이가 정한다**(`row-fit`). 잘리는 줄은 다음 쪽으로 넘긴다
 * (사용자 지시 2026-09-19 — 목록에 스크롤을 두지 않는다).
 */
export const pageOf = <Item>(
  items: readonly Item[],
  page: number,
  size: number,
): PageView<Item> => {
  const safeSize = Math.max(1, size);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * safeSize;
  const slice = items.slice(start, start + safeSize);

  return {
    items: slice,
    page: current,
    totalPages,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
    total: items.length,
  };
};

export interface ReceiptWhen {
  /** `10-22` */
  day: string;
  /** `12:15` */
  time: string;
  /** `2026-10-22` — 라벨의 입하일. */
  date: string;
}

/**
 * 입하 시각을 **공장 시각**으로 — 서버는 UTC(`Z`)로 보내 앞 글자를 자르면 7시간 이르게 찍힌다
 * (omf-all-around#20). 읽지 못하면 `null` — 부르는 쪽이 칸을 비운다.
 */
export const receiptWhen = (value: string): ReceiptWhen | null => {
  const parts = toPlantDateTimeParts(value);

  return parts === null ? null : { day: parts.date.slice(5), time: parts.time, date: parts.date };
};

/**
 * 수량 — 천 단위 쉼표를 넣고 소수는 받은 만큼 둔다(`1,500` · `12.5`).
 *
 * ⭐ 51,000 과 5,100 이 한 표에 서는 자리다 — 쉼표가 없으면 자릿수를 세어야 한다.
 */
export const formatQty = (qty: number): string =>
  qty.toLocaleString('en-US', { maximumFractionDigits: 6 });
