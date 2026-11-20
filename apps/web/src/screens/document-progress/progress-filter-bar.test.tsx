import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDate, pickRange } from '../../test/date-picker';
import { toDocumentTypeOptions } from './document-types';
import { DEFAULT_PROGRESS_FILTERS, type ProgressFilters } from './filters';
import { documentTypeFixtures } from './fixtures';
import { ProgressFilterBar, type ProgressFilterBarProps } from './progress-filter-bar';

const t = messages.documentProgress;

const baseProps = (overrides: Partial<ProgressFilterBarProps> = {}): ProgressFilterBarProps => ({
  appliedFilters: DEFAULT_PROGRESS_FILTERS,
  documentTypeOptions: [],
  statusOptions: [],
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<ProgressFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<ProgressFilterBar {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const periodTrigger = (): HTMLElement => screen.getByLabelText(t.fields.period);

/** 「조건 더보기」를 편다 — 상태 · 지금 취소 가능한 것만을 쓰는 시험은 먼저 편다. */
const openMore = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
};

const applied = (overrides: Partial<ProgressFilters> = {}): ProgressFilters => ({
  ...DEFAULT_PROGRESS_FILTERS,
  ...overrides,
});

describe('ProgressFilterBar — 다섯 축이 선다', () => {
  /* C-6 — 보이는 칸은 문서 유형 · 문서 일자 · 문서번호 셋이고, 상태 · 지금 취소 가능한 것만은 접혀 있다. */
  it('세 칸이 보이고 둘은 「조건 더보기」에 접혀 있다 — 라벨이 각 칸에 이어져 있다', async () => {
    const { user } = renderBar();

    expect(screen.getByLabelText(t.fields.documentType)).toBeVisible();
    expect(screen.getByLabelText(t.fields.period)).toBeVisible();
    expect(screen.getByLabelText(t.fields.q)).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: t.fields.cancellableOnly }),
    ).not.toBeInTheDocument();

    await openMore(user);

    expect(screen.getByLabelText(t.fields.status)).toBeVisible();
    expect(screen.getByRole('checkbox', { name: t.fields.cancellableOnly })).toBeVisible();
  });

  it('기간 칸이 하나뿐이다', () => {
    renderBar();

    expect(screen.getAllByLabelText(t.fields.period)).toHaveLength(1);
  });

  /* 걷은 번호 칸(품목 · 자재 LOT · 창고)과 칸 아래 안내가 다시 생기지 않는다(사용자 지시 2026-11-19). */
  it('번호 칸과 안내 문장이 없다', () => {
    const { container } = renderBar();

    expect(screen.queryByRole('textbox', { name: /번호$/u })).not.toBeInTheDocument();
    expect(container.querySelector('p.field-note')).toBeNull();
  });
});

describe('ProgressFilterBar — 모아서 적용', () => {
  it('적용된 조건이 컨트롤에 서 있다', async () => {
    const { user } = renderBar({ appliedFilters: applied({ q: 'SYN-GR', cancellableOnly: true }) });

    await openMore(user);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYN-GR');
    expect(screen.getByRole('checkbox', { name: t.fields.cancellableOnly })).toBeChecked();
  });

  /* 조건을 고치는 동안 조회가 나가면 반쯤 지운 검색어로 요청이 나간다. */
  it('입력만으로는 조회하지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SY');

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('조회를 누르면 지금 고친 조건이 통째로 나간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');
    await openMore(user);
    await user.click(screen.getByRole('checkbox', { name: t.fields.cancellableOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ q: 'SYN-GR', cancellableOnly: true }));
  });

  it('검색칸에서 엔터로도 조회된다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR{Enter}');

    expect(onSearch).toHaveBeenCalledWith(applied({ q: 'SYN-GR' }));
  });
});

describe('ProgressFilterBar — 기간은 한 컨트롤이다', () => {
  it('시작·종료를 함께 고르면 두 값이 함께 나간다', async () => {
    const { onSearch, user } = renderBar();

    await pickRange(user, periodTrigger(), '2026-08-01', '2026-08-05');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ from: '2026-08-01', to: '2026-08-05' }));
  });

  /*
   * ⭐ **완결된 쌍만 방출된다.** 시작만 고른 중간 상태에서 조회하면 한쪽만 실린 기간이 나가는데,
   * 컴포넌트가 그 상태를 방출하지 않으므로 조건은 그대로 비어 있다.
   */
  it('시작만 고른 중간 상태는 조건에 실리지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await pickDate(user, periodTrigger(), '2026-08-01');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(DEFAULT_PROGRESS_FILTERS);
  });

  /* 반쪽 값도 **표시**는 된다 — 고르는 중인 것이 화면에서 사라지면 사용자가 되짚을 수 없다. */
  it('반쪽으로 걸린 기간도 컨트롤에 보인다', () => {
    renderBar({ appliedFilters: applied({ from: '2026-08-01' }) });

    expect(periodTrigger()).toHaveTextContent('2026-08-01');
  });
});

