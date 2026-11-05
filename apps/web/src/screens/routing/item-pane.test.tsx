import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { itemFixtures } from './fixtures';
import { ItemFilterBar, ItemPane, type ItemPaneProps, ItemStatusChips } from './item-pane';
import type { ItemFilters } from './types';

const NO_FILTERS: ItemFilters = {
  q: '',
  onlyWithoutRouting: false,
  latestStatus: '',
};

const renderPane = (overrides: Partial<ItemPaneProps> = {}) => {
  const onApplyFilters = vi.fn();
  const onSelect = vi.fn();
  const props: ItemPaneProps = {
    items: itemFixtures,
    isLoading: false,
    appliedFilters: NO_FILTERS,
    onApplyFilters,
    selectedItemId: null,
    onSelect,
    revisionSummaryOf: () => undefined,
    pageMeta: { page: 1, size: 20, total: itemFixtures.length },
    onChangePage: vi.fn(),
    onChangePageSize: vi.fn(),
    loadError: null,
    ...overrides,
  };

  /*
   * 화면처럼 조회 상자(ItemFilterBar)와 목록(ItemPane)을 함께 그린다 — 둘은 같은 적용 조건을 받는다(#231).
   * 적용 조건은 상태로 쥔다 — 프로바이더를 다시 감싸지 않고 조건만 바꿔 다시 그리기 위해서다.
   */
  let setApplied: (next: ItemFilters) => void = () => undefined;
  const Harness = () => {
    const [applied, setAppliedState] = useState(props.appliedFilters);
    setApplied = setAppliedState;
    return (
      <>
        <ItemStatusChips appliedFilters={applied} onApplyFilters={props.onApplyFilters} />
        <ItemFilterBar appliedFilters={applied} onApplyFilters={props.onApplyFilters} />
        <ItemPane {...props} appliedFilters={applied} />
      </>
    );
  };
  /* 품목 검색 칸은 펼칠 때 서버에 묻는다(#231) — 받은 품목을 그대로 돌려준다. */
  renderWithProviders(<Harness />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/items',
        /* 진행 상태 칩 건수 — 작성중 1 · 확정 2 · 폐기 0 · 미등록 4 · 전체 3(조건별로 다르게 돌려 칩마다 제 건수를 보는지 본다). */
        respond: (request) => {
          const query = new URL(request.url).searchParams;
          const total =
            query.get('hasRouting') === 'false'
              ? 4
              : (({ DRAFT: 1, CONFIRMED: 2, OBSOLETE: 0 } as Record<string, number>)[
                  query.get('latestRoutingStatus') ?? ''
                ] ?? itemFixtures.length);
          return jsonResponse({ items: itemFixtures, page: { page: 1, size: 20, total } });
        },
      },
    ]),
  });

  return {
    onApplyFilters,
    onSelect,
    user: userEvent.setup(),
    rerenderWithFilters: (next: ItemFilters) => {
      act(() => setApplied(next));
    },
  };
};

