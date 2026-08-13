import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { goodsReceiptFixtures, INTERNAL_IDS } from './fixtures';
import { ReceiptSummaryPane } from './receipt-summary-pane';
import type { ReceiptView } from './types';

const t = messages.disposalIssue;

const RECEIPT = goodsReceiptFixtures[0] as ReceiptView;
const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';

const renderPane = (warehouseName = WAREHOUSE_LABEL): HTMLElement => {
  render(<ReceiptSummaryPane receipt={RECEIPT} warehouseName={warehouseName} />);

  return screen.getByRole('group', { name: t.summary.label });
};

describe('ReceiptSummaryPane', () => {
  it('다섯 값을 이름과 함께 낸다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.summary.goodsReceiptNo)).toBeInTheDocument();
    expect(within(pane).getByText('GR-2026-900001')).toBeInTheDocument();
    expect(within(pane).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(pane).getByText('2026-08-06 09:12')).toBeInTheDocument();
    expect(within(pane).getByText('SAMPLE_GR_TYPE_A')).toBeInTheDocument();
    expect(within(pane).getByText('SAMPLE_GR_STATUS_A')).toBeInTheDocument();
  });

  /**
   * **짝 단언** — 이름이 보이는 것을 먼저 재고 번호가 없음을 잰다. 「아무것도 안 그려도
   * 통과하는 단언」을 만들지 않기 위해서다.
   */
  it('내부 번호를 어느 자리에도 내지 않는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText('GR-2026-900001')).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });

  /**
   * 창고 이름을 못 푼 갈래도 **문구만** 받는다 — 이 부품에는 번호를 문자열로 만드는 자리가 없다.
   */
  it('이름을 못 푼 갈래는 그 문구를 그대로 낸다', () => {
    const pane = renderPane(t.values.referenceFailed);

    expect(within(pane).getByText(t.values.referenceFailed)).toBeInTheDocument();
    expect(pane.textContent ?? '').not.toContain('9701');
  });

  /** **코드를 해석하지 않는다** — 서버가 준 값을 그대로 낸다(공유계약 G-2). */
  it('상태 코드를 번역하지 않는다', () => {
    render(
      <ReceiptSummaryPane
        receipt={{ ...RECEIPT, statusCode: '알 수 없는 코드' }}
        warehouseName={WAREHOUSE_LABEL}
      />,
    );

    expect(screen.getByText('알 수 없는 코드')).toBeInTheDocument();
  });
});
