import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDate } from '../../test/date-picker';
import { ReceiptDatetimeField, RemarksField } from './receipt-header-form';

const t = messages.goodsReceipt;

const renderDatetime = (value = '', error?: string, disabled = false) => {
  const onChange = vi.fn<(value: string) => void>();

  render(
    <ReceiptDatetimeField value={value} error={error} disabled={disabled} onChange={onChange} />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('ReceiptDatetimeField — 입고 일시', () => {
  /* C-12 — 날짜는 DS `DatePicker`다. 브라우저 기본 날짜·일시 칸을 쓰지 않는다. */
  it('날짜는 DatePicker이고 브라우저 기본 일시 칸이 없다', () => {
    const { container } = render(
      <ReceiptDatetimeField value="" disabled={false} onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText(t.fields.receiptDatetime).tagName).toBe('BUTTON');
    expect(container.querySelector('input[type="date"], input[type="datetime-local"]')).toBeNull();
  });

  /* 한쪽만 넣은 값은 보낼 수 없는 일시다 — 둘 다 넣어야 값이 올라간다. */
  it('날짜와 시각을 모두 넣어야 값이 올라간다', async () => {
    const { onChange, user } = renderDatetime();

    await pickDate(user, screen.getByLabelText(t.fields.receiptDatetime), '2026-08-06');

    expect(onChange).toHaveBeenLastCalledWith('');

    await user.type(screen.getByLabelText(t.process.receiptTime), '09:12');

    expect(onChange).toHaveBeenLastCalledWith('2026-08-06T09:12');
  });

  it('받은 값을 날짜와 시각으로 나누어 보인다', () => {
    renderDatetime('2026-08-06T09:12');

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveTextContent('2026-08-06');
    expect(screen.getByLabelText(t.process.receiptTime)).toHaveValue('09:12');
  });

  it('오류는 그 칸에 붙는다', () => {
    renderDatetime('', '합성 서버 오류');

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveAccessibleDescription(
      '합성 서버 오류',
    );
  });

  it('잠그면 두 칸이 함께 잠긴다', () => {
    renderDatetime('', undefined, true);

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeDisabled();
    expect(screen.getByLabelText(t.process.receiptTime)).toBeDisabled();
  });
});

describe('RemarksField — 비고', () => {
  it('비고를 치면 그 값이 올라간다', async () => {
    const onChange = vi.fn<(value: string) => void>();

    render(<RemarksField value="" disabled={false} onChange={onChange} />);
    await userEvent.setup().type(screen.getByLabelText(t.fields.remarks), '합');

    expect(onChange).toHaveBeenCalledWith('합');
  });

  it('그 칸의 오류만 그 칸에 붙는다', () => {
    render(<RemarksField value="" error="합성 서버 오류" disabled={false} onChange={vi.fn()} />);

    expect(screen.getByLabelText(t.fields.remarks)).toHaveAccessibleDescription('합성 서버 오류');
  });

  it('잠그면 잠긴다', () => {
    render(<RemarksField value="" disabled onChange={vi.fn()} />);

    expect(screen.getByLabelText(t.fields.remarks)).toBeDisabled();
  });
});