describe('ItemPane', () => {
  it('받은 품목을 코드·품목명으로 그린다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: 'ITM-001' })).toBeInTheDocument();
    expect(screen.getByText('하우징 커버')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ITM-003' })).toBeInTheDocument();
  });

  /* 최신 Rev · 진행 상태 · 개정 수 · 기본 Rev(#231) — 받는 중이면 비우고, 없으면 「—」. */
  it('품목별 최신 Rev · 진행 상태 · 개정 수 · 기본 Rev를 낸다', () => {
    const rev = (routingVersion: number) =>
      ({
        routingId: routingVersion,
        itemId: 5001,
        routingCode: 'R',
        routingVersion,
        statusCode: 'DRAFT',
      }) as const;
    renderPane({
      revisionSummaryOf: (itemId) =>
        itemId === 5001
          ? { defaultRevision: rev(2), latestRevision: rev(3), revisionCount: 3 }
          : itemId === 5002
            ? { defaultRevision: null, latestRevision: null, revisionCount: 0 }
            : undefined,
    });

    const cells = (code: string) =>
      Array.from(
        screen.getByRole('button', { name: code }).closest('tr')?.querySelectorAll('td') ?? [],
      ).map((cell) => cell.textContent);
    expect(cells('ITM-001').slice(2)).toEqual(['Rev 3', '작성중', '3', 'Rev 2']);
    expect(cells('ITM-002').slice(2)).toEqual(['—', '미등록', '0', '—']);
    expect(cells('ITM-003').slice(2)).toEqual(['', '', '', '']);
  });

  it('품목 코드를 누르면 선택을 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'ITM-002' }));

    expect(onSelect).toHaveBeenCalledWith(5002);
  });

  it('선택된 품목의 코드에 현재 위치 표식이 붙는다', () => {
    renderPane({ selectedItemId: 5002 });

    expect(screen.getByRole('button', { name: 'ITM-002' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'ITM-001' })).not.toHaveAttribute('aria-current');
  });

  /* 품목은 칸에서 바로 검색해 고른다 — 고른 품목코드가 검색어가 된다(다른 화면과 같다 · #231). */
  const pickItem = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByLabelText('품목 검색'));
    await user.click(await screen.findByRole('option', { name }));
  };

  it('품목 검색 칸에서 품목을 고르고 조회를 누르면 그 품목코드로 조건이 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    expect(screen.getByLabelText('품목 검색')).toHaveTextContent('전체');
    await pickItem(user, 'ITM-002 · 브래킷');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'ITM-002',
      onlyWithoutRouting: false,
      latestStatus: '',
    });
  });

  it('같은 필터 값의 새 객체로 다시 그려도 고른 품목을 보존한다', async () => {
    const { rerenderWithFilters, user } = renderPane();

    await pickItem(user, 'ITM-002 · 브래킷');
    rerenderWithFilters({ ...NO_FILTERS });

    expect(screen.getByLabelText('품목 검색')).toHaveTextContent('ITM-002');
  });

  it.each([
    {
      field: 'q',
      next: { q: 'SYN-APPLIED', onlyWithoutRouting: false, latestStatus: '' },
      expectedQ: 'SYN-APPLIED',
    },
    {
      field: 'onlyWithoutRouting',
      next: { q: '', onlyWithoutRouting: true, latestStatus: '' },
      expectedQ: '전체',
    },
  ] satisfies { field: keyof ItemFilters; next: ItemFilters; expectedQ: string }[])(
    '적용된 $field 값만 바뀌어도 편집 상태를 주소 값으로 돌린다',
    async ({ next, expectedQ }) => {
      const { rerenderWithFilters, user } = renderPane();

      await pickItem(user, 'ITM-002 · 브래킷');
      rerenderWithFilters(next);

      expect(screen.getByLabelText('품목 검색')).toHaveTextContent(expectedQ);
    },
  );

  /* 진행 상태 칩(#231) — 「공정 경로 미등록」 체크는 칩 「미등록」으로 옮겼다. */
  it('진행 상태 칩마다 서버가 센 건수를 보이고, 고른 칩이 눌린 상태다', async () => {
    renderPane({ appliedFilters: { ...NO_FILTERS, latestStatus: 'CONFIRMED' } });

    expect(screen.queryByRole('button', { name: /^전체/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '작성중 1' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '확정 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByRole('button', { name: '폐기 0' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '미등록 4' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '공정 경로 미등록' })).not.toBeInTheDocument();
  });

  it('칩을 누르면 바로 적용된다 — 미등록은 Routing 없음, 나머지는 최근 Rev 상태 조건이다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { ...NO_FILTERS, q: 'ITM' },
    });

    await user.click(await screen.findByRole('button', { name: /^작성중/ }));
    expect(onApplyFilters).toHaveBeenLastCalledWith({
      q: 'ITM',
      onlyWithoutRouting: false,
      latestStatus: 'DRAFT',
    });

    await user.click(screen.getByRole('button', { name: /^미등록/ }));
    expect(onApplyFilters).toHaveBeenLastCalledWith({
      q: 'ITM',
      onlyWithoutRouting: true,
      latestStatus: '',
    });
  });

  it('고른 칩을 한 번 더 누르면 거르기를 푼다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { ...NO_FILTERS, latestStatus: 'DRAFT' },
    });

    await user.click(await screen.findByRole('button', { name: /^작성중/ }));

    expect(onApplyFilters).toHaveBeenLastCalledWith({
      q: '',
      onlyWithoutRouting: false,
      latestStatus: '',
    });
  });

  it('적용된 검색어는 칩으로 보이고 칩을 지우면 검색어만 풀린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'ITM', onlyWithoutRouting: true, latestStatus: '' },
    });

    expect(screen.getByText('검색어: ITM')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '검색어 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: '',
      onlyWithoutRouting: true,
      latestStatus: '',
    });
  });

  it('조회에 실패하면 표도 빈 상태도 내지 않고 받은 오류 표시만 낸다', () => {
    renderPane({ items: [], loadError: <p>목록을 불러오지 못했습니다</p> });

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 품목이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 스켈레톤을 낸다', () => {
    renderPane({ items: [], isLoading: true });

    expect(screen.getByRole('status', { name: '품목 목록을 불러오는 중' })).toBeInTheDocument();
  });

  it('조건이 없는 빈 목록과 조건이 있는 빈 목록은 다른 안내를 낸다', () => {
    const { unmount } = render(
      <ItemPane
        items={[]}
        isLoading={false}
        appliedFilters={NO_FILTERS}
        onApplyFilters={vi.fn()}
        selectedItemId={null}
        revisionSummaryOf={() => undefined}
        pageMeta={{ page: 1, size: 20, total: 0 }}
        onChangePage={vi.fn()}
        onChangePageSize={vi.fn()}
        onSelect={vi.fn()}
        loadError={null}
      />,
    );

    expect(screen.getByText('등록된 품목이 없습니다')).toBeInTheDocument();
    unmount();

    renderPane({
      items: [],
      appliedFilters: { q: 'ZZZ', onlyWithoutRouting: false, latestStatus: '' },
    });

    expect(screen.getByText('조건에 맞는 품목이 없습니다')).toBeInTheDocument();
  });
});
