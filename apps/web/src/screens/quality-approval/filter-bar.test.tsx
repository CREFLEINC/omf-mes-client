import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterBar, type FilterBarProps } from './filter-bar';
import { EMPTY_FILTERS } from './filters';

const t = messages.qualityApproval;

const makeProps = (overrides: Partial<FilterBarProps> = {}): FilterBarProps => ({
  applied: EMPTY_FILTERS,
  typeOptions: [],
  statusOptions: [],
  pendingOnly: true,
  onApply: vi.fn(),
  onTogglePendingOnly: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<FilterBarProps> = {}) => {
  const props = makeProps(overrides);
  return { ...render(<FilterBar {...props} />), props, user: userEvent.setup() };
};

const requestSearch = (): HTMLElement => screen.getByLabelText(t.fields.q);

describe('FilterBar draft lifetime', () => {
  it('편집한 draft를 검색으로 적용한다', async () => {
    const { props, user } = renderBar();

    await user.type(requestSearch(), 'SYNTH-REQ');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(props.onApply).toHaveBeenCalledWith({
      approvalTypeCode: '',
      statusCode: '',
      from: '',
      to: '',
      q: 'SYNTH-REQ',
    });
  });

  it('초기화는 draft를 비우고 reset을 알린다', async () => {
    const { props, user } = renderBar({ applied: { ...EMPTY_FILTERS, q: 'SYNTH-REQ' } });

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(requestSearch()).toHaveValue('');
    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it('적용된 primitive가 바뀌면 draft를 동기화한다', () => {
    const props = makeProps({ applied: { ...EMPTY_FILTERS, q: 'SYNTH-OLD' } });
    const { rerender } = render(<FilterBar {...props} />);

    rerender(<FilterBar {...props} applied={{ ...EMPTY_FILTERS, q: 'SYNTH-NEW' }} />);

    expect(requestSearch()).toHaveValue('SYNTH-NEW');
  });

  it('무관한 rerender는 편집 중 draft를 보존한다', async () => {
    const props = makeProps();
    const { rerender } = render(<FilterBar {...props} />);

    await userEvent.setup().type(requestSearch(), 'SYNTH-DRAFT');
    rerender(<FilterBar {...props} applied={{ ...EMPTY_FILTERS }} pendingOnly={false} />);

    expect(requestSearch()).toHaveValue('SYNTH-DRAFT');
  });
});
