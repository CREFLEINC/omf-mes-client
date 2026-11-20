import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { GiFilterBar, type GiFilterBarProps } from './gi-filter-bar';
import { DEFAULT_ISSUE_FILTERS, type IssueFilters } from './history-filters';

const t = messages.disposalIssue;

const baseProps = (overrides: Partial<GiFilterBarProps> = {}): GiFilterBarProps => ({
  appliedFilters: DEFAULT_ISSUE_FILTERS,
  issueTypeOptions: [],
  reasonOptions: [],
  statusOptions: [],
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<GiFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<GiFilterBar {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const periodTrigger = (): HTMLElement => screen.getByLabelText(t.historyFields.period);

const applied = (overrides: Partial<IssueFilters> = {}): IssueFilters => ({
  ...DEFAULT_ISSUE_FILTERS,
  ...overrides,
});

describe('GiFilterBar — 모아서 적용', () => {
  it('적용된 조건이 컨트롤에 서 있다', () => {
    renderBar({ appliedFilters: applied({ q: 'GI-2026' }) });

    expect(screen.getByLabelText(t.historyFields.q)).toHaveValue('GI-2026');
  });

  /* 조건을 고치는 동안 조회가 나가면 반쯤 지운 검색어로 요청이 나간다. */
  it('입력만으로는 조회하지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.historyFields.q), 'GI');

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('조회를 누르면 지금 고친 조건이 통째로 나간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.historyFields.q), 'GI-2026');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ q: 'GI-2026' }));
  });

  it('기간을 한 컨트롤에서 고르고 조회에 함께 싣는다', async () => {
    const { onSearch, user } = renderBar();

    await pickRange(user, periodTrigger(), '2026-08-01', '2026-08-05');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ from: '2026-08-01', to: '2026-08-05' }));
  });

  it('기간 칸이 하나뿐이다', () => {
    renderBar();

    expect(screen.getAllByLabelText(t.historyFields.period)).toHaveLength(1);
  });

  /**
   * **대상 조건 줄의 라벨과 겹치지 않는다.** 두 탭이 같은 낱말을 쓰면 한 화면 안에서 같은
   * 이름의 컨트롤이 둘이 되고, 이름으로 집는 조작·시험이 어느 것을 집었는지 알 수 없게 된다.
   */
  it('라벨이 대상 조건 줄과 다르다', () => {
    expect(t.historyFields.period).not.toBe(t.fields.period);
    expect(t.historyFields.q).not.toBe(t.fields.q);
  });

  /** 창고는 이 탭의 조건 축이 아니다 — 열로만 보인다(계획 §5.5). */
  it('창고 조건 칸을 두지 않는다', () => {
    renderBar();

    expect(screen.queryByLabelText(t.fields.warehouse)).not.toBeInTheDocument();
  });
});

describe('GiFilterBar — 초기화', () => {
  /**
   * 날짜 컨트롤에 값 비우기가 없어(설치본 실측) 기간을 푸는 길이 「초기화」뿐이다.
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 **고른 기간이 그대로 남는다.**
   */
  it('초기화가 자기 편집 상태까지 비운다', async () => {
    const { onReset, onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.historyFields.q), 'GI-2026');
    await pickRange(user, periodTrigger(), '2026-08-01', '2026-08-05');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenLastCalledWith(DEFAULT_ISSUE_FILTERS);
  });
});

