import type { PurchaseOrder } from './receipt';

/** 기간을 무엇에 대는가. 라벨 없는 물건은 입고 예정일로 찾는 일이 많고, 예정일이 없는 발주도 있다. */
export type LotlessPeriodBasis = 'expected' | 'ordered';

/**
 * 라벨이 없을 때(LOT 번호 없음) 입고 예정 목록을 거르는 조건. 수량 단계에 다녀와도 남게 흐름이
 * 붙든다 - 다시 거르게 하면 같은 손질을 되풀이한다.
 */
export interface LotlessFilter {
  /** 공급사명의 일부. 비면 거르지 않는다. */
  supplierName: string;
  basis: LotlessPeriodBasis;
  /** 'YYYY-MM-DD' 두 끝(포함). 없으면 전체 기간이다. */
  period: [from: string, to: string] | null;
}

/** 라벨 미부착 일괄 입하의 결과. 품목 표 위에 남겨 무엇을 넣었는지 보인다. */
export interface LotlessDone {
  outcome: 'sent' | 'queued' | 'rejected' | 'failed';
  items: { name: string; qty: string }[];
}

export const emptyLotlessFilter: LotlessFilter = {
  supplierName: '',
  basis: 'expected',
  period: null,
};

/** 켜져 있는 조건 수. 접힌 「필터」 단추에 붙인다 - 접혀 있어도 걸러진 줄 안다. */
export const activeFilterCount = (filter: LotlessFilter): number =>
  Number(filter.supplierName.trim() !== '') + Number(filter.period !== null);

/** 기간을 대는 날짜. 예정일 기준인데 예정일이 없으면 없다 - 기간을 걸면 빠진다. */
export const basisDateOf = (order: PurchaseOrder, basis: LotlessPeriodBasis): string | null =>
  basis === 'expected' ? (order.expectedReceiptDate ?? null) : order.orderDate;

/**
 * 조건에 맞는 발주. 공급사명은 대소문자 없이 일부만 맞으면 된다. 날짜는 'YYYY-MM-DD' 라 글자 차례가
 * 곧 날짜 차례다.
 */
export const matchesLotlessFilter = (
  order: PurchaseOrder,
  supplierName: string,
  filter: LotlessFilter,
): boolean => {
  const needle = filter.supplierName.trim().toLocaleLowerCase();

  if (needle !== '' && !supplierName.toLocaleLowerCase().includes(needle)) {
    return false;
  }

  if (filter.period === null) {
    return true;
  }

  const date = basisDateOf(order, filter.basis);
  const [from, to] = filter.period;

  return date !== null && date >= from && date <= to;
};

/**
 * 표 칸의 짧은 날짜 「YY.MM.DD」(사용자 지시 2026-10-21). 360dp 에 네 칸이 한 줄로 들어야 해
 * 연도를 두 자리로 줄인다. 없으면 「—」.
 */
export const shortDate = (date: string | null | undefined): string => {
  if (date === null || date === undefined || date === '') {
    return '—';
  }

  return date.slice(2).replaceAll('-', '.');
};
