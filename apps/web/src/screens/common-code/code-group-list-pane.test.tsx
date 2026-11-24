import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeGroupListPane, EMPTY_CODE_GROUP_FILTERS } from './code-group-list-pane';
import { codeGroupFixtures } from './fixtures';
import { toPageView } from './pagination';
import type { CodeGroupFilters } from './types';

const renderPane = (overrides: Partial<Parameters<typeof CodeGroupListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn<(next: CodeGroupFilters) => void>();
  const onSelect = vi.fn<(codeGroupId: number) => void>();
  const onChangePage = vi.fn<(page: number) => void>();
  const onAddCodeGroup = vi.fn<() => void>();

  render(
    <CodeGroupListPane
      codeGroups={codeGroupFixtures}
      isLoading={false}
      appliedFilters={EMPTY_CODE_GROUP_FILTERS}
      onApplyFilters={onApplyFilters}
      pageView={toPageView({ page: 1, size: 50, total: 3 }, 3)}
      pageMeta={{ page: 1, size: 50, total: 3 }}
      onChangePage={onChangePage}
      onChangePageSize={vi.fn()}
      selectedCodeGroupId={null}
      onSelect={onSelect}
      isCreating={false}
      onAddCodeGroup={onAddCodeGroup}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect, onChangePage, onAddCodeGroup, user: userEvent.setup() };
};

describe('CodeGroupListPane — 목록 표시', () => {
  it('그룹코드·그룹명 두 열만 낸다', () => {
    renderPane();

    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.replace('drag_indicator', ''));
    expect(headers).toEqual(['그룹코드', '그룹명']);
  });

  /* 좁은 좌 페인에서 「사용 여부」 열을 더 두면 이름 열이 짓눌린다(결정 11). */
  it('미사용 행은 열을 늘리지 않고 이름 뒤 접미로 알린다', () => {
    renderPane();

    expect(screen.getByText('합성 코드그룹 C (미사용)')).toBeInTheDocument();
    expect(screen.getByText('합성 코드그룹 A')).toBeInTheDocument();
  });

  it('고른 코드그룹의 행에 선택 표식이 붙는다', () => {
    renderPane({ selectedCodeGroupId: 1002 });

    expect(screen.getByRole('button', { name: 'SYN-GRP-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'SYN-GRP-01' })).not.toHaveAttribute('aria-current');
  });

  it('그룹코드를 누르면 그 코드그룹 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-GRP-03' }));

    expect(onSelect).toHaveBeenCalledWith(1003);
  });

  /* 실패를 「등록된 코드그룹이 없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('조회 실패 표시가 있으면 표와 빈 상태를 함께 내지 않는다', () => {
    renderPane({ codeGroups: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 코드그룹이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 안내를 낸다', () => {
    renderPane({ codeGroups: [], isLoading: true });

    expect(screen.getByRole('status', { name: '코드그룹 목록을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

/* 「임시 목록」 안내(결정 6)는 늘 보이는 개발 사정 안내라 걷었다(관리웹 정리 시안 A, 2026-11-20). */
describe('CodeGroupListPane — 늘 보이는 안내 없음', () => {
  it('코드그룹 목록 위에 「임시 목록」 안내를 두지 않는다', () => {
    renderPane();

    expect(screen.queryByText(/임시 목록/)).toBeNull();
  });
});

describe('CodeGroupListPane — 조건', () => {
  it('검색어를 넣고 조회를 누르면 그 조건을 알린다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByLabelText('코드그룹 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SYN', includeInactive: false });
  });

  /* 해제 축이라 조회를 기다리지 않는다 — 켜는 즉시 적용한다. */
  it('미사용 포함은 켜는 즉시 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: true });
  });

  it('초기화를 누르면 빈 조건을 알린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith(EMPTY_CODE_GROUP_FILTERS);
  });

  /* C-6 — 초기화는 편집 중인 값이나 걸린 조건이 처음 값과 다를 때만 보인다. */
  it('초기화는 바뀐 것이 있을 때만 보인다', async () => {
    const { user } = renderPane();

    expect(screen.queryByRole('button', { name: '초기화' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('코드그룹 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '초기화' }));

    /* 걸린 조건이 처음 그대로여도 치던 검색어를 비우고 단추를 거둔다. */
    expect(screen.getByLabelText('코드그룹 검색')).toHaveValue('');
    expect(screen.queryByRole('button', { name: '초기화' })).not.toBeInTheDocument();
  });

  /* 조건 칸이 모두 줄에 보인다 — 보이는 칸의 값을 칩으로 겹쳐 적지 않는다(C-6). */
  it('걸린 조건을 칩으로 겹쳐 적지 않는다', () => {
    renderPane({ appliedFilters: { q: 'SYN', includeInactive: true } });

    expect(screen.getByLabelText('코드그룹 검색')).toHaveValue('SYN');
    expect(screen.queryByText('검색어: SYN')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /조건 제거$/ })).not.toBeInTheDocument();
  });
});

describe('CodeGroupListPane — 빈 상태', () => {
  it('조건 없는 0건은 「등록된 것이 없다」로 낸다', () => {
    renderPane({ codeGroups: [], pageView: toPageView({ page: 1, size: 50, total: 0 }, 0) });

    expect(screen.getByText('등록된 코드그룹이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 코드그룹이 없습니다')).not.toBeInTheDocument();
  });

  it('조건이 걸린 0건에는 초기화로 돌아갈 길을 함께 준다', () => {
    renderPane({
      codeGroups: [],
      appliedFilters: { q: 'SYN', includeInactive: false },
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 코드그룹이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 코드그룹이 없습니다')).not.toBeInTheDocument();
  });

  /* 결과는 있는데 이 쪽에 없다 — 「등록된 것이 없다」로 내면 거짓말이 된다. */
  it('범위 밖 쪽에는 첫 쪽으로 돌아갈 길을 준다', async () => {
    const { onChangePage, user } = renderPane({
      codeGroups: [],
      pageView: toPageView({ page: 9, size: 50, total: 240 }, 0),
    });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 코드그룹이 없습니다')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));
    expect(onChangePage).toHaveBeenCalledWith(1);
  });
});

describe('CodeGroupListPane — 그룹 추가', () => {
  it('그룹 추가를 누르면 알린다', async () => {
    const { onAddCodeGroup, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '그룹 추가' }));

    expect(onAddCodeGroup).toHaveBeenCalledTimes(1);
  });

  it('등록 폼이 이미 열려 있으면 그룹 추가가 막힌다 — 같은 폼을 두 번 열지 않는다', () => {
    renderPane({ isCreating: true });

    expect(screen.getByRole('button', { name: '그룹 추가' })).toBeDisabled();
  });
});

describe('CodeGroupListPane — 쪽 이동', () => {
  it('다음을 누르면 다음 쪽을 알린다', async () => {
    const { onChangePage, user } = renderPane({
      pageView: toPageView({ page: 2, size: 50, total: 240 }, 50),
      pageMeta: { page: 2, size: 50, total: 240 },
    });

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChangePage).toHaveBeenCalledWith(3);
  });
});
