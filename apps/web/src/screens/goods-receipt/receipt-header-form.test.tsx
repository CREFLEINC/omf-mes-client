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

const hourBox = (): HTMLElement => screen.getByRole('combobox', { name: t.fields.receiptHour });
const minuteBox = (): HTMLElement => screen.getByRole('combobox', { name: t.fields.receiptMinute });

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  box: HTMLElement,
  option: string,
): Promise<void> => {
  await user.click(box);
  await user.click(screen.getByRole('option', { name: option }));
};

describe('ReceiptHeaderForm', () => {
  /* 입고 일시는 날짜(달력)·시·분을 «고른다»(담당자 지시) — 표기는 `yyyy-MM-dd HH:mm`. */
  it('입고 일시는 날짜·시·분 선택칸, 그리고 비고 칸을 둔다', () => {
    renderForm();

    expect(screen.getByRole('group', { name: t.fields.receiptDatetime })).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDate)).toBeInTheDocument();
    expect(hourBox()).toBeInTheDocument();
    expect(minuteBox()).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.remarks)).toBeInTheDocument();
    /* 시각을 글자로 치는 칸은 없다 — 글자 칸은 비고 하나다. */
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  /* 전량 입고라 수량 입력칸이 없다 — 밝히지 않으면 「수량을 어디서 고치나」를 찾게 된다. */
  /* 값이 어디서 오는지는 「선택한 입하 라인」 제목 옆이 밝힌다(`ir-line-table`). */
  it('수량 입력칸을 두지 않는다', () => {
    renderForm();

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('받은 입고 일시를 날짜·시·분으로 나눠 보인다', () => {
    renderForm({ receiptDatetime: '2026-08-06T09:12' });

    expect(screen.getByLabelText(t.fields.receiptDate)).toHaveTextContent('2026-08-06');
    expect(hourBox()).toHaveTextContent('09');
    expect(minuteBox()).toHaveTextContent('12');
  });

  it('시는 00~23, 분은 00~59 를 1분 단위로 고를 수 있다', async () => {
    const { user } = renderForm();

    await user.click(hourBox());
    expect(screen.getAllByRole('option')).toHaveLength(24);
    await user.click(screen.getByRole('option', { name: '23' }));

    await user.click(minuteBox());
    expect(screen.getAllByRole('option')).toHaveLength(60);
  });

  it('날짜·시·분을 다 골라야 입고 일시가 올라가고, 그 전에는 빈 값이다', async () => {
    const { onChangeReceiptDatetime, user } = renderForm();

    await choose(user, hourBox(), '09');
    await choose(user, minuteBox(), '12');

    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('');

    await pickDate(user, screen.getByLabelText(t.fields.receiptDate), '2026-08-06');

    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('2026-08-06T09:12');
  });

  it('비고를 치면 그 값이 올라간다', async () => {
    const { onChangeRemarks, user } = renderForm();

    await user.type(screen.getByLabelText(t.fields.remarks), '합');

    expect(onChangeRemarks).toHaveBeenCalledWith('합');
  });

  it('그 칸의 오류만 그 칸에 붙는다', () => {
    renderForm({ fieldErrors: { remarks: '합성 서버 오류' } });

    expect(screen.getByLabelText(t.fields.remarks)).toHaveAccessibleDescription('합성 서버 오류');
    expect(hourBox()).not.toHaveAccessibleDescription('합성 서버 오류');
  });

  it('입고 일시 오류는 묶음 아래에 붙고 날짜·시·분 칸에 이어진다', () => {
    renderForm({ fieldErrors: { receiptDatetime: '합성 일시 오류' } });

    expect(screen.getByText('합성 일시 오류')).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDate)).toHaveAccessibleDescription(
      '합성 일시 오류',
    );
    expect(hourBox()).toHaveAccessibleDescription('합성 일시 오류');
    expect(minuteBox()).toHaveAccessibleDescription('합성 일시 오류');
  });

  it('전송 중에는 모든 칸이 잠긴다', () => {
    renderForm({ isLocked: true });

    expect(screen.getByLabelText(t.fields.receiptDate)).toBeDisabled();
    expect(hourBox()).toBeDisabled();
    expect(minuteBox()).toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).toBeDisabled();
  });

  it('전송 중이 아니면 잠기지 않는다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDate)).not.toBeDisabled();
    expect(hourBox()).not.toBeDisabled();
    expect(minuteBox()).not.toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).not.toBeDisabled();
  });
});
