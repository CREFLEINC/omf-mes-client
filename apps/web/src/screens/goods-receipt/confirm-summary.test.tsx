import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConfirmSummary, type SubmitSummary } from './confirm-summary';

const t = messages.goodsReceipt;

const SUMMARY: SubmitSummary = {
  inboundReceiptNo: 'IR-2026-900001',
  lineNo: 1,
  itemName: 'SAMPLE-ITEM-01 · 합성 품목 가',
  lotName: 'LOT-2026-900010',
  receiptQty: '100 SAMPLE-EA',
  warehouseName: 'SAMPLE-WH-01 · 합성 창고 가',
  locationName: 'SAMPLE-LOC-A1 · 합성 열 가1',
  receiptTypeCode: 'SAMPLE_RECEIPT_TYPE_A',
  sourceDocumentTypeCode: 'INBOUND_RECEIPT',
  qualityStatusCode: 'SAMPLE_QUALITY_A',
  inventoryStatusCode: 'SAMPLE_INVENTORY_A',
  reasonCode: '',
  receiptDatetime: '2026-08-06 09:12',
  remarks: '',
};

const renderSummary = (summary: SubmitSummary = SUMMARY) => {
  render(<ConfirmSummary summary={summary} />);
};

describe('ConfirmSummary — 확정 확인 단계가 보낼 값을 그대로 다시 보인다', () => {
  it('보낼 값이 전부 나열된다', () => {
    renderSummary();

    for (const value of [
      SUMMARY.inboundReceiptNo,
      SUMMARY.itemName,
      SUMMARY.lotName,
      SUMMARY.receiptQty,
      SUMMARY.warehouseName,
      SUMMARY.locationName,
      SUMMARY.receiptTypeCode,
      SUMMARY.sourceDocumentTypeCode,
      SUMMARY.qualityStatusCode,
      SUMMARY.inventoryStatusCode,
      SUMMARY.receiptDatetime,
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it('값이 없는 칸은 비워 두지 않고 없음 표기를 낸다', () => {
    renderSummary();

    /* 사유와 비고 둘이 비어 있다 — 빠뜨린 것인지 없는 것인지 구분되지 않으면 안 된다. */
    expect(screen.getAllByText(t.values.empty)).toHaveLength(2);
  });

  it('넣은 사유와 비고는 그대로 보인다', () => {
    renderSummary({ ...SUMMARY, reasonCode: 'SAMPLE_REASON_A', remarks: '합성 비고' });

    expect(screen.getByText('SAMPLE_REASON_A')).toBeInTheDocument();
    expect(screen.getByText('합성 비고')).toBeInTheDocument();
  });

  /* 공통코드 표시 이름을 쓰고, 보내는 값(코드)은 바꾸지 않는다. */
  it('코드는 넘겨받은 표시 이름으로 보인다', () => {
    render(
      <ConfirmSummary
        summary={SUMMARY}
        codeLabel={(key, code) => (key === 'receiptType' ? `표시-${code}` : code)}
      />,
    );

    expect(screen.getByText(`표시-${SUMMARY.receiptTypeCode}`)).toBeInTheDocument();
  });

  /* 확인 단계는 다시 입력하는 자리가 아니다 — 고치려면 단계 표시로 돌아간다. */
  it('입력칸과 선택칸이 하나도 없다', () => {
    renderSummary();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
