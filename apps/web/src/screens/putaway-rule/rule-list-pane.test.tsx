import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ITEM_LABEL, LOCATION_LABEL, UOM_LABEL, ruleViewFixtures } from './fixtures';
import { toPageView } from './pagination';
import { RULE_COLUMN_WIDTH, RuleListPane, type RuleListPaneProps } from './rule-list-pane';

const t = messages.putawayRule;

const labelOf = (id: number | null, named: string, matched: number): string =>
  id === matched ? named : t.values.unknown;

const baseProps = (overrides: Partial<RuleListPaneProps> = {}): RuleListPaneProps => ({
  rules: ruleViewFixtures,
  isLoading: false,
  pageView: toPageView(
    { page: 1, size: 20, total: ruleViewFixtures.length },
    ruleViewFixtures.length,
  ),
  onChangePage: vi.fn(),
  selectedRuleId: null,
  onSelect: vi.fn(),
  itemLabel: (itemId) => labelOf(itemId, ITEM_LABEL, 9101),
  locationLabel: (locationId) =>
    locationId === null ? t.values.warehouseWide : labelOf(locationId, LOCATION_LABEL, 9301),
  uomLabel: (uomId) => labelOf(uomId, UOM_LABEL, 9401),
  loadError: null,
  ...overrides,
});

const renderPane = (overrides: Partial<RuleListPaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<RuleListPane {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

/**
 * 렌더된 열 폭 — **산출물 쪽을 잰다**(사본 체크리스트 8번).
 *
 * 디자인 시스템 표가 `<colgroup><col style="width: …">`로 폭을 낸다. 선언만 읽으면 폭 상수와
 * 실제 산출물이 어긋나도 잡히지 않으므로 선언과 산출물 두 자리를 각각 잰다.
 */
const renderedColWidths = (): (string | undefined)[] =>
  Array.from(screen.getByRole('table').querySelectorAll('col')).map((col) => {
    const width = (col as HTMLElement).style.width;

    return width === '' ? undefined : width;
  });

describe('RuleListPane — 행', () => {
  it('열은 다섯이다 — 우선순위·품목·위치·용량·사용', () => {
    renderPane();

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      t.fields.priorityNo,
      t.fields.item,
      t.fields.location,
      t.fields.capacity,
      t.fields.status,
    ]);
  });

  it('용량은 수량과 단위를 함께 낸다 — 수량만으로는 크고 작음을 판단할 수 없다', () => {
    renderPane();

    expect(screen.getByText(t.values.capacity('500', UOM_LABEL))).toBeInTheDocument();
  });

  /** 위치를 비운 규칙은 「창고 전체」다. 값이 빠진 것이 아니라 확정된 뜻이다. */
  it('위치를 비운 규칙은 창고 전체로 보인다', () => {
    renderPane();

    expect(screen.getByText(t.values.warehouseWide)).toBeInTheDocument();
  });

  /** 이름을 못 푼 값은 「알 수 없음」으로 서고 **내부 번호가 화면에 서지 않는다**(`omf-mes#44`). */
  it('이름을 못 푼 값에 내부 번호를 대신 내지 않는다', () => {
    renderPane();

    expect(screen.getAllByText(t.values.unknown).length).toBeGreaterThan(0);
    expect(screen.getByRole('table').textContent).not.toContain('9199');
    expect(screen.getByRole('table').textContent).not.toContain('9399');
  });

  /** 꺼진 규칙이 목록에 보이고 다시 켜는 것이 이 마스터의 정상 운용이다(이슈 §6). */
  it('사용 안 함 행에 표식이 붙는다', () => {
    renderPane();

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
  });

  it('사용 중 행에는 사용 중이 적힌다', () => {
    renderPane();

    expect(screen.getAllByText(t.values.active).length).toBeGreaterThan(0);
  });

  /** 우선순위는 작을수록 먼저다 — 이 방향은 데이터에 없고 계약이 정한 것이다. */
  it('우선순위를 그대로 보인다', () => {
    renderPane();

    expect(screen.getByText('10')).toBeInTheDocument();
  });

  /**
   * 보이는 글자(품목 이름)가 행마다 같을 수 있다 — 같은 품목의 위치별 규칙이 여럿 설 수 있어
   * 위치를 함께 담는다. 내부 번호는 접근 이름에도 넣지 않는다.
   */
  it('고르기 버튼의 접근 이름이 품목과 위치를 함께 담는다', () => {
    renderPane();

    const button = screen.getByRole('button', {
      name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL),
    });

    expect(button).toBeInTheDocument();
    expect(button.getAttribute('aria-label')).not.toContain('9001');
  });

  it('행을 고르면 그 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(
      screen.getByRole('button', { name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL) }),
    );

    expect(onSelect).toHaveBeenCalledWith(9001);
  });

  it('고른 행을 표시한다', () => {
    renderPane({ selectedRuleId: 9001 });

    expect(
      screen.getByRole('button', { name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL) }),
    ).toHaveAttribute('aria-current', 'true');
  });
});

