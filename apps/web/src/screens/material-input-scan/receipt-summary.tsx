import { messages } from '@omf-mes/i18n';

import type { ReceiptLineView } from './types';

const t = messages.materialInputScan;

export interface ReceiptSummaryProps {
  lines: readonly ReceiptLineView[];
}

/**
 * 표 아래에 **모자란 것만** 줄로 세운다(스펙 §3).
 *
 * 표는 모든 줄을 같은 무게로 늘어놓는다 — 스무 줄 중 둘이 모자랄 때 그 둘을 찾는 것은 눈의
 * 일이 되고, 장갑을 낀 채 화면을 훑는 작업자는 놓친다. 그래서 **모자란 것만 뽑아 다시 말한다.**
 *
 * ⛔ **막는 말이 아니다.** 부족·미수령이 있어도 수령한 양으로 투입할 수 있다(§6 「라인 수령
 * 미달」). 「모자란다」까지만 말하고 무엇을 하라고 지시하지 않는다 — 지시를 붙이면 투입을
 * 멈춰야 하는 것으로 읽힌다. 결품 처리는 `P-02-10` 소관이다.
 *
 * ⚠ **품목을 번호로 가리킨다.** 스펙 §3은 `MAT-B`처럼 품목 코드를 적었지만, 계약의
 * `ShopfloorReceiptLine`은 `itemId`만 주고 이 화면 몫 엔드포인트에 품목 조회가 없다. 지어낸
 * 이름을 세우지 않고 있는 값을 그대로 낸다.
 */
export const ReceiptSummary = ({ lines }: ReceiptSummaryProps) => {
  const lacking = lines.filter((line) => line.status !== 'matched');

  if (lacking.length === 0) return null;

  return (
    <div className="receipt-summary">
      <h3 className="receipt-summary-title">{t.receiptSummary.label}</h3>
      <ul className="receipt-summary-items">
        {lacking.map((line) => (
          <li key={line.shopfloorReceiptLineId} className="field-note">
            {line.status === 'none'
              ? t.receiptSummary.none(line.itemId)
              : t.receiptSummary.short(line.itemId, line.varianceQty)}
          </li>
        ))}
      </ul>
    </div>
  );
};
