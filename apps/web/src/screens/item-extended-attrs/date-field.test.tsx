import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDate } from '../../test/date-picker';
import { DateField } from './date-field';

const renderField = (overrides: Partial<Parameters<typeof DateField>[0]> = {}) => {
  const onChange = vi.fn<(value: string) => void>();

  render(<DateField label="유효 시작" value="2026-05-10" onChange={onChange} {...overrides} />);

  return { onChange, user: userEvent.setup() };
};

describe('DateField', () => {
  it('라벨이 날짜칸을 가리킨다', () => {
    renderField();

    expect(screen.getByLabelText('유효 시작')).toBeInTheDocument();
  });

  it('저장된 값을 그대로 보인다 — 표기를 다른 형식으로 바꾸지 않는다', () => {
    renderField();

    expect(screen.getByLabelText('유효 시작')).toHaveTextContent('2026-05-10');
  });

  it('날짜를 고르면 계약이 쓰는 형식 그대로 알린다', async () => {
    const { onChange, user } = renderField();

    await pickDate(user, screen.getByLabelText('유효 시작'), '2026-05-22');

    expect(onChange).toHaveBeenCalledWith('2026-05-22');
  });

  /*
   * 달을 넘어가도 값이 그대로 실려야 한다 — 달 넘김은 달력의 상태일 뿐이라
   * 넘긴 뒤 고른 날이 다른 달의 같은 날짜로 새어 나가면 조용히 틀린 자료가 저장된다.
   */
  it('다른 달의 날짜도 그 달의 날짜로 알린다', async () => {
    const { onChange, user } = renderField();

    await pickDate(user, screen.getByLabelText('유효 시작'), '2026-07-03');

    expect(onChange).toHaveBeenCalledWith('2026-07-03');
  });

  /*
   * `TextField type="date"`일 때는 브라우저가 없는 날짜를 걸렀다. 그 방어선을 잃지 않았는지 본다 —
   * 달력은 **없는 날을 그리지 않는 것**으로 같은 일을 한다. 2026년 2월은 28일까지다.
   */
  it('없는 날짜는 고를 수 없다 — 달력이 그 날을 그리지 않는다', async () => {
    const { user } = renderField({ value: '2026-02-10' });

    await user.click(screen.getByLabelText('유효 시작'));

    expect(document.querySelector('td[data-date="2026-02-28"]')).not.toBeNull();
    expect(document.querySelector('td[data-date="2026-02-29"]')).toBeNull();
    expect(document.querySelector('td[data-date="2026-02-31"]')).toBeNull();
  });

  /* 빈 값은 「지정하지 않음」이다 — 빈 상자로 두면 무엇을 하는 칸인지 읽히지 않는다. */
  it('값이 없으면 자리표시를 낸다', () => {
    renderField({ value: '' });

    expect(screen.getByLabelText('유효 시작')).toHaveTextContent('날짜 선택');
  });

  /* 지금 고칠 수 있는 것을 먼저 보인다 — 오류가 있으면 안내를 밀어낸다. */
  it('오류가 안내보다 앞선다', () => {
    renderField({ note: '안내 문구', error: '필수 입력 항목입니다.' });

    expect(screen.getByLabelText('유효 시작')).toHaveAccessibleDescription('필수 입력 항목입니다.');
    expect(screen.queryByText('안내 문구')).not.toBeInTheDocument();
  });

  it('오류를 컴포넌트에도 알린다 — 테두리만 붉고 속은 멀쩡한 상태를 막는다', () => {
    renderField({ error: '필수 입력 항목입니다.' });

    expect(screen.getByLabelText('유효 시작')).toHaveAttribute('aria-invalid', 'true');
  });

  it('필수 표시를 접근성 속성으로도 남긴다', () => {
    renderField({ required: true });

    expect(screen.getByLabelText('유효 시작')).toHaveAttribute('aria-required', 'true');
  });

  it('잠긴 칸은 달력을 열지 않는다', async () => {
    const { user } = renderField({ disabled: true });

    const trigger = screen.getByLabelText('유효 시작');
    expect(trigger).toBeDisabled();

    await user.click(trigger);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
