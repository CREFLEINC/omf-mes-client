import type { ItemResourceMap } from '@omf-mes/api-client';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemResourceMapFixtures } from './fixtures';
import { ItemResourceMapPane } from './item-resource-map-pane';

const renderPane = (overrides: Partial<Parameters<typeof ItemResourceMapPane>[0]> = {}) => {
  const handlers = {
    onChangePlant: vi.fn<(plantId: string) => void>(),
    onAdd: vi.fn<() => void>(),
    onEdit: vi.fn<(row: ItemResourceMap) => void>(),
    onSetDefault: vi.fn<(row: ItemResourceMap) => void>(),
    onToggleActive: vi.fn<(row: ItemResourceMap) => void>(),
  };

  render(
    <ItemResourceMapPane
      rows={itemResourceMapFixtures}
      isLoading={false}
      plantOptions={[{ value: '9001', label: 'SYN-PLANT-01 · 합성 공장' }]}
      plantId="9001"
      optionsNotice={null}
      loadError={null}
      banner={null}
      rowActionsLocked={false}
      {...handlers}
      {...overrides}
    />,
  );

  return { ...handlers, user: userEvent.setup() };
};

const rowOf = (text: string): HTMLElement => {
  const cell = screen.getAllByRole('cell').find((item) => item.textContent === text);
  const row = cell?.closest('tr');
  if (row === null || row === undefined) throw new Error(`${text} 줄이 없습니다`);

  return row;
};

describe('ItemResourceMapPane — 표시', () => {
  it('구획에 접근 이름이 있다', () => {
    renderPane();

    expect(screen.getByRole('region', { name: '설비·금형' })).toBeInTheDocument();
  });

  it('공정·설비·금형을 코드와 이름으로 내고 자동 배정 줄에 ★를 단다', () => {
    renderPane();

    const first = rowOf('SYN-PROC-01 · 합성 공정 가');
    expect(within(first).getByText('★')).toBeInTheDocument();
    expect(within(first).getByText('SYN-EQ-01 · 합성 설비 A')).toBeInTheDocument();
    expect(within(first).getByText('SYN-MOLD-01 · 합성 금형 A')).toBeInTheDocument();
    expect(within(first).getByText('10')).toBeInTheDocument();
  });

  /* 공정이 빈 줄은 정상 값이다 — 빈 칸이면 빠뜨린 것으로 읽힌다. */
  it('공정이 없는 줄은 「전체 공정」이다', () => {
    renderPane();

    expect(screen.getByText('전체 공정')).toBeInTheDocument();
  });

  it('사용 중지한 줄도 보이고 사용 여부를 밝힌다', () => {
    renderPane();

    expect(within(rowOf('SYN-EQ-02 · 합성 설비 B')).getByText('미사용')).toBeInTheDocument();
  });

  it('등록된 줄이 없으면 빈 상태를 낸다', () => {
    renderPane({ rows: [] });

    expect(screen.getByText('등록된 설비·금형이 없습니다')).toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 상태를 낸다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '설비·금형을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('공장을 고르지 않았으면 표도 추가도 없다', () => {
    renderPane({ plantId: '', plantOptions: [] });

    expect(screen.getByText('공장을 고르세요')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();
  });

  /* 계약에 삭제 경로가 없다 — 사용 중지로 대신한다. */
  it('줄 삭제가 없다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument();
  });
});

describe('ItemResourceMapPane — 줄 작업', () => {
  it('추가·수정을 바깥에 알린다', async () => {
    const { onAdd, onEdit, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '추가' }));
    expect(onAdd).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '전체 공정 / SYN-MOLD-02 수정' }));
    expect(onEdit).toHaveBeenCalledWith(itemResourceMapFixtures[1]);
  });

  it('자동 배정이 아닌 사용 중인 줄에만 자동 배정 버튼이 있다', async () => {
    const { onSetDefault, user } = renderPane();

    expect(screen.getAllByRole('button', { name: / 자동 배정 지정$/ })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '전체 공정 / SYN-MOLD-02 자동 배정 지정' }));
    expect(onSetDefault).toHaveBeenCalledWith(itemResourceMapFixtures[1]);
  });

  it('사용 중인 줄은 사용 중지, 사용 중지한 줄은 다시 사용이다', async () => {
    const { onToggleActive, user } = renderPane();

    await user.click(
      screen.getByRole('button', { name: 'SYN-PROC-01 · 합성 공정 가 / SYN-EQ-02 다시 사용' }),
    );
    expect(onToggleActive).toHaveBeenCalledWith(itemResourceMapFixtures[2]);

    expect(
      screen.getByRole('button', {
        name: 'SYN-PROC-01 · 합성 공정 가 / SYN-EQ-01 / SYN-MOLD-01 사용 중지',
      }),
    ).toBeInTheDocument();
  });

  /* 목록의 판이 곧 낡는 동안 누르면 내 쓰기끼리 충돌한다 — 모든 줄의 작업과 수정을 닫는다. */
  it('잠겨 있으면 모든 줄의 작업과 수정이 닫힌다', () => {
    renderPane({ rowActionsLocked: true });

    const rowButtons = screen
      .getAllByRole('button')
      .filter((button) =>
        / 수정$| 자동 배정$|사용 중지|다시 사용/.test(button.getAttribute('aria-label') ?? ''),
      );

    expect(rowButtons.length).toBeGreaterThan(0);
    for (const button of rowButtons) expect(button).toBeDisabled();
  });

  it('목록을 받는 중이면 추가가 닫힌다', () => {
    renderPane({ isLoading: true });
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();
  });

  it('목록 조회가 실패했으면 추가가 닫힌다', () => {
    renderPane({ loadError: <p>조회 실패</p> });

    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();
  });
});
