import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { FilterBar, type FilterBarProps } from './filter-bar';
import type { PendingFilters } from './filters';
import type { DispositionLookup } from './lookups';

const t = messages.dispositionDecision;

const applied: PendingFilters = {
  from: '2026-07-14',
  to: '2026-08-12',
  itemId: '',
  severityCode: '',
  statusCode: '',
};

const items = (): DispositionLookup => ({
  entries: [{ value: '5001', label: 'SYNTH-ITEM-1 · 합성 품목', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const baseProps = (): FilterBarProps => ({
  applied,
  severityOptions: [],
  statusOptions: [],
  items: items(),
  onApply: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<FilterBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<FilterBar {...props} />), props, user: userEvent.setup() };
};

describe('FilterBar', () => {
  it('기간이 필수라는 사실을 칸에 상시 붙인다(L-3)', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.period)).toHaveAccessibleDescription(
      t.values.periodRequired,
    );
  });

  it('값 목록이 없는 코드 칸은 감추지 않고 사유를 붙인다(G-2)', () => {
    renderBar();

    const severity = screen.getByLabelText(t.fields.severityCode);
    expect(severity).toHaveTextContent(t.codePlaceholder);
    expect(severity).toHaveAccessibleDescription(t.codePending);
  });

  it('기간과 품목을 함께 적용한다', async () => {
    const { props, user } = renderBar();

    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-08-01', '2026-08-05');
    await user.click(screen.getByLabelText(t.fields.item));
    await user.click(screen.getByRole('option', { name: 'SYNTH-ITEM-1 · 합성 품목' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(props.onApply).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-05',
      itemId: '5001',
      severityCode: '',
      statusCode: '',
    });
  });

  it('초기화를 알린다', async () => {
    const { props, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it('적용된 조건이 바뀌면 편집 중 값을 그것으로 맞춘다', () => {
    const props = baseProps();
    const { rerender } = render(<FilterBar {...props} />);

    rerender(<FilterBar {...props} applied={{ ...applied, itemId: '5001' }} />);

    expect(screen.getByLabelText(t.fields.item)).toHaveTextContent('SYNTH-ITEM-1 · 합성 품목');
  });

  it('⚠ 원천으로 거르는 칸을 두지 않는다 — 서버가 값을 내리지 않는다', () => {
    renderBar();

    expect(screen.queryByLabelText('원천')).toBeNull();
  });
});
