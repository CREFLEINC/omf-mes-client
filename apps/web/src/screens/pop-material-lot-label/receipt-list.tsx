import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import type { LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import { formatReceiptDate, type TargetRow } from './types';

const t = messages.popMaterialLotLabel.receipts;

export interface ReceiptListProps {
  rows: TargetRow[];
  supplierLookup: LookupSource;
  itemLookup: LookupSource;
  uomLookup: LookupSource;
  selectedId: number | null;
  /**
   * ⛔ **실행 중에는 줄을 바꾸지 못한다.** 바꾸면 끝난 뒤 결과가 「고른 줄의 것」이 아니게 되어
   * 알림도 차단도 서지 않는다 — 작업자는 아무 일도 없었다고 읽고, 그 실패는 다음 실행이 결과를
   * 덮으며 사라진다.
   */
  isLocked: boolean;
  onToggleSelect: (inboundReceiptLineId: number) => void;
  /** 결과가 없을 때 그 자리에 보일 안내. 「없음」과 「이 쪽에 없음」이 갈린다. */
  empty: string;
}

/**
 * 입하 목록 — **스펙 §3 도면의 카드형 목록이다.**
 *
 * ```
 * ┌──────────────────────────┐
 * │ IB-…002  ABC-123  500EA │   ← 첫 줄: 입하번호 · 품목 · 수량
 * │ (주)…    08-04           │   ← 둘째 줄: 공급사 · 입하일
 * ├──────────────────────────┤   ← 줄과 줄은 구분선으로 가른다
 * ```
 *
 * ⛔ **열 머리글 줄을 두지 않는다.** 스펙 §3 도면에 「입하·품목·수량」 머리줄이 없다(사용자
 * 지적 2026-09-10). 앞선 판이 이 화면을 표로 세우면서 머리줄을 얹었는데, 그 줄은 세로 여유가
 * 119px 뿐인 화면에서(§3) 한 줄을 통째로 먹으면서 **값과 같은 것을 두 번 말한다** — 입하번호와
 * 품목은 생김새로 이미 갈린다.
 *
 * ⛔ **선택 칸을 따로 두지 않는다.** §5-1 은 「입하 라인 선택」을 액션으로만 적는다. **줄 전체가
 * 누르는 자리**이며, 그 줄이 곧 버튼이라 손·키보드·읽어 주는 도구가 모두 같은 하나를 본다.
 *
 * ⛔ **정렬을 켜지 않는다.** 서버가 쪽 단위로 잘라 주므로 화면이 정렬하면 **보이는 쪽 안에서만**
 * 정렬돼 「전체가 정렬된 것」으로 오해된다.
 */
export const ReceiptList = ({
  rows,
  supplierLookup,
  itemLookup,
  uomLookup,
  selectedId,
  isLocked,
  onToggleSelect,
  empty,
}: ReceiptListProps) => {
  if (rows.length === 0) return <p className="field-note pop-empty-note">{empty}</p>;

  return (
    <ul className="pop-material-lot-lines" aria-label={t.caption}>
      {rows.map((row) => {
        const isSelected = row.inboundReceiptLineId === selectedId;
        const itemName = lookupDisplayLabel(itemLookup, row.itemId);

        return (
          <li key={row.inboundReceiptLineId}>
            <button
              type="button"
              className={`pop-material-lot-line ${popTouchClass('normal')}${
                isSelected ? ' pop-material-lot-line-on' : ''
              }`}
              aria-pressed={isSelected}
              disabled={isLocked}
              aria-label={
                isSelected
                  ? t.deselectRow(row.inboundReceiptNo, itemName)
                  : t.selectRow(row.inboundReceiptNo, itemName)
              }
              onClick={() => {
                onToggleSelect(row.inboundReceiptLineId);
              }}
            >
              <span className="pop-material-lot-line-receipt">{row.inboundReceiptNo}</span>
              <span className="pop-material-lot-line-item">{itemName}</span>
              {/*
               * ⚠ **수량은 첫 줄에서 접히지 않는다.** 「150」과 「EA」가 갈리면 두 값처럼 읽힌다
               * — 좁은 창에서 실제로 그렇게 나왔다(사용자 지적 2026-09-10).
               */}
              <span className="pop-material-lot-line-qty">
                {row.receivedQty} {lookupDisplayLabel(uomLookup, row.uomId)}
              </span>
              <span className="pop-material-lot-line-supplier">
                {lookupDisplayLabelWithInactive(supplierLookup, row.supplierId)}
              </span>
              {/*
               * ⭐ **날짜는 품목 아래다** — 스펙 §3 도면의 둘째 줄이 `(주)…    08-04` 이고
               *    `08-04` 가 첫 줄 `ABC-123` 자리에 맞춰 선다. 수량 아래에 두면 「이 수량이
               *    그날 것」처럼 읽혀 두 값이 한 덩어리로 묶인다(사용자 지적).
               */}
              <span className="pop-material-lot-line-date">
                {formatReceiptDate(row.receiptDatetime)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
