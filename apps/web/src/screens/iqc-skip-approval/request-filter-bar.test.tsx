import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { toCodeOptions } from './code-options';
import { EMPTY_FILTERS } from './filters';
import { RequestFilterBar, type RequestFilterBarProps } from './request-filter-bar';

const t = messages.iqcSkipApproval;

const baseProps = (): RequestFilterBarProps => ({
  appliedFilters: EMPTY_FILTERS,
  statusOptions: [],
  pendingOnly: true,
  onSearch: vi.fn(),
  onTogglePendingOnly: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<RequestFilterBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  const result = render(<RequestFilterBar {...props} />);

  return { ...result, ...props, user: userEvent.setup() };
};

const checkbox = (): HTMLElement => screen.getByRole('checkbox', { name: t.fields.pendingOnly });

describe('RequestFilterBar — 좁히는 축', () => {
  it('승인 유형 칸을 두지 않는다 — 그것은 조건이 아니라 이 화면의 정체다', () => {
    renderBar();

    /* 선행 단언 — 조건 칸이 실제로 그려져야 「유형 칸이 없다」가 뜻을 갖는다. */
    expect(screen.getByLabelText(t.fields.status)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.approvalTypeCode)).not.toBeInTheDocument();
  });

  it('조건 칸이 넷이다 — 상태·상신일·요청번호·「결재 대기만 보기」', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.status)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.period)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.q)).toBeInTheDocument();
    expect(checkbox()).toBeInTheDocument();
  });
});

describe('RequestFilterBar — 자리표시 선택칸', () => {
  it('값 목록이 비면 왜 비었는지 밝힌다', () => {
    renderBar();

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
    expect(screen.getByText(messages.pendingCode.placeholder)).toBeInTheDocument();
  });

  it('값 목록이 비어도 조회와 초기화는 열려 있다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
  });

  it('값이 오면 선택칸이 살아난다 — 자리표시가 죽은 가지가 아니다', () => {
    renderBar({ statusOptions: toCodeOptions(['SAMPLE-STATUS-OPEN']) });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
    /* 「전체」가 붙는다 — 한 번 고른 뒤 해제할 방법이 칸 안에 생긴다. */
    expect(screen.getByLabelText(t.fields.status)).toHaveTextContent(t.filters.all);
  });

  it('값이 오면 그 값을 고를 수 있다', async () => {
    const { onSearch, user } = renderBar({
      statusOptions: toCodeOptions(['SAMPLE-STATUS-OPEN', 'SAMPLE-STATUS-DONE']),
    });

    await user.click(screen.getByLabelText(t.fields.status));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-STATUS-DONE' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_FILTERS, statusCode: 'SAMPLE-STATUS-DONE' });
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

/**
 * **이 칸만 트리거 모델이 다르다.** 조건이 아니라 조회 범위라 누르는 즉시 반영된다 —
 * 앞선 화면에서 탭이 하던 일이고, 탭도 누르는 순간 옮겨졌다.
 */
describe('RequestFilterBar — 「결재 대기만 보기」는 즉시다', () => {
  it('기본이 켜짐이다', () => {
    renderBar();

    expect(checkbox()).toBeChecked();
  });

  it('끄면 조회를 누르지 않아도 곧바로 알린다', async () => {
    const { onTogglePendingOnly, onSearch, user } = renderBar();

    await user.click(checkbox());

    expect(onTogglePendingOnly).toHaveBeenCalledWith(false);
    /* 조회 경로를 함께 타지 않는다 — 두 길로 나가면 주소가 두 번 갱신된다. */
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('꺼진 채로 들어오면 꺼져 보이고, 다시 켜면 그 사실을 알린다', async () => {
    const { onTogglePendingOnly, user } = renderBar({ pendingOnly: false });

    expect(checkbox()).not.toBeChecked();

    await user.click(checkbox());

    expect(onTogglePendingOnly).toHaveBeenCalledWith(true);
  });

  /**
   * 편집 상태를 두면 「눌렀는데 목록이 그대로인」 칸이 된다 — 적용된 값을 그대로 보인다.
   * 부모가 아직 주소를 갈지 않았으면 칸도 아직 바뀌지 않는다.
   */
  it('적용된 값을 그대로 보인다 — 자기 편집 상태를 갖지 않는다', async () => {
    const props = baseProps();
    const { rerender } = render(<RequestFilterBar {...props} />);
    const user = userEvent.setup();

    await user.click(checkbox());

    expect(checkbox()).toBeChecked();

    rerender(<RequestFilterBar {...props} pendingOnly={false} />);

    expect(checkbox()).not.toBeChecked();
  });

  it('조건 편집과 서로를 건드리지 않는다', async () => {
    const { user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(checkbox());

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYNTH');
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

  /** 확인칸은 자기 상태를 스스로 보인다 — 같은 사실이 두 자리에 서면 갈릴 자리가 생긴다. */
  it('「결재 대기만 보기」는 칩으로 서지 않는다', () => {
    renderBar({ pendingOnly: false });

    expect(checkbox()).not.toBeChecked();
    expect(screen.queryByText(t.fields.pendingOnly, { selector: '.chip' })).not.toBeInTheDocument();
  });
});
