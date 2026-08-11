import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReceiptHeaderForm } from './receipt-header-form';

const t = messages.goodsReceipt;

const renderForm = (
  overrides: {
    receiptDatetime?: string;
    remarks?: string;
    fieldErrors?: Record<string, string>;
    isLocked?: boolean;
  } = {},
) => {
  const onChangeReceiptDatetime = vi.fn();
  const onChangeRemarks = vi.fn();

  render(
    <ReceiptHeaderForm
      receiptDatetime={overrides.receiptDatetime ?? ''}
      remarks={overrides.remarks ?? ''}
      fieldErrors={overrides.fieldErrors ?? {}}
      isLocked={overrides.isLocked ?? false}
      onChangeReceiptDatetime={onChangeReceiptDatetime}
      onChangeRemarks={onChangeRemarks}
    />,
  );

  return { onChangeReceiptDatetime, onChangeRemarks, user: userEvent.setup() };
};

describe('ReceiptHeaderForm', () => {
  it('입고 일시와 비고 두 칸만 둔다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.remarks)).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  /*
   * 계약이 영업일을 필수로 요구하는데 산출 규칙이 정의돼 있지 않다 — 입력칸을 두면
   * 사용자가 무엇을 넣어야 하는지 화면이 설명할 수 없다.
   */
  it('영업일 입력칸을 두지 않고 어디서 나오는지 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.notes.businessDateDerived)).toBeInTheDocument();
  });

  /* 전량 입고라 수량 입력칸이 없다 — 밝히지 않으면 「수량을 어디서 고치나」를 찾게 된다. */
  it('수량 입력칸을 두지 않고 값이 어디서 오는지 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.notes.qtyFromInboundLine)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('입고 일시를 고치면 그 값이 올라간다', async () => {
    const { onChangeReceiptDatetime } = renderForm();

    await userEvent.setup().type(screen.getByLabelText(t.fields.receiptDatetime), '2026-08-06T09:12');

    expect(onChangeReceiptDatetime).toHaveBeenCalled();
  });

  it('비고를 치면 그 값이 올라간다', async () => {
    const { onChangeRemarks, user } = renderForm();

    await user.type(screen.getByLabelText(t.fields.remarks), '합');

    expect(onChangeRemarks).toHaveBeenCalledWith('합');
  });

  it('그 칸의 오류만 그 칸에 붙는다', () => {
    renderForm({ fieldErrors: { remarks: '합성 서버 오류' } });

    expect(screen.getByLabelText(t.fields.remarks)).toHaveAccessibleDescription('합성 서버 오류');
    expect(screen.getByLabelText(t.fields.receiptDatetime)).not.toHaveAccessibleDescription(
      '합성 서버 오류',
    );
  });

  it('전송 중에는 두 칸이 잠긴다', () => {
    renderForm({ isLocked: true });

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).toBeDisabled();
  });

  it('전송 중이 아니면 잠기지 않는다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDatetime)).not.toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).not.toBeDisabled();
  });
});
