import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectField } from './select-field';
import type { SelectOption } from './types';

const options: SelectOption[] = [
  { value: 'FIFO', label: 'FIFO' },
  { value: 'FEFO', label: 'FEFO' },
];

const renderField = (overrides: Partial<Parameters<typeof SelectField>[0]> = {}) => {
  const onChange = vi.fn<(value: string) => void>();

  render(
    <SelectField
      label="선출 정책"
      options={options}
      value="FIFO"
      onChange={onChange}
      {...overrides}
    />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('SelectField', () => {
  it('라벨이 선택칸을 가리킨다', () => {
    renderField();

    expect(screen.getByLabelText('선출 정책')).toBeInTheDocument();
  });

  it('선택지를 고르면 값을 알린다', async () => {
    const { onChange, user } = renderField();

    await user.click(screen.getByLabelText('선출 정책'));
    await user.click(screen.getByRole('option', { name: 'FEFO' }));

    expect(onChange).toHaveBeenCalledWith('FEFO');
  });

  /*
   * 비활성 컨트롤은 포커스를 받지 못해 사유를 시각으로만 두면 보조기술이 닿을 수 없다(배치 규범 4).
   */
  it('비활성 사유를 항상 보이는 텍스트로 잇는다', () => {
    renderField({ disabled: true, disabledReason: '선출 정책은 지금 바꿀 수 없습니다.' });

    const trigger = screen.getByLabelText('선출 정책');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAccessibleDescription('선출 정책은 지금 바꿀 수 없습니다.');
  });

  /* 지금 고칠 수 있는 것을 먼저 보인다 — 오류가 있으면 안내를 밀어낸다. */
  it('오류가 안내보다 앞선다', () => {
    renderField({ note: '안내 문구', error: '필수 입력 항목입니다.' });

    expect(screen.getByLabelText('선출 정책')).toHaveAccessibleDescription('필수 입력 항목입니다.');
    expect(screen.queryByText('안내 문구')).not.toBeInTheDocument();
  });

  it('필수 표시를 접근성 속성으로도 남긴다', () => {
    renderField({ required: true });

    expect(screen.getByLabelText('선출 정책')).toHaveAttribute('aria-required', 'true');
  });
});
