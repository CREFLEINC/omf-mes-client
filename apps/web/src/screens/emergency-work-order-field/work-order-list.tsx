import { messages } from '@omf-mes/i18n';
import type { RefObject } from 'react';

import { PuEmpty, PuNote, PuPager, PuSection, type PuFold } from '../../patterns/pop-uniform';
import { dateTimeText, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

export interface WorkOrderListProps {
  workOrders: WorkOrder[] | undefined;
  isAsked: boolean;
  isLoading: boolean;
  /** 서버가 준 전체 건수 · 지금 쪽 · 쪽 수. 모르면 `undefined`. */
  total: number | undefined;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  isError: boolean;
  selectedId: number | null;
  uomLabel: (uomId: number | undefined) => string;
  onSelect: (workOrder: WorkOrder | null) => void;
  /** 구획 높이에 들어가는 줄 수를 재는 칸 — 서버 쪽 크기가 이 값이다. */
  listRef: RefObject<HTMLDivElement | null>;
  fold: PuFold;
}

/**
 * 《긴급 작업지시 목록》 — 왼쪽 380 고르기 목록(POP 통일 시안 #295).
 *
 * ⭐ 항목마다 작업지시 · 수량 · 품목 · 발행이 다 보인다. 줄을 누르면 고르고, 고른 줄을 다시 누르면 푼다.
 * ⭐ 구획 높이에 들어가는 만큼 보이고 나머지는 아래 쪽 넘김(총 N건 ‹ 1 / 2 ›) — 구획 안 스크롤 없음.
 * ⛔ **빈 목록이 오류가 아니다** — 「없습니다」 빈 모양과 어디서 발행하는지를 함께 보인다.
 * ⛔ **「묻지 않았다」·「받는 중」을 「없다」로 그리지 않는다.**
 */
export const WorkOrderList = ({
  workOrders,
  isAsked,
  isLoading,
  total,
  page,
  pages,
  onPageChange,
  isError,
  selectedId,
  uomLabel,
  onSelect,
  listRef,
  fold,
}: WorkOrderListProps) => {
  const t = messages.emergencyWorkOrderField.list;
  const rows = workOrders ?? [];

  return (
    <PuSection title={t.title} fold={fold} split>
      <div ref={listRef} className="pu-list pu-fit ew-list" role="list" aria-label={t.title}>
        {isError && <PuNote tone="bad">{t.loadError}</PuNote>}
        {!isError && rows.length === 0 && isAsked && !isLoading && (
          <PuEmpty icon="list" title={t.empty} hint={t.emptyHint} />
        )}
        {!isError &&
          rows.map((row) => {
            const isSelected = row.workOrderId === selectedId;

            return (
              <div key={row.workOrderId} role="listitem">
                <button
                  type="button"
                  className={isSelected ? 'pu-item is-selected' : 'pu-item'}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? t.deselect : t.select} ${row.workOrderNo}`}
                  onClick={() => {
                    onSelect(isSelected ? null : row);
                  }}
                >
                  <span className="pu-item-top">
                    {/* ⛔ 「긴급」 표식을 달지 않는다 — 화면 이름이 이미 긴급 작업지시다(사용자 지시 2026-09-17). */}
                    <span className="no">{row.workOrderNo}</span>
                    <span className="ew-qty">{`${qtyText(row.orderQty)} ${uomLabel(row.uomId)}`}</span>
                  </span>
                  <span className="pu-item-sub">
                    <span>
                      {t.item} <b className="pu-mono">{itemText(row)}</b>
                    </span>
                    <span>
                      {t.releasedAt} <b>{dateTimeText(row.releasedAt)}</b>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
      </div>
      <PuPager
        label={t.pageNav}
        total={isError ? 0 : (total ?? null)}
        page={page}
        pages={pages}
        onPage={onPageChange}
      />
    </PuSection>
  );
};
