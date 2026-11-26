import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { completeTime, sanitizeTime, TimeField, type TimeFieldLabels } from './time-field';

const LABELS: TimeFieldLabels = {
  field: '시작 시간',
  hourList: '시작 시간 (시)',
  minuteList: '시작 시간 (분)',
  hourHead: '시',
  minuteHead: '분',
  placeholder: '--:--',
};

describe('sanitizeTime · completeTime — 24시간 입력 다듬기', () => {
  it('숫자만 쳐도 : 를 넣고, 없는 시각은 받지 않는다', () => {
    expect(sanitizeTime('2000')).toBe('20:00');
    expect(sanitizeTime('830')).toBe('08:30');
    expect(sanitizeTime('25')).toBe('2');
    expect(sanitizeTime('2370')).toBe('23:0');
    expect(sanitizeTime('ab12:3x4')).toBe('12:34');
  });

  it('덜 친 값은 칸을 벗어날 때 채운다', () => {
    expect(completeTime('8')).toBe('08:00');
    expect(completeTime('08')).toBe('08:00');
    expect(completeTime('08:3')).toBe('08:30');
    expect(completeTime('')).toBe('');
  });
});

const Harness = ({
  initial = '',
  blocked,
  clearable = false,
  onChange,
}: {
  initial?: string;
  blocked?: readonly string[];
  clearable?: boolean;
  onChange?: (value: string) => void;
}) => {
  const [value, setValue] = useState(initial);
  const set = (next: string) => {
    setValue(next);
    onChange?.(next);
  };
  return (
    <TimeField
      labels={LABELS}
      hour={value.slice(0, 2)}
      minute={value.slice(3, 5)}
      disabled={false}
      invalid={false}
      blockedTimes={blocked}
      onChange={(hour, minute) => set(`${hour}:${minute}`)}
      {...(clearable ? { onClear: () => set('') } : {})}
    />
  );
};

describe('TimeField', () => {
  it('칸에 바로 친 시각을 정한다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: '시작 시간' });

    await user.type(input, '2000');
    expect(input).toHaveValue('20:00');
    expect(onChange).toHaveBeenLastCalledWith('20:00');
  });

  it('덜 친 값은 벗어날 때 채워 정하고, 막힌 시각은 앞 값으로 돌아간다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" blocked={['08:00']} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: '시작 시간' });

    await user.clear(input);
    await user.type(input, '7');
    await user.tab();
    expect(input).toHaveValue('07:00');
    expect(onChange).toHaveBeenLastCalledWith('07:00');

    await user.clear(input);
    await user.type(input, '0800');
    await user.tab();
    expect(input).toHaveValue('07:00');
    expect(onChange).not.toHaveBeenCalledWith('08:00');
  });

  it('비울 수 없는 칸은 다 지우고 벗어나면 앞 값으로 돌아간다', async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    const input = screen.getByRole('textbox', { name: '시작 시간' });

    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue('09:00');
  });

  it('고르기 창 — 시 · 분을 고르면 정하고 닫힌다, [취소]는 바꾸지 않는다, [비우기]는 비운다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" clearable onChange={onChange} />);
    const open = screen.getByRole('button', { name: '시작 시간 고르기' });

    await user.click(open);
    await user.click(
      within(screen.getByRole('listbox', { name: '시작 시간 (시)' })).getByRole('option', {
        name: '21',
      }),
    );
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '시작 시간' })).toBeNull();

    await user.click(open);
    await user.click(
      within(screen.getByRole('listbox', { name: '시작 시간 (시)' })).getByRole('option', {
        name: '21',
      }),
    );
    await user.click(
      within(screen.getByRole('listbox', { name: '시작 시간 (분)' })).getByRole('option', {
        name: '30',
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith('21:30');
    expect(screen.getByRole('textbox', { name: '시작 시간' })).toHaveValue('21:30');

    await user.click(open);
    await user.click(screen.getByRole('button', { name: '비우기' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('textbox', { name: '시작 시간' })).toHaveValue('');
  });

  it('[확인]은 시만 고른 채로도 정한다(분은 지금 값)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:15" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '시작 시간 고르기' }));
    await user.click(
      within(screen.getByRole('listbox', { name: '시작 시간 (시)' })).getByRole('option', {
        name: '10',
      }),
    );
    expect(screen.queryByRole('button', { name: '비우기' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(onChange).toHaveBeenLastCalledWith('10:15');
  });
});
