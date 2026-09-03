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
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<ProgressFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<ProgressFilterBar {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const periodTrigger = (): HTMLElement => screen.getByLabelText(t.fields.period);

const applied = (overrides: Partial<ProgressFilters> = {}): ProgressFilters => ({
  ...DEFAULT_PROGRESS_FILTERS,
  ...overrides,
});

describe('ProgressFilterBar — 여덟 축이 선다', () => {
  it('여덟 조건 칸이 모두 있고 라벨이 각 칸에 이어져 있다', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.documentType)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.status)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.period)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.item)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.lot)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.warehouse)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.fields.cancellableOnly })).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.q)).toBeInTheDocument();
  });

  it('기간 칸이 하나뿐이다', () => {
    renderBar();

    expect(screen.getAllByLabelText(t.fields.period)).toHaveLength(1);
  });

  /* 번호로만 좁힌다는 사실을 화면이 말해야 이름을 치다 빈 결과를 보는 일이 없다. */
  it('번호로 좁힌다는 사실을 적는다', () => {
    renderBar();

    expect(screen.getByText(t.filters.idNote)).toBeInTheDocument();
  });

  /*
   * 기본 기간을 심지 않는다는 사실도 화면이 밝힌다 — **비어 있는 칸이 고장으로 읽히지 않게**
   * 한다(전례 `disposal-issue/gi-filter-bar.tsx`의 `periodNote`와 같은 자리).
   */
  it('기본 기간이 없다는 사실을 적는다', () => {
    renderBar();

    expect(screen.getByText(t.filters.periodNote)).toBeInTheDocument();
  });
});

describe('ProgressFilterBar — 모아서 적용', () => {
  it('적용된 조건이 컨트롤에 서 있다', () => {
    renderBar({ appliedFilters: applied({ q: 'SYN-GR', item: '9301' }) });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYN-GR');
    expect(screen.getByLabelText(t.fields.item)).toHaveValue('9301');
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
    await user.type(screen.getByLabelText(t.fields.lot), '9601');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ q: 'SYN-GR', lot: '9601' }));
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

    await user.click(screen.getByRole('checkbox', { name: t.fields.cancellableOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ cancellableOnly: true }));
  });

  it('적용된 조건이 체크에 서 있다', () => {
    renderBar({ appliedFilters: applied({ cancellableOnly: true }) });

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
    await user.click(screen.getByRole('checkbox', { name: t.fields.cancellableOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenLastCalledWith(DEFAULT_PROGRESS_FILTERS);
  });
});

describe('ProgressFilterBar — 자리표시 코드 셋', () => {
  /**
   * **값을 지어내지 않는다.** 고를 것이 없는데 「전체」만 있으면 목록이 준비된 것처럼 보인다 —
   * 왜 비었는지는 안내가 말한다. 유형과 상태 두 칸이 같은 안내를 쓴다.
   */
  it('값 목록이 비면 사유가 보인다', () => {
    renderBar();

    expect(screen.getAllByText(messages.pendingCode.note)).toHaveLength(2);
  });

  /**
   * ⭐ **「전체」도 붙이지 않는다 — 선택칸을 열어서 센다.**
   *
   * ⛔ 닫힌 채로 `queryByRole('option')`을 재면 안 된다. 디자인 시스템 `Select`는 닫힌 상태에서
   * 옵션을 렌더하지 않으므로 그 단언은 **구현과 무관하게 늘 통과**한다 — 빈 목록에 「전체」를
   * 붙이도록 고쳐도 아무 감지기가 울리지 않는다.
   */
  it('값 목록이 비면 열어도 고를 것이 없다 — 「전체」도 없다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.documentType));

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.queryByText(t.filters.all)).not.toBeInTheDocument();
  });

  /* 짝 방향 — 값이 있으면 「전체」가 붙는다(앞 단언이 늘 참이 아니다). */
  it('값 목록이 있으면 「전체」가 앞에 붙는다', async () => {
    const { user } = renderBar({
      documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures),
    });

    await user.click(screen.getByLabelText(t.fields.documentType));

    const options = screen.getAllByRole('option');

    /*
     * 글자를 통째로 견주지 않는다 — 고른 항목에는 디자인 시스템이 확인 표식을 함께 넣어
     * 텍스트가 라벨보다 길다. 차례와 라벨 포함 여부만 잰다.
     */
    expect(options).toHaveLength(4);
    [t.filters.all, '합성 유형 가', '합성 유형 나', '합성 유형 다'].forEach((label, index) => {
      expect(options[index]).toHaveTextContent(label);
    });
  });

  /**
   * 보조 문구는 **보이기만 해서는 안 되고** 선택칸의 접근 이름에 이어져 있어야 한다 —
   * 잠기지 않은 칸이라도 스크린리더 사용자는 그 문구를 칸과 잇지 못하면 왜 비었는지 모른다.
   */
  it('준비 중 안내가 선택칸의 설명으로 이어져 있다', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.documentType)).toHaveAccessibleDescription(
      messages.pendingCode.note,
    );
  });

  /* ⚠ 비어 있어도 아무것도 잠그지 않는다 — 잠그면 무엇을 채워야 열리는지 읽을 수 없다. */
  it('비어 있어도 조회·초기화가 잠기지 않는다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
  });

  /* ⭐ 전환 감지기 — 표를 채우면 고를 수 있고 그 칸의 안내가 사라진다. */
  it('유형 표를 채우면 고를 수 있고 그 안내가 사라진다', async () => {
    const { onSearch, user } = renderBar({
      documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures),
    });

    /* 상태 칸의 안내 하나만 남는다 — 유형 칸의 것이 사라졌다는 뜻이다. */
    expect(screen.getAllByText(messages.pendingCode.note)).toHaveLength(1);

    await user.click(screen.getByLabelText(t.fields.documentType));
    await user.click(screen.getByRole('option', { name: '합성 유형 나' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ documentType: 'GOODS_ISSUE' }));
  });

  it('상태 표를 채우면 고를 수 있다', async () => {
    const { onSearch, user } = renderBar({
      statusOptions: [{ value: 'SYN_STATUS_A', label: 'SYN_STATUS_A' }],
    });

    await user.click(screen.getByLabelText(t.fields.status));
    await user.click(screen.getByRole('option', { name: 'SYN_STATUS_A' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(applied({ status: 'SYN_STATUS_A' }));
  });

  it('값 목록이 차면 「전체」로 되돌릴 수 있다', async () => {
    const { user } = renderBar({
      documentTypeOptions: toDocumentTypeOptions(documentTypeFixtures),
    });

    await user.click(screen.getByLabelText(t.fields.documentType));

    expect(screen.getByRole('option', { name: t.filters.all })).toBeInTheDocument();
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
