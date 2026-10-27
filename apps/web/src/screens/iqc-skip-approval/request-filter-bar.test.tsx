import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { EMPTY_FILTERS } from './filters';
import { RequestFilterBar, type RequestFilterBarProps } from './request-filter-bar';

const t = messages.iqcSkipApproval;

const baseProps = (): RequestFilterBarProps => ({
  appliedFilters: EMPTY_FILTERS,
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<RequestFilterBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  const result = render(<RequestFilterBar {...props} />);

  return { ...result, ...props, user: userEvent.setup() };
};

describe('RequestFilterBar — 좁히는 축', () => {
  it('조건 칸이 둘이다 — 상신일·요청번호(상태는 탭 줄 칩 · 승인 유형은 이 화면의 정체 · #186)', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.period)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.q)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.status)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.approvalTypeCode)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('조건 없이도 조회와 초기화는 열려 있다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
  });

  it('칩이 건 상태는 조회해도 그대로 실린다', async () => {
    const { onSearch, user } = renderBar({
      appliedFilters: { ...EMPTY_FILTERS, statusCode: 'APPROVED' },
    });

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_FILTERS, statusCode: 'APPROVED' });
  });
});

describe('RequestFilterBar — 모아서 적용', () => {
  it('요청번호를 치고 조회를 누르면 그 값이 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH-REQ-001');
    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_FILTERS, q: 'SYNTH-REQ-001' });
  });

  it('고친 기간은 조회를 눌러야 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-07-20', '2026-07-25');
    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      from: '2026-07-20',
      to: '2026-07-25',
    });
  });

  it('엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH{Enter}');

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_FILTERS, q: 'SYNTH' });
  });
});

describe('RequestFilterBar — 주소가 정본이다', () => {
  it('바깥에서 조건이 바뀌면 컨트롤이 따라간다 — 뒤로가기가 값을 되돌린다', () => {
    const props = baseProps();
    const { rerender } = render(<RequestFilterBar {...props} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');

    rerender(
      <RequestFilterBar {...props} appliedFilters={{ ...EMPTY_FILTERS, q: 'SYNTH-REQ-002' }} />,
    );

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYNTH-REQ-002');
  });

  it('내용이 같은 새 객체가 와도 치던 값을 덮지 않는다', async () => {
    const props = baseProps();
    const { rerender } = render(<RequestFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');

    /* 부모가 다시 그려지는 것은 조회 응답이 도착할 때마다 실제로 일어난다(#43). */
    rerender(<RequestFilterBar {...props} appliedFilters={{ ...EMPTY_FILTERS }} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYNTH');
  });

  it('초기화는 자기 편집 상태도 함께 비운다', async () => {
    const { onReset, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');
  });
});

describe('RequestFilterBar — 조건 칩', () => {
  it('걸어 둔 조건마다 칩 하나이고 ×가 그 조건만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { ...EMPTY_FILTERS, q: 'SYNTH', from: '2026-08-01', to: '2026-08-31' },
    });

    expect(screen.getByText(t.filters.chipKeyword('SYNTH'))).toBeInTheDocument();
    expect(screen.getByText(t.filters.chipPeriod('2026-08-01', '2026-08-31'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemovePeriod }));

    expect(onRemoveFilter).toHaveBeenCalledWith('period');
  });

  it('조건이 없으면 칩도 없다', () => {
    renderBar();

    /* 선행 단언 — 조건 줄이 실제로 그려져야 「칩이 없다」가 뜻을 갖는다. */
    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.filters.chipRemoveKeyword }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.filters.chipRemovePeriod }),
    ).not.toBeInTheDocument();
  });
});
