import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BUSINESS_UNIT_LABEL, routeViewFixtures } from './fixtures';
import { toPageView } from './pagination';
import { ROUTE_COLUMN_WIDTH, RouteListPane, type RouteListPaneProps } from './route-list-pane';

const t = messages.approvalRoute;

/** 좌 칸의 폭 예산. 1280px 창에서 약 370px, 1600px 창에서도 600px을 넘지 않는다. */
const LEFT_PANE_BUDGET = 560;

const businessUnitLabel = (businessUnitId: number | null): string =>
  businessUnitId === null ? t.values.allBusinessUnits : BUSINESS_UNIT_LABEL;

const baseProps = (overrides: Partial<RouteListPaneProps> = {}): RouteListPaneProps => ({
  routes: routeViewFixtures,
  isLoading: false,
  pageView: toPageView(
    { page: 1, size: 20, total: routeViewFixtures.length },
    routeViewFixtures.length,
  ),
  onChangePage: vi.fn(),
  selectedRouteId: null,
  onSelect: vi.fn(),
  businessUnitLabel,
  loadError: null,
  ...overrides,
});

const renderPane = (overrides: Partial<RouteListPaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<RouteListPane {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const rowOf = (approvalTypeCode: string, index = 0): HTMLElement =>
  screen.getAllByRole('row').filter((row) => within(row).queryByText(approvalTypeCode) !== null)[
    index
  ] as HTMLElement;

describe('RouteListPane — 표', () => {
  it('결재선마다 한 줄을 낸다', () => {
    renderPane();

    // 머리글 한 줄 + 자료 세 줄
    expect(screen.getAllByRole('row')).toHaveLength(routeViewFixtures.length + 1);
  });

  it('사업부를 비운 결재선은 「전 사업부 공통」으로 읽힌다', () => {
    renderPane();

    const row = rowOf('GOODS_ISSUE_DISPOSAL', 1);

    expect(within(row).getByText(t.values.allBusinessUnits)).toBeInTheDocument();
  });

  it('사업부를 지정한 결재선은 이름으로 읽히고 번호가 보이지 않는다', () => {
    renderPane();

    const row = rowOf('GOODS_ISSUE_DISPOSAL', 0);

    expect(within(row).getByText(BUSINESS_UNIT_LABEL)).toBeInTheDocument();
    expect(row.textContent).not.toContain('9101');
    expect(row.textContent).not.toContain('9001');
  });

  it('단계가 0인 결재선에 표식이 선다', () => {
    renderPane();

    // 선행 단언 — 단계가 있는 줄은 수치로 읽힌다.
    expect(within(rowOf('GOODS_ISSUE_DISPOSAL', 0)).getByText('2')).toBeInTheDocument();
    expect(
      within(rowOf('GOODS_ISSUE_DISPOSAL', 1)).getByText(t.values.noSteps),
    ).toBeInTheDocument();
  });

  it('진행 중 건수를 응답 값 그대로 낸다', () => {
    renderPane();

    expect(within(rowOf('GOODS_ISSUE_DISPOSAL', 0)).getByText('3')).toBeInTheDocument();
    expect(within(rowOf('INVENTORY_ADJUSTMENT')).getByText('0')).toBeInTheDocument();
  });

  it('사용 여부를 글자로 낸다', () => {
    renderPane();

    expect(within(rowOf('GOODS_ISSUE_DISPOSAL', 0)).getByText(t.values.active)).toBeInTheDocument();
    expect(within(rowOf('INVENTORY_ADJUSTMENT')).getByText(t.values.inactive)).toBeInTheDocument();
  });
});

describe('RouteListPane — 고르기', () => {
  it('행을 누르면 그 결재선 번호를 준다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(
      screen.getByRole('button', {
        name: t.actions.selectRow('INVENTORY_ADJUSTMENT', BUSINESS_UNIT_LABEL),
      }),
    );

    expect(onSelect).toHaveBeenCalledWith(9003);
  });

  it('승인 유형이 같은 두 줄의 접근 이름이 갈린다', () => {
    // 승인 유형만으로는 줄이 갈리지 않는다 — 같은 유형의 사업부 지정본과 공통본이 함께 선다.
    renderPane();

    const names = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((name): name is string => name !== null && name.includes('GOODS_ISSUE_DISPOSAL'));

    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });

  it('고른 줄을 현재 위치로 밝힌다', () => {
    renderPane({ selectedRouteId: 9003 });

    const button = screen.getByRole('button', {
      name: t.actions.selectRow('INVENTORY_ADJUSTMENT', BUSINESS_UNIT_LABEL),
    });

    expect(button).toHaveAttribute('aria-current', 'true');
  });
});

describe('RouteListPane — 빈 상태와 실패', () => {
  it('결과가 없으면 표의 빈 자리가 안내를 맡는다', () => {
    renderPane({ routes: [], pageView: toPageView({ page: 1, size: 20, total: 0 }, 0) });

    // 바깥에서 0건을 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  it('범위 밖 쪽은 다른 안내를 낸다', () => {
    renderPane({ routes: [], pageView: toPageView({ page: 5, size: 20, total: 45 }, 0) });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('범위 밖에서는 첫 쪽으로 돌아갈 수 있다', async () => {
    const { onChangePage, user } = renderPane({
      routes: [],
      pageView: toPageView({ page: 5, size: 20, total: 45 }, 0),
    });

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });

  it('조회 실패는 빈 상태가 아니다', () => {
    renderPane({ routes: [], loadError: <p>조회 실패 배너</p> });

    expect(screen.getByText('조회 실패 배너')).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 자리 표시를 낸다', () => {
    renderPane({ routes: [], isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.list })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });
});

describe('RouteListPane — 열 폭 예산', () => {
  /**
   * 흡수 열이 둘이면 좁은 칸에서 둘 다 짓눌리고, 지정 폭 합이 예산을 넘으면 표가 칸을 넘친다.
   * `.wide-table`을 붙이지 않으므로(좌 칸 최소 폭 320px < 그 클래스의 하한 928px)
   * 폭 관리는 열 정의가 통째로 진다.
   */
  it('폭 없는 흡수 열이 하나뿐이고 지정 폭 합이 예산 안이다', () => {
    const { container } = renderPane();

    const cols = [...container.querySelectorAll('col')];
    const widths = cols.map((col) => col.style.width);

    expect(widths.filter((width) => width === '')).toHaveLength(1);

    const sum = Object.values(ROUTE_COLUMN_WIDTH).reduce(
      (total, width) => total + Number.parseInt(width, 10),
      0,
    );

    expect(sum).toBeLessThan(LEFT_PANE_BUDGET);
  });

  it('행 순서를 사용자가 바꿀 수 있는 표가 아니다', () => {
    // 목록의 순서는 자료가 아니다 — 순서 이동 열을 두면 뜻 없는 조작이 생긴다.
    renderPane();

    expect(screen.queryByRole('button', { name: '위로 이동' })).not.toBeInTheDocument();
  });
});