describe('RuleListPane — 표 규율', () => {
  /**
   * `getRowId` 미지정이면 인덱스가 React key가 되어, 앞 줄이 사라질 때 치고 있던 칸의 DOM
   * 노드가 대신 지워지고 포커스가 말없이 다른 줄로 옮겨 붙는다(사본 체크리스트 2번).
   */
  it('앞 줄이 사라져도 고른 줄의 포커스가 남는다', async () => {
    const { rerender, user } = renderPane();
    const name = t.actions.selectRow(t.values.unknown, t.values.unknown);

    await user.click(screen.getByRole('button', { name }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name }));

    rerender(<RuleListPane {...baseProps({ rules: ruleViewFixtures.slice(1) })} />);

    expect(document.activeElement).toBe(screen.getByRole('button', { name }));
  });

  /** 선언과 산출물 두 자리를 각각 잰다 — 한 자리만 재면 둘이 어긋나도 잡히지 않는다. */
  it('폭 선언이 산출물에 그대로 실린다', () => {
    renderPane();

    expect(renderedColWidths()).toEqual([
      RULE_COLUMN_WIDTH.priorityNo,
      undefined,
      undefined,
      RULE_COLUMN_WIDTH.capacity,
      RULE_COLUMN_WIDTH.status,
    ]);
  });

  /** 흡수 열이 셋이면 좁은 칸에서 셋 다 짓눌린다. 이름 열 둘만 흡수 열로 둔다. */
  it('흡수 열은 이름 열 둘뿐이다', () => {
    renderPane();

    expect(renderedColWidths().filter((width) => width === undefined)).toHaveLength(2);
  });
});

describe('RuleListPane — 빈 상태와 실패', () => {
  /**
   * **조회 실패 → 로딩 → 표 순서로 하나만 낸다.** 먼저 로딩을 보면 실패한 조회가 영원히
   * 「불러오는 중」으로 보이고, 사용자는 기다리면 될 일이라고 읽는다(사본 대조 추가 ①).
   */
  it('실패는 로딩보다 앞에서 판정한다', () => {
    renderPane({ isLoading: true, loadError: <p>조회 실패</p> });

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading.list })).not.toBeInTheDocument();
  });

  it('실패했는데 빈 표를 함께 보이지 않는다', () => {
    renderPane({ rules: [], loadError: <p>조회 실패</p> });

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불러오는 중임을 이름으로 밝힌다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.list })).toBeInTheDocument();
  });

  it('0건이면 빈 상태 문구가 서고 행이 없다', () => {
    renderPane({
      rules: [],
      pageView: toPageView({ page: 1, size: 20, total: 0 }, 0),
    });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /선택$/ })).not.toBeInTheDocument();
  });

  /**
   * 결과는 있는데 이 쪽에 없다 — 「등록된 규칙이 없습니다」로 내면 거짓말이 된다.
   * 돌아갈 길을 함께 준다.
   */
  it('범위 밖 쪽은 빈 상태가 갈리고 첫 쪽으로 돌아갈 길이 있다', async () => {
    const { onChangePage, user } = renderPane({
      rules: [],
      pageView: toPageView({ page: 9, size: 20, total: 45 }, 0),
    });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });

  /**
   * 사용 중 건수는 **이 쪽 안에서 센 수다.** 전체 건수는 서버가 주지만 사용 중 건수는 주지
   * 않으므로 범위를 밝히지 않으면 전체 수로 읽힌다.
   */
  it('이 쪽의 사용 중 건수를 범위와 함께 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.notes.activeCountInPage(3))).toBeInTheDocument();
  });

  it('쪽 이동이 함께 선다', () => {
    renderPane();

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});

/**
 * **위치·단위는 고르는 칸이 없어 표가 잘림을 말하는 유일한 자리다.**
 * 밝히지 않으면 잘린 목록으로 이름을 푼 정상 규칙이 「알 수 없음」으로 보이고, 그 문구는
 * *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
 */
describe('RuleListPane — 이름 목록 잘림 안내', () => {
  it('안내가 없으면 아무것도 서지 않는다', () => {
    renderPane();

    expect(screen.queryByText(t.notes.nameLookupTruncated)).not.toBeInTheDocument();
  });

  it('안내를 받으면 표 아래에 선다', () => {
    renderPane({ nameLookupNote: t.notes.nameLookupTruncated });

    expect(screen.getByText(t.notes.nameLookupTruncated)).toBeInTheDocument();
  });

  /** 표를 어떻게 읽어야 하는지 말하는 문장이 건수보다 앞서야 한다. */
  it('잘림 안내가 사용 중 건수보다 앞에 선다', () => {
    renderPane({ nameLookupNote: t.notes.nameLookupTruncated });

    const note = screen.getByText(t.notes.nameLookupTruncated);
    const count = screen.getByText(t.notes.activeCountInPage(3));

    expect(note.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /** 실패했으면 표를 내지 않으므로 그 안내도 서지 않는다 — 두 사실이 겹쳐 서면 안 된다. */
  it('조회가 실패한 동안에는 서지 않는다', () => {
    renderPane({ nameLookupNote: t.notes.nameLookupTruncated, loadError: <p>조회 실패</p> });

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.queryByText(t.notes.nameLookupTruncated)).not.toBeInTheDocument();
  });
});