describe('GiFilterBar — 자리표시 코드 셋', () => {
  /**
   * **값을 지어내지 않는다.** 고를 것이 없는데 「전체」만 있으면 목록이 준비된 것처럼 보인다 —
   * 왜 비었는지는 안내가 말한다.
   */
  it('값 목록이 비면 선택지가 없고 사유가 보인다', () => {
    renderBar();

    expect(screen.getAllByText(messages.pendingCode.note)).toHaveLength(3);
  });

  /* 초기화는 바뀐 것이 있을 때만 보인다(C-6) — 걸린 조건을 두고 잰다. */
  it('비어 있어도 아무것도 잠그지 않는다', () => {
    renderBar({ appliedFilters: applied({ q: 'GI-2026' }) });

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
  });

  /* 전환 감지기 — 값이 오면 고를 수 있고 안내가 사라진다. */
  it('값 목록이 차면 고를 수 있고 안내가 사라진다', async () => {
    const { onSearch, user } = renderBar({
      statusOptions: [{ value: 'SAMPLE_GI_STATUS_A', label: 'SAMPLE_GI_STATUS_A' }],
    });

    expect(screen.getAllByText(messages.pendingCode.note)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    await user.click(screen.getByLabelText(t.historyFields.status));
    await user.click(screen.getByRole('option', { name: 'SAMPLE_GI_STATUS_A' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ status: 'SAMPLE_GI_STATUS_A' }));
  });

  it('값 목록이 차면 「전체」로 되돌릴 수 있다', () => {
    renderBar({ reasonOptions: [{ value: 'SAMPLE_GI_REASON_A', label: 'SAMPLE_GI_REASON_A' }] });

    expect(screen.getByLabelText(t.historyFields.reason)).toBeEnabled();
  });
});

describe('GiFilterBar — 조건 칩', () => {
  /* C-6 — 보이는 칸(출고일 · 폐기 사유 · 출고번호)의 조건은 칩으로 겹쳐 적지 않는다. 접힌 출고 유형 · 상태만 칩이 된다. */
  it('접힌 칸에 걸린 조건만 칩이 된다', () => {
    renderBar({
      appliedFilters: applied({
        from: '2026-08-01',
        to: '2026-08-05',
        status: 'SAMPLE_GI_STATUS_A',
        q: 'GI-2026',
      }),
    });

    expect(screen.getByText(t.historyFilters.chipStatus('SAMPLE_GI_STATUS_A'))).toBeInTheDocument();
    expect(screen.queryByText(t.historyFilters.chipQ('GI-2026'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(t.historyFilters.chipPeriodBoth('2026-08-01', '2026-08-05')),
    ).not.toBeInTheDocument();
    /* 칩은 상태 하나이고 ×도 하나다. */
    expect(screen.getAllByRole('button', { name: /조건 해제$/ })).toHaveLength(1);
  });

  it('×를 누르면 그 조건만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: applied({ status: 'SAMPLE_GI_STATUS_A' }),
    });

    await user.click(screen.getByRole('button', { name: t.historyFilters.chipRemoveStatus }));

    expect(onRemoveFilter).toHaveBeenCalledWith('status');
  });

  it('출고 유형 · 상태는 「조건 더보기」에 접혀 있고, 펼치면 칩을 거둔다', async () => {
    const { user } = renderBar({ appliedFilters: applied({ status: 'SAMPLE_GI_STATUS_A' }) });
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });

    expect(more).toHaveAttribute('aria-expanded', 'false');

    await user.click(more);

    expect(screen.getByLabelText(t.historyFields.issueType)).toBeVisible();
    expect(screen.getByLabelText(t.historyFields.status)).toBeVisible();
    expect(
      screen.queryByText(t.historyFilters.chipStatus('SAMPLE_GI_STATUS_A')),
    ).not.toBeInTheDocument();
  });

  it('조건이 없으면 칩도 없다', () => {
    renderBar();

    /* 선행 단언 — 조건 줄이 실제로 그려져야 「칩이 없다」가 뜻을 갖는다. */
    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /조건 해제$/ })).not.toBeInTheDocument();
  });
});

describe('GiFilterBar — 주소가 정본이다', () => {
  /**
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모가 다시 그려질 때마다 되돌리면
   * 조회 응답이 도착하는 순간 사용자가 치던 값이 사라진다(`omf-mes#43`).
   */
  it('내용이 같은 새 객체로 다시 그려도 치던 값이 남는다', async () => {
    const props = baseProps();
    const { rerender } = render(<GiFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.historyFields.q), 'GI-2026');

    rerender(<GiFilterBar {...props} appliedFilters={{ ...DEFAULT_ISSUE_FILTERS }} />);

    expect(screen.getByLabelText(t.historyFields.q)).toHaveValue('GI-2026');
  });

  it('주소의 값이 실제로 바뀌면 그 값으로 되돌아간다', async () => {
    const props = baseProps();
    const { rerender } = render(<GiFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.historyFields.q), 'GI-2026');

    rerender(<GiFilterBar {...props} appliedFilters={applied({ q: 'GI-9999' })} />);

    expect(screen.getByLabelText(t.historyFields.q)).toHaveValue('GI-9999');
  });
});
