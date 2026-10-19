import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDate } from '../../test/date-picker';
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
  /* 입고 일시는 날짜(달력)·시각(24시간 HH:mm) 두 칸으로 받는다 — 표기를 `yyyy-MM-dd HH:mm` 에 맞춘다(담당자 지시). */
  it('입고 일자·입고 시각·비고 세 칸을 둔다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDate)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptTime)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.remarks)).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  /* 전량 입고라 수량 입력칸이 없다 — 밝히지 않으면 「수량을 어디서 고치나」를 찾게 된다. */
  /* 값이 어디서 오는지는 「선택한 입하 라인」 제목 옆이 밝힌다(`ir-line-table`). */
  it('수량 입력칸을 두지 않는다', () => {
    renderForm();

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('받은 입고 일시를 날짜와 시각으로 나눠 보인다', () => {
    renderForm({ receiptDatetime: '2026-08-06T09:12' });

    expect(screen.getByLabelText(t.fields.receiptDate)).toHaveTextContent('2026-08-06');
    expect(screen.getByLabelText(t.fields.receiptTime)).toHaveValue('09:12');
  });

  it('날짜와 시각을 다 넣어야 입고 일시가 올라가고, 그 전에는 빈 값이다', async () => {
    const { onChangeReceiptDatetime, user } = renderForm();

    await user.type(screen.getByLabelText(t.fields.receiptTime), '0912');

    /* 숫자만 쳐도 `:` 가 들어간다. */
    expect(screen.getByLabelText(t.fields.receiptTime)).toHaveValue('09:12');
    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('');

    await pickDate(user, screen.getByLabelText(t.fields.receiptDate), '2026-08-06');

    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('2026-08-06T09:12');
  });

  it('형식에 맞지 않는 시각은 올리지 않고 칸에 안내한다', async () => {
    const { onChangeReceiptDatetime, user } = renderForm();

    await pickDate(user, screen.getByLabelText(t.fields.receiptDate), '2026-08-06');
    await user.type(screen.getByLabelText(t.fields.receiptTime), '2575');

    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('');
    expect(screen.getByLabelText(t.fields.receiptTime)).toHaveAccessibleDescription(
      t.notes.receiptTimeInvalid,
    );
  });

  it('비고를 치면 그 값이 올라간다', async () => {
    const { onChangeRemarks, user } = renderForm();

    await user.type(screen.getByLabelText(t.fields.remarks), '합');

    expect(onChangeRemarks).toHaveBeenCalledWith('합');
  });

  it('그 칸의 오류만 그 칸에 붙는다', () => {
    renderForm({ fieldErrors: { remarks: '합성 서버 오류' } });

    expect(screen.getByLabelText(t.fields.remarks)).toHaveAccessibleDescription('합성 서버 오류');
    expect(screen.getByLabelText(t.fields.receiptTime)).not.toHaveAccessibleDescription(
      '합성 서버 오류',
    );
  });

  it('입고 일시 오류는 시각 칸 아래에 붙는다', () => {
    renderForm({ fieldErrors: { receiptDatetime: '합성 일시 오류' } });

    expect(screen.getByLabelText(t.fields.receiptTime)).toHaveAccessibleDescription(
      '합성 일시 오류',
    );
  });

  it('전송 중에는 세 칸이 잠긴다', () => {
    renderForm({ isLocked: true });

    expect(screen.getByLabelText(t.fields.receiptDate)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.receiptTime)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).toBeDisabled();
  });

  it('전송 중이 아니면 잠기지 않는다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDate)).not.toBeDisabled();
    expect(screen.getByLabelText(t.fields.receiptTime)).not.toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).not.toBeDisabled();
  });
});
