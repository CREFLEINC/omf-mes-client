import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeValueListPane } from './code-value-list-pane';
import type { CodeValue } from './code-value-types';
import { codeValueFixtures } from './fixtures';
import { toPageView } from './pagination';

const renderPane = (overrides: Partial<Parameters<typeof CodeValueListPane>[0]> = {}) => {
  const onIncludeInactiveChange = vi.fn<(includeInactive: boolean) => void>();
  const onChangePage = vi.fn<(page: number) => void>();
  const onSelect = vi.fn<(codeValueId: number) => void>();

  render(
    <CodeValueListPane
      codeValues={codeValueFixtures}
      isLoading={false}
      isGroupSelected
      includeInactive
      onIncludeInactiveChange={onIncludeInactiveChange}
      pageView={toPageView({ page: 1, size: 50, total: 3 }, 3)}
      onChangePage={onChangePage}
      selectedCodeValueId={null}
      onSelect={onSelect}
      loadError={null}
      {...overrides}
    />,
  );

  return { onIncludeInactiveChange, onChangePage, onSelect, user: userEvent.setup() };
};

const codeCells = (): string[] =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');

describe('CodeValueListPane — 목록 표시', () => {
  it('코드·코드명·정렬 순서·유효기간 네 열을 낸다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['코드', '코드명', '정렬 순서', '유효기간']);
  });

  /* C26 — 계약이 목록의 정렬을 명시하지 않았다. 받은 순서를 그대로 쓰면 순서가 서버 재량이 된다. */
  it('서버가 준 순서가 아니라 정렬 순서 오름차순으로 그린다', () => {
    renderPane();

    expect(codeCells()).toEqual(['SYN-CV-02', 'SYN-CV-03', 'SYN-CV-01']);
  });

  it('미사용 행은 열을 늘리지 않고 이름 뒤 접미로 알린다', () => {
    renderPane();

    expect(screen.getByText('합성 코드값 C (미사용)')).toBeInTheDocument();
  });

  it('유효기간을 한 칸에 담고, 없는 쪽은 지어내지 않는다', () => {
    renderPane();

    expect(screen.getByText('2026-07-01 ~ 2026-12-31')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01 ~ —')).toBeInTheDocument();
    // 둘 다 없으면 기간 자체를 표기하지 않는다.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  /* 결정 7 — 저장이 행 단위라 한 번의 이동이 여러 행을 바꾸면 중간에 실패한 채 남는다. */
  it('순서 이동 버튼을 두지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /위로|아래로|↑|↓/ })).not.toBeInTheDocument();
  });

  it('정렬 가능한 열 머리글을 두지 않는다', () => {
    renderPane();

    for (const header of screen.getAllByRole('columnheader')) {
      expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    }
  });

  it('고른 코드값의 행에 선택 표식이 붙는다', () => {
    renderPane({ selectedCodeValueId: 2002 });

    expect(screen.getByRole('button', { name: 'SYN-CV-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'SYN-CV-01' })).not.toHaveAttribute('aria-current');
  });

  it('코드를 누르면 그 코드값 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-CV-03' }));

    expect(onSelect).toHaveBeenCalledWith(2003);
  });
});

describe('CodeValueListPane — 안내', () => {
  /* C28 — 정렬이 이 쪽 안에서만 도는 사실을 감추면 「전체가 이 순서다」로 읽힌다. */
  it('쪽이 둘 이상이면 정렬 범위 안내가 뜬다', () => {
    renderPane({ pageView: toPageView({ page: 1, size: 2, total: 10 }, 2) });

    expect(screen.getByText('정렬은 현재 쪽 안에서만 적용됩니다.')).toBeInTheDocument();
  });

  it('한 쪽뿐이면 정렬 범위 안내가 뜨지 않는다', () => {
    renderPane();

    expect(screen.queryByText('정렬은 현재 쪽 안에서만 적용됩니다.')).not.toBeInTheDocument();
  });

  /* C27 — 유일 제약이 없어 서버가 허용하는 값이다. 막지 않고 알리기만 한다. */
  it('정렬 순서가 겹치면 경고 안내가 뜨고 선택은 막지 않는다', async () => {
    const duplicated: CodeValue[] = [
      { ...codeValueFixtures[0]!, displayOrder: 10 },
      { ...codeValueFixtures[1]!, displayOrder: 10 },
    ];
    const { onSelect, user } = renderPane({ codeValues: duplicated });

    expect(
      screen.getByText('정렬 순서가 같은 코드값이 있습니다. 같은 값끼리는 코드 순으로 보입니다.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'SYN-CV-01' }));
    expect(onSelect).toHaveBeenCalledWith(2001);
  });

  it('겹치지 않으면 경고가 없다', () => {
    renderPane();

    expect(
      screen.queryByText('정렬 순서가 같은 코드값이 있습니다. 같은 값끼리는 코드 순으로 보입니다.'),
    ).not.toBeInTheDocument();
  });
});

describe('CodeValueListPane — 상태 갈래', () => {
  it('그룹을 고르기 전에는 안내만 내고 표·확인칸을 두지 않는다', () => {
    renderPane({ isGroupSelected: false, codeValues: [] });

    expect(screen.getByText('좌측에서 코드그룹을 먼저 고르세요')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 안내를 낸다', () => {
    renderPane({ codeValues: [], isLoading: true });

    expect(screen.getByRole('status', { name: '코드값 목록을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('조회 실패 표시가 있으면 표와 빈 상태를 함께 내지 않는다', () => {
    renderPane({ codeValues: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('미사용 포함이 꺼진 0건은 켜면 나올 수 있다고 안내한다', () => {
    renderPane({
      codeValues: [],
      includeInactive: false,
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 코드값이 없습니다')).toBeInTheDocument();
  });

  it('미사용까지 포함한 0건은 등록된 것이 없다고 낸다', () => {
    renderPane({ codeValues: [], pageView: toPageView({ page: 1, size: 50, total: 0 }, 0) });

    expect(screen.getByText('이 코드그룹에 등록된 코드값이 없습니다')).toBeInTheDocument();
  });
});

describe('CodeValueListPane — 조건과 쪽', () => {
  it('미사용 포함은 켜는 즉시 알린다', async () => {
    const { onIncludeInactiveChange, user } = renderPane({ includeInactive: false });

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onIncludeInactiveChange).toHaveBeenCalledWith(true);
  });

  /* 한 화면에 쪽 이동이 둘이라 이름이 같으면 어느 목록의 이동인지 가릴 수 없다. */
  it('쪽 이동에 코드값 전용 접근 이름이 붙는다', () => {
    renderPane();

    expect(screen.getByRole('navigation', { name: '코드값 쪽 이동' })).toBeInTheDocument();
  });

  it('다음을 누르면 다음 쪽을 알린다', async () => {
    const { onChangePage, user } = renderPane({
      pageView: toPageView({ page: 1, size: 2, total: 10 }, 2),
    });

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChangePage).toHaveBeenCalledWith(2);
  });
});
