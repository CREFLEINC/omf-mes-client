import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
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

const timeButton = (): HTMLElement => screen.getByRole('button', { name: t.fields.receiptTime });
const hourList = (): HTMLElement => screen.getByRole('listbox', { name: t.fields.receiptHour });
const minuteList = (): HTMLElement => screen.getByRole('listbox', { name: t.fields.receiptMinute });

const pickTime = async (
  user: ReturnType<typeof userEvent.setup>,
  hour: string,
  minute: string,
): Promise<void> => {
  await user.click(timeButton());
  await user.click(within(hourList()).getByRole('option', { name: hour }));
  await user.click(within(minuteList()).getByRole('option', { name: minute }));
};

describe('ReceiptHeaderForm', () => {
  /* 입고 일시는 [날짜] [시각] 두 칸 — 둘 다 «고른다»(담당자 지시). 표기는 `yyyy-MM-dd HH:mm`. */
  it('입고 일시는 날짜·시각 선택칸, 그리고 비고 칸을 둔다', () => {
    renderForm();

    expect(screen.getByRole('group', { name: t.fields.receiptDatetime })).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDate)).toBeInTheDocument();
    expect(timeButton()).toHaveTextContent(t.values.receiptTimePlaceholder);
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

  it('받은 입고 일시를 날짜와 HH:mm 으로 나눠 보인다', () => {
    renderForm({ receiptDatetime: '2026-08-06T09:12' });

    expect(screen.getByLabelText(t.fields.receiptDate)).toHaveTextContent('2026-08-06');
    expect(timeButton()).toHaveTextContent('09:12');
  });

  it('시각 칸을 누르면 시 00~23 · 분 00~59 두 열이 한 팝오버에 열리고, 지금 값이 골라져 있다', async () => {
    const { user } = renderForm({ receiptDatetime: '2026-08-06T09:12' });

    await user.click(timeButton());

    expect(within(hourList()).getAllByRole('option')).toHaveLength(24);
    expect(within(minuteList()).getAllByRole('option')).toHaveLength(60);
    expect(within(hourList()).getByRole('option', { name: '09' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(minuteList()).getByRole('option', { name: '12' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('시를 고르고 분을 고르면 값이 정해지고 팝오버가 닫힌다', async () => {
    const { onChangeReceiptDatetime, user } = renderForm();

    await pickDate(user, screen.getByLabelText(t.fields.receiptDate), '2026-08-06');
    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('');

    await user.click(timeButton());
    await user.click(within(hourList()).getByRole('option', { name: '14' }));

    /* 시만 골랐을 때는 아직 열려 있고 값도 그대로다. */
    expect(minuteList()).toBeInTheDocument();
    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('');

    await user.click(within(minuteList()).getByRole('option', { name: '07' }));

    expect(onChangeReceiptDatetime).toHaveBeenLastCalledWith('2026-08-06T14:07');
    expect(screen.queryByRole('listbox', { name: t.fields.receiptMinute })).not.toBeInTheDocument();
    expect(timeButton()).toHaveTextContent('14:07');
  });

  it('시를 고르기 전에는 분을 골라도 값이 정해지지 않는다', async () => {
    const { onChangeReceiptDatetime, user } = renderForm();

    await user.click(timeButton());
    await user.click(within(minuteList()).getByRole('option', { name: '07' }));

    expect(onChangeReceiptDatetime).not.toHaveBeenCalled();
    expect(minuteList()).toBeInTheDocument();
  });

  it('Esc 를 누르면 고르던 것을 버리고 닫는다', async () => {
    const { onChangeReceiptDatetime, user } = renderForm();

    await user.click(timeButton());
    await user.click(within(hourList()).getByRole('option', { name: '14' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox', { name: t.fields.receiptHour })).not.toBeInTheDocument();
    expect(onChangeReceiptDatetime).not.toHaveBeenCalled();
    expect(timeButton()).toHaveTextContent(t.values.receiptTimePlaceholder);
  });

  it('날짜와 시각을 다 골라야 입고 일시가 올라간다', async () => {
    const { onChangeReceiptDatetime, user } = renderForm();

    await pickTime(user, '09', '12');
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
    expect(timeButton()).not.toHaveAccessibleDescription('합성 서버 오류');
  });

  it('입고 일시 오류는 묶음 아래에 붙고 날짜·시각 칸에 이어진다', () => {
    renderForm({ fieldErrors: { receiptDatetime: '합성 일시 오류' } });

    expect(screen.getByText('합성 일시 오류')).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDate)).toHaveAccessibleDescription(
      '합성 일시 오류',
    );
    expect(timeButton()).toHaveAccessibleDescription('합성 일시 오류');
  });

  it('전송 중에는 모든 칸이 잠긴다', () => {
    renderForm({ isLocked: true });

    expect(screen.getByLabelText(t.fields.receiptDate)).toBeDisabled();
    expect(timeButton()).toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).toBeDisabled();
  });

  it('전송 중이 아니면 잠기지 않는다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDate)).not.toBeDisabled();
    expect(timeButton()).not.toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).not.toBeDisabled();
  });
});
