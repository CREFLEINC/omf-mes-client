import { messages } from '@omf-mes/i18n';

import type { ReceiptLineView } from './types';

const t = messages.materialInputScan;

export interface ReceiptSummaryProps {
  lines: readonly ReceiptLineView[];
  describeItem: (itemId: number) => string;
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
 * 품목은 표와 **같은 이름 풀이**를 쓴다 — 표에서 `MAT-B`로 본 것을 요약에서 번호로 다시
 * 보면 같은 줄인지 눈으로 맞춰야 한다.
 */
export const ReceiptSummary = ({ lines, describeItem }: ReceiptSummaryProps) => {
  const lacking = lines.filter((line) => line.status !== 'matched');

  if (lacking.length === 0) return null;

  return (
    <div className="receipt-summary">
      <h3 className="receipt-summary-title">{t.receiptSummary.label}</h3>
      <ul className="receipt-summary-items">
        {lacking.map((line) => (
          <li key={line.shopfloorReceiptLineId} className="field-note">
            {line.status === 'none'
              ? t.receiptSummary.none(describeItem(line.itemId))
              : t.receiptSummary.short(describeItem(line.itemId), line.varianceQty)}
          </li>
        ))}
      </ul>
    </div>
  );
};
