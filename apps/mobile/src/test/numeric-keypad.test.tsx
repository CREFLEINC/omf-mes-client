import { NumericKeypad } from '@omf-mes/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

const LABELS = { label: '숫자 키패드', backspaceLabel: '한 자 지움', clearLabel: '지움' };

const Probe = ({ maxLength }: { maxLength?: number }) => {
  const [value, setValue] = useState('');

  return (
    <>
      <output>{value}</output>
      <NumericKeypad {...LABELS} value={value} onChange={setValue} maxLength={maxLength} />
    </>
  );
};

const press = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name }));
};

describe('숫자 키패드', () => {
  it('누른 숫자를 차례로 잇는다', async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await press(user, '9');
    await press(user, '0');
    await press(user, '7');

    expect(screen.getByRole('status')).toHaveTextContent('907');
  });

  it('한 자 지움은 마지막 한 자만 뗀다', async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await press(user, '1');
    await press(user, '2');
    await press(user, '한 자 지움');

    expect(screen.getByRole('status')).toHaveTextContent('1');
  });

  it('지움은 전부 비운다', async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await press(user, '1');
    await press(user, '2');
    await press(user, '지움');

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('비어 있으면 지우는 키를 누를 수 없다', () => {
    render(<Probe />);

    expect(screen.getByRole('button', { name: '한 자 지움' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '지움' })).toBeDisabled();
  });

  it('길이 상한에 닿으면 숫자를 더 받지 않는다', async () => {
    const user = userEvent.setup();
    render(<Probe maxLength={2} />);

    await press(user, '1');
    await press(user, '2');

    expect(screen.getByRole('button', { name: '3' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('12');
  });

  it('상한에 닿아도 지우는 키는 살아 있다', async () => {
    const user = userEvent.setup();
    render(<Probe maxLength={1} />);

    await press(user, '5');
    await press(user, '한 자 지움');

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('열 개 키가 전부 눌린다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumericKeypad {...LABELS} value="" onChange={onChange} />);

    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      await press(user, digit);
    }

    expect(onChange.mock.calls.map(([next]) => next)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
    ]);
  });

  it('키 묶음에 이름이 있다', () => {
    render(<Probe />);

    expect(screen.getByRole('group', { name: '숫자 키패드' })).toBeInTheDocument();
  });
});
