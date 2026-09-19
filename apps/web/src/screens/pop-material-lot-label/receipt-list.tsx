import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import type { LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import { FitText } from './fit-text';
import { nameSource, type ItemNameSource, type SupplierLookup } from './lookups';
import { formatReceiptDate, type TargetRow } from './types';

const t = messages.popMaterialLotLabel.receipts;

export interface ReceiptListProps {
  rows: TargetRow[];
  /** 공급사 — 마지막 쪽까지 받은 목록 하나다(`lookups` 머리말의 표). 목록에는 **이름만** 선다. */
  supplierLookup: SupplierLookup;
  /** 품목 이름 — **줄에 선 `itemId` 마다 원천 하나**다. 목록 첫 쪽으로 풀지 않는다(omf-all-around#27). */
  itemNames: ReadonlyMap<number, ItemNameSource>;
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
 * 입하 목록 — **값마다 이름이 붙은 카드형 목록이다.**
 *
 * ```
 * ┌────────────────────────────────────────────────┐
 * │ 입하일 09-19  공급사 ANKE        수량 10000 EA │  ← 첫 줄
 * │ 품목명 CONNECTOR TERMINAL … 품목코드 AD0303-…  │  ← 둘째 줄
 * ├────────────────────────────────────────────────┤  ← 줄과 줄은 구분선으로 가른다
 * ```
 *
 * ⛔ **입하번호를 목록에 두지 않는다**(사용자 지시 2026-09-19). 줄을 가리는 값은 품목이고,
 *    번호는 고른 뒤 채번 대상 카드에서 본다 — 목록에서는 가로만 먹었다.
 *    ⚠ **접근 이름에는 남긴다**(`selectRow`). 줄을 서로 가르는 값이 그것이라, 빼면 읽어 주는
 *    도구에서 같은 품목의 두 줄을 구분할 수 없다.
 *
 * ⭐ **품목명이 둘째 줄의 남는 폭을 전부 쓴다**(사용자 지시 2026-09-19). 앞선 판은 품목을 첫 줄
 *    가운데 칸에 두었는데, 1024×768 에서 그 칸이 **146px** 뿐이라 실제 품목(`코드 · 이름 【도번】`,
 *    17px 에서 376~489px)이 **네 줄로 접혔다.** 줄 하나가 148px 까지 부풀어 405px 짜리 목록에
 *    두세 줄밖에 서지 못했다. 전체 폭을 주면 한 줄에 서고(길면 `fit-font` 가 줄인다) 줄 높이가
 *    고정돼 **네 줄이 선다.**
 *
 * ⭐ **값마다 이름을 붙인다**(같은 지시). 무엇을 보고 있는지 화면이 말한다 — 읽어 주는 도구가
 *    쓰는 어휘(`selectRow`)와 같은 말이라, 보는 사람과 듣는 사람이 같은 것을 듣는다.
 *
 * ⛔ **열 머리글 줄을 되살리는 것이 아니다.** 머리줄은 세로 한 줄을 통째로 먹으면서 값과 같은
 *    말을 되풀이해 걷어 냈다(사용자 지적 2026-09-10). 이름은 값 «옆»에 붙어 세로를 쓰지 않는다.
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
  itemNames,
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
        /*
         * 못 푼 동안에는 이름·코드 두 칸이 같은 사유를 말한다 — 둘 다 한 번의 조회에서 오므로
         * 한쪽만 아는 상태가 없다(`lookups`).
         *
         * ⚠ 접근 이름에는 **붙인 한 줄**(`코드 · 이름`)을 그대로 쓴다 — 읽어 주는 도구에서 줄을
         *   가르는 값이라 화면보다 넓게 말한다.
         */
        const itemSource = nameSource(itemNames, row.itemId);
        const itemLabelText = lookupDisplayLabel(itemSource, row.itemId);
        const itemNameText = itemSource.item?.name ?? itemLabelText;
        const itemCodeText = itemSource.item?.code ?? itemLabelText;
        const qtyText = `${String(row.receivedQty)} ${lookupDisplayLabel(uomLookup, row.uomId)}`;

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
                  ? t.deselectRow(row.inboundReceiptNo, itemLabelText, qtyText)
                  : t.selectRow(row.inboundReceiptNo, itemLabelText, qtyText)
              }
              onClick={() => {
                onToggleSelect(row.inboundReceiptLineId);
              }}
            >
              {/*
               * ⭐ **첫 줄은 입하일·수량이다**(사용자 지시 2026-09-19). 어느 자재를 먼저 찍을지
               *    고를 때 보는 값이 그 둘이다.
               */}
              {/*
               * ⭐ **첫 줄에 입하일·공급사·수량을 모은다**(사용자 지시 2026-09-19). 무엇을 먼저
               *    찍을지 고를 때 함께 보는 값 셋이다.
               */}
              <span className="pop-material-lot-line-date">
                <span className="pop-material-lot-line-label">{t.fields.date}</span>
                {formatReceiptDate(row.receiptDatetime)}
              </span>
              {/* ⚠ 가운데 칸만 남는 폭을 갖는다 — 긴 거래처명이 들어오면 여기서 말줄임된다. */}
              <span className="pop-material-lot-line-supplier">
                <span className="pop-material-lot-line-label">{t.fields.supplier}</span>
                <span className="pop-material-lot-line-supplier-value">
                  {lookupDisplayLabelWithInactive(supplierLookup, row.supplierId)}
                </span>
              </span>
              {/*
               * ⚠ **수량은 접히지 않는다.** 「150」과 「EA」가 갈리면 두 값처럼 읽힌다 — 좁은
               *   창에서 실제로 그렇게 나왔다(사용자 지적 2026-09-10).
               */}
              <span className="pop-material-lot-line-qty">
                <span className="pop-material-lot-line-label">{t.fields.qty}</span>
                {qtyText}
              </span>
              {/*
               * ⭐ **품목명은 남는 폭을 쓰고, 넘치면 글자가 줄어 한 줄에 선다**(`FitText`).
               *    칸 이름은 값과 함께 줄어들지 않는다 — 이름이 작아지면 무엇을 보는지부터 흐려진다.
               */}
              <span className="pop-material-lot-line-item">
                <span className="pop-material-lot-line-label">{t.fields.itemName}</span>
                <FitText className="pop-material-lot-line-item-value" value={itemNameText} />
              </span>
              {/* 실물 라벨과 눈으로 대조하는 것은 코드다 — 길이가 고르고 짧아 줄어들 일이 없다. */}
              <span className="pop-material-lot-line-item-code">
                <span className="pop-material-lot-line-label">{t.fields.itemCode}</span>
                {itemCodeText}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
