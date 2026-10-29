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
  /** 입하가 끝난 자재 P/O 만 본다(사용자 지시 2026-10-22). 끝난 것은 서버에서 따로 받는다. */
  doneOnly: boolean;
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
  doneOnly: false,
};

/** 기본 기간의 반폭(일). 오늘 앞뒤로 이만큼 - 전체 기간을 매번 받으면 무겁다(사용자 지시 2026-10-22). */
export const DEFAULT_PERIOD_DAYS = 14;

const isoDate = (date: Date): string =>
  `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

/** 오늘에서 days 일 떨어진 날의 'YYYY-MM-DD'(단말 시간대). */
export const shiftDate = (today: Date, days: number): string => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};

/** 'YYYY-MM-DD' 에서 days 일 떨어진 날. */
export const shiftIso = (date: string, days: number): string =>
  shiftDate(new Date(`${date}T00:00:00`), days);

/** 처음 여는 2-1 의 조건 - 납기예정일 오늘 ±2주. */
export const initialLotlessFilter = (today: Date = new Date()): LotlessFilter => ({
  ...emptyLotlessFilter,
  period: [shiftDate(today, -DEFAULT_PERIOD_DAYS), shiftDate(today, DEFAULT_PERIOD_DAYS)],
});

/**
 * 접힌 「필터」 안의 켜진 조건 수 - 공급사명뿐이다. 기간 · 입하 완료는 늘 보여 세지 않는다.
 */
export const activeFilterCount = (filter: LotlessFilter): number =>
  Number(filter.supplierName.trim() !== '');

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
