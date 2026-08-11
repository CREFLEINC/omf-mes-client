import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SubmitConfirmDialog, type SubmitSummary } from './submit-confirm-dialog';

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
  sourceDocumentTypeCode: 'SAMPLE_SOURCE_TYPE_A',
  qualityStatusCode: 'SAMPLE_QUALITY_A',
  inventoryStatusCode: 'SAMPLE_INVENTORY_A',
  reasonCode: '',
  receiptDatetime: '2026-08-06 09:12',
  remarks: '',
};

const renderDialog = (summary: SubmitSummary = SUMMARY) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(<SubmitConfirmDialog summary={summary} onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

describe('SubmitConfirmDialog — 보낼 값을 그대로 다시 보인다', () => {
  it('보낼 값이 전부 나열된다', () => {
    renderDialog();

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
    renderDialog();

    /* 사유와 비고 둘이 비어 있다 — 빠뜨린 것인지 없는 것인지 구분되지 않으면 안 된다. */
    expect(screen.getAllByText(t.values.empty)).toHaveLength(2);
  });

  it('넣은 사유와 비고는 그대로 보인다', () => {
    renderDialog({ ...SUMMARY, reasonCode: 'SAMPLE_REASON_A', remarks: '합성 비고' });

    expect(screen.getByText('SAMPLE_REASON_A')).toBeInTheDocument();
    expect(screen.getByText('합성 비고')).toBeInTheDocument();
  });

  /*
   * 번호만 확인시키면 사용자는 「전표 한 장이 생긴다」로 읽는다 — 실제로는 재고와 원장과
   * 외부 시스템 대기열이 함께 움직이고 이 화면에는 되돌리는 수단이 없다.
   */
  it('함께 움직이는 다섯 가지와 되돌릴 수 없다는 사실을 밝힌다', () => {
    renderDialog();

    const effects = screen.getByText(t.dialog.submitEffects);

    expect(effects).toBeInTheDocument();
    for (const moved of ['입고 전표', '자재 LOT', '수불 원장', '재고 잔액', 'ERP 송신 대기열']) {
      expect(effects.textContent ?? '').toContain(moved);
    }
    expect(effects.textContent ?? '').toContain('되돌릴 수 없습니다');
  });

  /* 「적재」는 「전송」이 아니다(이슈 §6의 ⭐) — 확인 창에서도 같다. */
  it('창 어디에도 「전송 완료」가 없다', () => {
    renderDialog();

    expect(screen.getByRole('dialog').textContent ?? '').not.toContain('전송 완료');
  });
});

describe('SubmitConfirmDialog — 창이 걸리지 않게 두는 것', () => {
  /*
   * **M30** — 창 본문이 선택 목록을 자르는 결함(#45)이 아직 고쳐지지 않았다.
   * 고칠 수 없는 결함은 **걸릴 자리를 만들지 않는 것**으로 피한다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    /* 짝 방향 — 창은 실제로 그려져 있고 값도 담겨 있다. */
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.warehouseName)).toBeInTheDocument();
  });

  /* 디자인 시스템의 `StatusChip`에는 `disabled`가 없다(실측) — 상태를 칩으로 내지 않는다. */
  it('창 안에 입력칸이 하나도 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });
});

describe('SubmitConfirmDialog — 버튼', () => {
  it('확인하면 그때 보낸다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.confirmPost }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('계속 입력을 누르면 닫기만 한다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /*
   * **스치는 클릭에 사라지지 않는다** — 되돌릴 수 없는 조작을 확인하는 창이 스크림 클릭으로
   * 닫히면 확인 자체가 형식이 된다. **파기 확인 창과 갈리는 자리이고**(그쪽은 실수로 닫혀도
   * 잃는 것이 없어 막지 않는다) 그 대비가 이 화면 설계의 일부라 값으로 고정한다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
