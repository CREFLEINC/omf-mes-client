import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_ITEM_FILTERS } from './filters';
import { itemFixtures } from './fixtures';
import { ItemListPane } from './item-list-pane';
import { toPageView } from './pagination';
import type { ItemFilters } from './types';

const pageView = (page = 1, total = itemFixtures.length, shown = itemFixtures.length) =>
  toPageView({ page, size: 50, total }, shown);

const renderPane = (overrides: Partial<Parameters<typeof ItemListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn<(next: ItemFilters) => void>();
  const onSelect = vi.fn<(itemId: number) => void>();
  const onChangePage = vi.fn<(page: number) => void>();

  render(
    <ItemListPane
      items={itemFixtures}
      isLoading={false}
      appliedFilters={EMPTY_ITEM_FILTERS}
      onApplyFilters={onApplyFilters}
      pageView={pageView()}
      onChangePage={onChangePage}
      selectedItemId={null}
      onSelect={onSelect}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect, onChangePage, user: userEvent.setup() };
};

describe('ItemListPane — 목록', () => {
  it('품목코드와 품목명 두 열만 낸다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['품목코드', '품목명']);
  });

  it('품목코드를 눌러 고른다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01' }));

    expect(onSelect).toHaveBeenCalledWith(1001);
  });

  it('고른 행을 표시한다', () => {
    renderPane({ selectedItemId: 1001 });

    expect(screen.getByRole('button', { name: 'SYN-ITEM-01' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /* 좁은 좌 페인에서 열 하나를 더 두면 이름 열이 짓눌린다 — 이름 뒤 접미로 붙인다. */
  it('미사용 품목은 이름 뒤에 표식을 붙인다', () => {
    renderPane();

    expect(screen.getByText('합성 품목 C (미사용)')).toBeInTheDocument();
  });
});

/**
 * M12 — 품목 신규 생성 경로가 없다.
 *
 * 계약에 `POST /mdm/items`가 없다. 품목은 외부 정본이고 이 화면은 확장 속성만 단다.
 */
describe('ItemListPane — 신규 생성 경로가 없다 (M12)', () => {
  it('추가 액션이 없다', () => {
    renderPane();

    const pane = screen.getByRole('region', { name: '품목' });
    const labels = within(pane)
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');

    expect(labels.some((label) => label.includes('추가'))).toBe(false);
    expect(labels.some((label) => label.includes('등록'))).toBe(false);
  });
});

describe('ItemListPane — 조회 조건', () => {
  it('검색어를 모아서 적용한다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByRole('searchbox', { name: '품목 검색' }), 'SYN');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SYN', includeInactive: false });
  });

  /* 해제 축이라 변경 즉시 적용한다 — 「조회」를 한 번 더 누르게 하지 않는다. */
  it('미사용 포함은 즉시 적용한다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: true });
  });

  it('초기화는 조건을 통째로 푼다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith(EMPTY_ITEM_FILTERS);
  });

  it('걸린 조건을 칩으로 낸다', () => {
    renderPane({ appliedFilters: { q: 'SYN', includeInactive: true } });

    expect(screen.getByText('검색어: SYN')).toBeInTheDocument();
    // 「미사용 포함」은 확인칸 라벨에도 있다 — 칩은 제거 버튼으로 가린다.
    expect(screen.getByRole('button', { name: '미사용 포함 조건 제거' })).toBeInTheDocument();
  });

  it('칩을 제거하면 그 조건만 풀린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: '검색어 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: true });
  });

  /* 값 목록이 미정이라 선택지를 만들 수 없고, 자유 입력 필터는 검색어 칸과 구분되지 않는다. */
  it('품목 유형 필터를 두지 않는다', () => {
    renderPane();

    expect(screen.queryByLabelText('품목유형')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});

describe('ItemListPane — 빈 상태 세 갈래', () => {
  it('조건 없이 0건이면 원본 시스템을 가리킨다 — 여기서 만들 수 없는 자료다', () => {
    renderPane({ items: [], pageView: pageView(1, 0, 0) });

    expect(screen.getByText('표시할 품목이 없습니다')).toBeInTheDocument();
    expect(
      screen.getByText(
        '품목은 외부 시스템에서 받아옵니다. 원본 시스템에 자료가 있는지 확인하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('조건이 걸린 0건이면 조건을 줄이라고 한다', () => {
    renderPane({
      items: [],
      appliedFilters: { q: 'SYN', includeInactive: false },
      pageView: pageView(1, 0, 0),
    });

    expect(screen.getByText('조건에 맞는 품목이 없습니다')).toBeInTheDocument();
  });

  it('범위 밖 쪽이면 첫 쪽으로 갈 수 있다', async () => {
    const { onChangePage, user } = renderPane({
      items: [],
      pageView: pageView(9, 240, 0),
    });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });
});

describe('ItemListPane — 조회 실패와 로딩', () => {
  it('조회 실패가 표를 대신한다', () => {
    renderPane({ loadError: <p>조회 실패 자리</p> });

    expect(screen.getByText('조회 실패 자리')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 진행을 알린다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '품목 목록을 불러오는 중' })).toBeInTheDocument();
  });
});
