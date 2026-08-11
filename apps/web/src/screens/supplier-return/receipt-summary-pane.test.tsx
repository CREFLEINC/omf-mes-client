import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { goodsReceipt, INTERNAL_IDS } from './fixtures';
import { ReceiptSummaryPane } from './receipt-summary-pane';

const t = messages.supplierReturn;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';

describe('ReceiptSummaryPane', () => {
  it('고른 전표의 다섯 값을 밝힌다', () => {
    render(<ReceiptSummaryPane receipt={goodsReceipt()} warehouseName={WAREHOUSE_LABEL} />);

    const pane = screen.getByRole('group', { name: t.summary.label });

    expect(pane).toHaveTextContent('GR-2026-900001');
    expect(pane).toHaveTextContent(WAREHOUSE_LABEL);
    expect(pane).toHaveTextContent('2026-08-06 09:12');
    expect(pane).toHaveTextContent('SAMPLE_GR_TYPE_A');
    expect(pane).toHaveTextContent('SAMPLE_GR_STATUS_A');
  });

  it('다섯 값에 라벨이 붙는다', () => {
    render(<ReceiptSummaryPane receipt={goodsReceipt()} warehouseName={WAREHOUSE_LABEL} />);

    for (const label of [
      t.summary.goodsReceiptNo,
      t.summary.warehouse,
      t.summary.receiptDatetime,
      t.summary.receiptType,
      t.summary.status,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  /** 짝 방향 단언 — 이름이 실제로 보이고, 그 자리에 번호가 없다(#44). */
  it('내부 번호를 내지 않는다', () => {
    const { container } = render(
      <ReceiptSummaryPane receipt={goodsReceipt()} warehouseName={WAREHOUSE_LABEL} />,
    );

    expect(container.textContent ?? '').toContain(WAREHOUSE_LABEL);

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /**
   * 이름을 못 푼 갈래도 화면이 받은 문구를 그대로 낸다 — 이 부품은 **판정하지 않는다.**
   * 창고 참조의 실패 안내와 복구는 위 구획이 소유한다(계획 결정 17).
   */
  it('이름을 못 푼 갈래의 문구를 그대로 낸다', () => {
    render(<ReceiptSummaryPane receipt={goodsReceipt()} warehouseName={t.values.unknown} />);

    expect(screen.getByRole('group', { name: t.summary.label })).toHaveTextContent(
      t.values.unknown,
    );
  });
});
