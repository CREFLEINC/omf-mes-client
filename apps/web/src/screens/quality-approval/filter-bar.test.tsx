import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterBar, type FilterBarProps } from './filter-bar';
import { EMPTY_FILTERS } from './filters';
import { pickRange } from '../../test/date-picker';

const t = messages.qualityApproval;

const makeProps = (overrides: Partial<FilterBarProps> = {}): FilterBarProps => ({
  applied: EMPTY_FILTERS,
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
  it('빈 코드 선택칸은 placeholder와 연결된 준비 설명을 제공한다', () => {
    renderBar();
    const status = screen.getByLabelText(t.fields.statusCode);

    /* 승인 유형은 조건 막대가 아니라 목록 위 탭으로 옮겼다(#144). */
    expect(screen.queryByLabelText(t.fields.approvalTypeCode)).not.toBeInTheDocument();
    expect(status).toHaveTextContent(t.codePlaceholder);
    expect(status).toHaveAccessibleDescription(t.codePending);
  });

  it('선택·기간·검색어 draft를 Enter로 함께 적용한다', async () => {
    /* 적용된 승인 유형(탭)은 조건 막대의 적용·조회에도 그대로 실려 간다. */
    const { props, user } = renderBar({
      applied: { ...EMPTY_FILTERS, approvalTypeCode: 'CONCESSION' },
      statusOptions: [{ value: 'SYNTH-OPEN', label: '합성 상태' }],
    });

    await user.click(screen.getByLabelText(t.fields.statusCode));
    await user.click(screen.getByRole('option', { name: '합성 상태' }));
    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-08-01', '2026-08-22');
    await user.type(requestSearch(), 'SYNTH-REQ{Enter}');
    expect(props.onApply).toHaveBeenCalledWith({
      approvalTypeCode: 'CONCESSION',
      statusCode: 'SYNTH-OPEN',
      from: '2026-08-01',
      to: '2026-08-22',
      q: 'SYNTH-REQ',
    });

    await user.click(screen.getByRole('button', { name: messages.common.search }));
    expect(props.onApply).toHaveBeenLastCalledWith({
      approvalTypeCode: 'CONCESSION',
      statusCode: 'SYNTH-OPEN',
      from: '2026-08-01',
      to: '2026-08-22',
      q: 'SYNTH-REQ',
    });
  });

  it('초기화는 draft를 비우고 reset을 알린다', async () => {
    const { props, user } = renderBar({ applied: { ...EMPTY_FILTERS, q: 'SYNTH-REQ' } });

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(requestSearch()).toHaveValue('');
    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it('pendingOnly는 즉시 알리고 검색어 draft는 보존한다', async () => {
    const { props, user } = renderBar();

    await user.type(requestSearch(), 'SYNTH-DRAFT');
    await user.click(screen.getByRole('checkbox', { name: t.fields.pendingOnly }));

    expect(props.onTogglePendingOnly).toHaveBeenCalledWith(false);
    expect(props.onApply).not.toHaveBeenCalled();
    expect(requestSearch()).toHaveValue('SYNTH-DRAFT');
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
