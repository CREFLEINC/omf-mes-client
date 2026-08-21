import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SelectField, type SelectFieldProps } from './select-field';

/**
 * 이 부품이 소유한 규칙은 **보조 문구 하나를 셋 중 무엇으로 채우는가**다 —
 * 오류 · 잠긴 사유 · 목록 안내. 셋이 함께 있을 수 있고, 그때 무엇이 서는지가 뜻을 정한다.
 *
 * 설비 그룹 폼에서 셋이 한 칸에 모인다 — 상위 그룹 칸이 안내·오류를,
 * 공장 칸이 잠긴 사유를 갖는다.
 */
const renderField = (overrides: Partial<SelectFieldProps> = {}) => {
  const onChange = vi.fn();

  render(
    <SelectField
      label="상위그룹"
      options={[{ value: '101', label: 'GRP-A · 프레스 구역' }]}
      value=""
      onChange={onChange}
      {...overrides}
    />,
  );

  return { onChange };
};

describe('SelectField — 보조 문구의 우선순위', () => {
  /** 지금 고칠 수 있는 것이 먼저다 — 오류가 안내를 밀어낸다. */
  it('오류가 목록 안내를 밀어낸다', () => {
    renderField({ error: '상위 그룹을 고르세요.', note: '선택지가 앞쪽 일부만 보입니다.' });

    expect(screen.getByText('상위 그룹을 고르세요.')).toBeInTheDocument();
    expect(screen.queryByText('선택지가 앞쪽 일부만 보입니다.')).not.toBeInTheDocument();
  });

  /**
   * **잠긴 칸에서도 오류가 앞선다.** 잠긴 사유는 *지금 할 수 없는 것*을 말하고 오류는
   * *고쳐야 할 것*을 말한다 — 뒤집으면 고칠 것이 있는 칸에서 그 사실이 사라진다.
   */
  it('잠긴 칸에 오류가 함께 있으면 오류가 선다', () => {
    renderField({
      error: '상위 그룹을 고르세요.',
      disabled: true,
      disabledReason: '저장이 끝난 뒤에',
    });

    expect(screen.getByText('상위 그룹을 고르세요.')).toBeInTheDocument();
    expect(screen.queryByText('저장이 끝난 뒤에')).not.toBeInTheDocument();
  });

  /** 오류가 없으면 잠긴 사유가 목록 안내를 밀어낸다 — 지금 할 수 있는 일을 가리키는 문장이다. */
  it('잠긴 칸에서는 잠긴 사유가 목록 안내를 밀어낸다', () => {
    renderField({ disabled: true, disabledReason: '저장이 끝난 뒤에', note: '앞쪽 일부만' });

    expect(screen.getByText('저장이 끝난 뒤에')).toBeInTheDocument();
    expect(screen.queryByText('앞쪽 일부만')).not.toBeInTheDocument();
  });

  /** 잠기지 않았으면 잠긴 사유를 내지 않는다 — 열린 칸에 「할 수 없다」가 서면 안 된다. */
  it('열린 칸에서는 목록 안내가 선다', () => {
    renderField({ disabled: false, disabledReason: '저장이 끝난 뒤에', note: '앞쪽 일부만' });

    expect(screen.getByText('앞쪽 일부만')).toBeInTheDocument();
    expect(screen.queryByText('저장이 끝난 뒤에')).not.toBeInTheDocument();
  });

  /** 보조 문구는 감추지 않고 **접근성 설명으로 이어진다** — 잠긴 칸은 포커스를 받지 못한다. */
  it('보조 문구가 컨트롤의 설명으로 이어진다', () => {
    renderField({ error: '상위 그룹을 고르세요.' });

    const describedBy = screen
      .getByRole('combobox', { name: '상위그룹' })
      .getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent('상위 그룹을 고르세요.');
  });
});