describe('ProgressFilterBar — 취소 가능 조건', () => {
  it('끈 상태로 조회하면 꺼진 채 나간다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ cancellableOnly: false }));
  });

  it('켜면 켜진 채 나간다', async () => {
    const { onSearch, user } = renderBar();

    await openMore(user);
    await user.click(screen.getByRole('checkbox', { name: t.fields.cancellableOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ cancellableOnly: true }));
  });

  it('적용된 조건이 체크에 서 있다', async () => {
    const { user } = renderBar({ appliedFilters: applied({ cancellableOnly: true }) });

    await openMore(user);

    expect(screen.getByRole('checkbox', { name: t.fields.cancellableOnly })).toBeChecked();
  });
});

describe('ProgressFilterBar — 초기화', () => {
  /**
   * 날짜 컨트롤에 값 비우기가 없어(설치본 실측) 기간을 푸는 길이 「초기화」뿐이다.
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 **고른 기간이 그대로 남는다.**
   */
  it('초기화가 자기 편집 상태까지 비운다', async () => {
    const { onReset, onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');
    await pickRange(user, periodTrigger(), '2026-08-01', '2026-08-05');
    await openMore(user);
    await user.click(screen.getByRole('checkbox', { name: t.fields.cancellableOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenLastCalledWith(DEFAULT_PROGRESS_FILTERS);
  });
});

describe('ProgressFilterBar — 선택지', () => {
  /*
   * ⭐ **유형에는 「전체」가 없다** — 유형을 정해야 조회가 성립한다. 선택칸을 열어서 센다(디자인 시스템
   * `Select`는 닫힌 상태에서 옵션을 렌더하지 않는다).
   */
  it('유형 선택지는 유형 표 그대로이고 「전체」가 없다', async () => {
    const { user } = renderBar({
      documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures),
    });

    expect(screen.getByLabelText(t.fields.documentType)).toHaveTextContent(t.filters.choose);

    await user.click(screen.getByLabelText(t.fields.documentType));

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(3);
    ['합성 유형 가', '합성 유형 나', '합성 유형 다'].forEach((label, index) => {
      expect(options[index]).toHaveTextContent(label);
    });
  });

  it('유형을 고르면 조회에 실린다', async () => {
    const { onSearch, user } = renderBar({
      documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures),
    });

    await user.click(screen.getByLabelText(t.fields.documentType));
    await user.click(screen.getByRole('option', { name: '합성 유형 나' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ documentType: 'GOODS_ISSUE' }));
  });

  /* 상태는 공통코드에서 온다. 「전체」가 앞에 붙어 상태 조건을 풀 수 있다. */
  it('상태 선택지는 「전체」 다음에 코드가 온다', async () => {
    const { onSearch, user } = renderBar({
      statusOptions: [{ value: 'SYN_STATUS_A', label: '합성 상태 가' }],
    });

    await openMore(user);
    await user.click(screen.getByLabelText(t.fields.status));

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent(t.filters.all);

    await user.click(screen.getByRole('option', { name: '합성 상태 가' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ status: 'SYN_STATUS_A' }));
  });

  /* 코드 목록을 못 받았어도 「전체」로 조회할 수 있다 — 「선택지 준비 중」 안내를 세우지 않는다. */
  it('상태 코드를 못 받았으면 「전체」만 있다', async () => {
    const { user } = renderBar();

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();

    await openMore(user);
    await user.click(screen.getByLabelText(t.fields.status));

    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  /* 초기화는 바뀐 것이 있을 때만 보인다(C-6) — 걸린 조건을 두고 잰다. */
  it('조회·초기화는 잠기지 않는다', () => {
    renderBar({ appliedFilters: applied({ q: 'SYN-GR' }) });

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
  });

  it('처음 조건에서는 초기화가 없고, 칸을 고치면 나타난다', async () => {
    const { user } = renderBar();

    expect(screen.queryByRole('button', { name: messages.common.reset })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(t.fields.q), 'S');

    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
  });
});

describe('ProgressFilterBar — 접힌 조건 칩', () => {
  const STATUS_OPTIONS = [{ value: 'SYN_STATUS_A', label: '합성 상태 가' }];

  /* C-6 — 접힌 칸에 걸린 조건만 칩이 된다. 보이는 칸(문서번호 등)의 값은 칩으로 겹쳐 적지 않는다. */
  it('접힌 상태 · 지금 취소 가능한 것만에 걸린 값이 이름으로 칩이 되고, ×가 그 조건만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      statusOptions: STATUS_OPTIONS,
      appliedFilters: applied({ status: 'SYN_STATUS_A', cancellableOnly: true, q: 'SYN-GR' }),
    });

    expect(screen.getByText(t.filters.chipStatus('합성 상태 가'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.filters.chipRemoveCancellableOnly }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /조건 제거$/u })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveStatus }));

    expect(onRemoveFilter).toHaveBeenCalledWith('status');
  });

  it('펼치면 칸에 값이 보이므로 칩을 거둔다', async () => {
    const { user } = renderBar({
      statusOptions: STATUS_OPTIONS,
      appliedFilters: applied({ status: 'SYN_STATUS_A' }),
    });

    await openMore(user);

    expect(screen.queryByText(t.filters.chipStatus('합성 상태 가'))).not.toBeInTheDocument();
  });

  it('접힌 칸에 걸린 조건이 없으면 칩이 없다', () => {
    renderBar({ appliedFilters: applied({ q: 'SYN-GR' }) });

    /* 선행 단언 — 조건 줄이 실제로 그려져야 「칩이 없다」가 뜻을 갖는다. */
    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /조건 제거$/u })).not.toBeInTheDocument();
  });
});

