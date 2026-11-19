import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toPlantDateTimeParts } from './plant-time';
import { PuSeg } from './pop-uniform';
import './pop-list-order.css';

/**
 * POP 목록 정렬 [최신순 | 오래된순] — 모든 표·카드 목록에 같은 모양·같은 말로 둔다(사용자 지시 2026-11-19).
 * 분할 LOT 라벨(`screens/goods-issue-qr`)의 목록 아래 정렬 단추와 같은 모양이다.
 *
 * ⭐ 고정 순서(긴급 먼저 · 할 일 먼저 등)는 화면이 먼저 정하고, 이 정렬은 그 묶음 «안»에서만 건다.
 * ⭐ 시각이 없는 줄은 어느 쪽으로 정렬해도 맨 뒤다 — 모르는 시각을 앞뒤 어디에도 지어 넣지 않는다.
 */
export type ListOrder = 'newest' | 'oldest';

const t = messages.popUniform.order;

const instantOf = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const at = Date.parse(value);

  return Number.isNaN(at) ? null : at;
};

/** 시각으로 견주는 비교 함수. 같은 시각·시각 없음끼리는 0(원래 차례 유지 — `sort` 는 안정 정렬). */
export const byTime =
  <T,>(order: ListOrder, timeOf: (row: T) => string | null | undefined) =>
  (left: T, right: T): number => {
    const a = instantOf(timeOf(left));
    const b = instantOf(timeOf(right));
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;

    return order === 'newest' ? b - a : a - b;
  };

/** 새 배열로 시각 정렬한다. */
export const sortByTime = <T,>(
  rows: readonly T[],
  order: ListOrder,
  timeOf: (row: T) => string | null | undefined,
): T[] => [...rows].sort(byTime(order, timeOf));

/** 목록 칸의 일시 「11-19 13:35」(공장 시각). 못 읽으면 `null`. */
export const listDateTimeText = (value: string | null | undefined): string | null => {
  const parts = toPlantDateTimeParts(value);

  return parts === null ? null : `${parts.date.slice(5)} ${parts.time}`;
};

/** [최신순 | 오래된순] 단추. */
export const ListOrderSeg = ({
  value,
  onChange,
}: {
  value: ListOrder;
  onChange: (next: ListOrder) => void;
}) => (
  <PuSeg<ListOrder>
    label={t.label}
    value={value}
    options={(['newest', 'oldest'] as const).map((each) => ({ value: each, label: t[each] }))}
    onChange={onChange}
  />
);

/**
 * 목록 아래 줄 — 왼쪽 정렬 단추, 오른쪽 쪽 넘김(`children`). 좁은 목록 열(1024 의 320 열)에서는 쪽 넘김이
 * 다음 줄로 내려간다(한 쪽 건수는 남는 높이로 다시 잰다).
 */
export const ListOrderFoot = ({
  order,
  onOrder,
  showOrder = true,
  className,
  children,
}: {
  order: ListOrder;
  onOrder: (next: ListOrder) => void;
  /** 줄이 없으면 단추를 두지 않는다. */
  showOrder?: boolean;
  /** 화면 전용 모양을 붙일 이름(선택). */
  className?: string;
  children?: ReactNode;
}) => (
  <div className={className === undefined ? 'lo-foot' : `lo-foot ${className}`}>
    {showOrder && <ListOrderSeg value={order} onChange={onOrder} />}
    {children}
  </div>
);
