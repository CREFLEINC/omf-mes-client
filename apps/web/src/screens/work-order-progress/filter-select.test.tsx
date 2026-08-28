import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterSelect, type FilterSelectProps } from './filter-select';

const t = messages.workOrderProgress.filters;

const LABEL = '라인';
const OPTION = { value: '7', label: 'SYN-LINE-A · 합성 라인' };

const renderSelect = (overrides: Partial<FilterSelectProps> = {}) => {
  const props: FilterSelectProps = {
    label: LABEL,
    options: [OPTION],
    value: '',
    unavailableReason: null,
    note: null,
    onChange: vi.fn(),
    ...overrides,
  };

  return { ...props, ...render(<FilterSelect {...props} />), user: userEvent.setup() };
};

const box = (): HTMLElement => screen.getByRole('combobox', { name: LABEL });

const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  optionLabel: string,
): Promise<void> => {
  await user.click(box());
  await user.click(await screen.findByRole('option', { name: optionLabel }));
};

describe('FilterSelect', () => {
  it('라벨로 칸을 부를 수 있다 — 화면 읽기 도구가 무엇을 고르는지 들려준다', () => {
    renderSelect();

    expect(box()).toBeInTheDocument();
  });

  it('고른 값을 알린다', async () => {
    const { onChange, user } = renderSelect();

    await pick(user, OPTION.label);

    expect(onChange).toHaveBeenCalledWith('7');
  });

  /* ⛔ 「전체」의 값이 비어 있어야 조회 조건에서 빠진다 — 아니면 없는 값으로 걸러진다. */
  it('⛔ 「전체」의 값은 비어 있다', async () => {
    const { onChange, user } = renderSelect({ value: '7' });

    await pick(user, t.all);

    expect(onChange).toHaveBeenCalledWith('');
  });

  describe('고를 수 없을 때', () => {
    /* G-1·G-2 — 감추지 않고, 끄고, 사유를 함께 적는다. */
    it('⛔ 감추지 않고 끄고 사유를 적는다', () => {
      renderSelect({ unavailableReason: t.statusUnavailable, options: [] });

      expect(box()).toBeDisabled();
      expect(screen.getByText(t.statusUnavailable)).toBeInTheDocument();
    });

    it('⛔ 사유를 칸에 이어 붙인다 — 따로 떠 있으면 어느 칸의 말인지 모른다', () => {
      renderSelect({ unavailableReason: t.statusUnavailable, options: [] });

      expect(box()).toHaveAccessibleDescription(t.statusUnavailable);
    });

    it('사유가 없으면 켜 둔다', () => {
      renderSelect();

      expect(box()).toBeEnabled();
    });
  });

  describe('끄지 않고 알리기만 할 때', () => {
    it('안내를 적되 칸은 켜 둔다 — 고를 수는 있다', () => {
      renderSelect({ note: t.optionsTruncated(200) });

      expect(box()).toBeEnabled();
      expect(screen.getByText(t.optionsTruncated(200))).toBeInTheDocument();
    });

    it('안내도 칸에 이어 붙인다', () => {
      renderSelect({ note: t.optionsTruncated(200) });

      expect(box()).toHaveAccessibleDescription(t.optionsTruncated(200));
    });

    /* 못 고르는 이유가 잘림 안내보다 중요하다 — 둘 다 있으면 사유가 먼저다. */
    it('끈 사유가 있으면 그것을 적는다', () => {
      renderSelect({ unavailableReason: t.lookupFailed, note: t.optionsTruncated(200) });

      expect(screen.getByText(t.lookupFailed)).toBeInTheDocument();
      expect(screen.queryByText(t.optionsTruncated(200))).not.toBeInTheDocument();
    });

    it('알릴 것이 없으면 빈 문단을 두지 않는다', () => {
      const { container } = renderSelect();

      expect(container.querySelector('.field-note')).toBeNull();
    });
  });
});