describe('ProgressFilterBar — 고를 수 없는 유형', () => {
  /* 목록에서 빼면 왜 그 유형이 없는지 화면 어디에서도 읽을 수 없다 — 두되 비활성한다. */
  it('사유를 글자로 낸다', () => {
    renderBar({
      documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures),
      disabledTypeNote: t.filters.disabledTypes('합성 유형 다: 상태 컬럼이 없습니다'),
    });

    expect(screen.getByText(/합성 유형 다: 상태 컬럼이 없습니다/)).toBeInTheDocument();
  });

  it('막힌 유형이 없으면 그 안내가 없다', () => {
    renderBar({ documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures) });

    expect(screen.queryByText(/고를 수 없는 유형이 있습니다/)).not.toBeInTheDocument();
  });

  it('막힌 유형의 선택지가 잠겨 있다', async () => {
    const { user } = renderBar({
      documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures),
    });

    await user.click(screen.getByLabelText(t.fields.documentType));

    expect(screen.getByRole('option', { name: '합성 유형 다' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('option', { name: '합성 유형 가' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('ProgressFilterBar — 주소가 정본이다', () => {
  /**
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모가 다시 그려질 때마다 되돌리면
   * 조회 응답이 도착하는 순간 사용자가 치던 값이 사라진다.
   */
  it('내용이 같은 새 객체로 다시 그려도 치던 값이 남는다', async () => {
    const props = baseProps();
    const { rerender } = render(<ProgressFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');

    rerender(<ProgressFilterBar {...props} appliedFilters={{ ...DEFAULT_PROGRESS_FILTERS }} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYN-GR');
  });

  it('주소의 값이 실제로 바뀌면 그 값으로 되돌아간다', async () => {
    const props = baseProps();
    const { rerender } = render(<ProgressFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');

    rerender(<ProgressFilterBar {...props} appliedFilters={applied({ q: 'SYN-9999' })} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYN-9999');
  });

  /*
   * 켬/끔도 되돌림에 함께 실린다 — 한 축만 되돌리면 화면과 주소가 갈린다.
   *
   * **다른 축이 바뀔 때 이 축이 주소 값으로 돌아오는지**를 잰다. 이 축만 바꿔서는 잴 수 없다:
   * 사용자가 만든 값과 되돌아간 값이 같아져 「되돌렸다」와 「안 되돌렸다」가 구분되지 않는다.
   */
  it('다른 조건이 바뀌면 취소 가능 조건도 주소 값으로 돌아온다', async () => {
    const props = baseProps({ appliedFilters: applied({ cancellableOnly: true }) });
    const { rerender } = render(<ProgressFilterBar {...props} />);
    const user = userEvent.setup();

    await openMore(user);
    await user.click(screen.getByRole('checkbox', { name: t.fields.cancellableOnly }));
    expect(screen.getByRole('checkbox', { name: t.fields.cancellableOnly })).not.toBeChecked();

    rerender(
      <ProgressFilterBar
        {...props}
        appliedFilters={applied({ cancellableOnly: true, q: 'SYN-GR' })}
      />,
    );

    expect(screen.getByRole('checkbox', { name: t.fields.cancellableOnly })).toBeChecked();
  });
});
