import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionItemSpecFixtures } from './fixtures';
import { toItemDrafts } from './item-order';
import { ItemPane } from './item-pane';

const renderPane = (overrides: Partial<Parameters<typeof ItemPane>[0]> = {}) => {
  const onAdd = vi.fn<() => void>();
  const onEdit = vi.fn<(draftId: string) => void>();
  const onRemove = vi.fn<(draftId: string) => void>();
  const onReorder = vi.fn<(from: number, to: number) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();

  render(
    <ItemPane
      drafts={toItemDrafts(inspectionItemSpecFixtures)}
      uomLabel={(uomId) => (uomId === '41' ? 'EA · 개' : uomId)}
      isLoading={false}
      isVersionSelected
      loadError={null}
      optionsNotice={null}
      isEditable
      lockReason="검사 항목은 작성중 버전에서만 편집할 수 있습니다."
      isDirty={false}
      isSaving={false}
      saveBlockedReason={null}
      banner={null}
      onAdd={onAdd}
      onEdit={onEdit}
      onRemove={onRemove}
      onReorder={onReorder}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onAdd, onEdit, onRemove, onReorder, onSave, onCancel, user: userEvent.setup() };
};

const itemRows = (): HTMLElement[] =>
  within(screen.getByRole('region', { name: '검사 항목' }))
    .getAllByRole('row')
    .slice(1);

describe('ItemPane — 표', () => {
  /* 마지막 「순서 변경」 열은 디자인 시스템이 렌더한다 — 화면이 정하는 것은 앞의 일곱이다. */
  it('화면이 정한 일곱 열을 낸다', () => {
    renderPane();

    /* 머리칸에는 열 순서 손잡이 아이콘 글자(drag_indicator)가 함께 있다 — 이름만 견준다. */
    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.replace('drag_indicator', ''));
    expect(headers.slice(0, 7)).toEqual([
      '순서',
      '항목',
      '검사값 유형',
      '목표·범위',
      '측정 횟수',
      '판정',
      '편집',
    ]);
  });

  /* 서버 채번은 서버 재량이다 — 그 값을 그대로 보이면 사용자가 그것을 자료로 읽는다. */
  it('서버가 순서 값 10·20을 줘도 표시 번호는 1·2다', () => {
    renderPane();

    const rows = itemRows();
    expect(within(rows[0]!).getByText('1')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('2')).toBeInTheDocument();

    const region = screen.getByRole('region', { name: '검사 항목' });
    expect(within(region).queryByText('10')).not.toBeInTheDocument();
    expect(within(region).queryByText('20')).not.toBeInTheDocument();
  });

  it('항목 칸에 코드와 이름을 함께 낸다 — 코드가 앞이다', () => {
    renderPane();

    expect(screen.getByText('SYN-ITEM-CODE-01 · 합성 항목 A')).toBeInTheDocument();
  });

  it('목표·범위를 한 칸에 이어 담고 단위 이름을 옮겨 낸다', () => {
    renderPane();

    expect(screen.getByText('10 · 9~11 · EA · 개')).toBeInTheDocument();
  });

  /* 값이 없다는 것과 0이라는 것은 다르다. */
  it('값이 없는 칸은 표기를 남긴다', () => {
    renderPane();

    expect(within(itemRows()[1]!).getByText('—')).toBeInTheDocument();
  });

  /* 필수는 항목 이름 앞 라벨, 판정 칸은 자동판정 여부만 말한다(검사 조회·판정 표와 같다 · #196). */
  it('필수 항목에는 이름 앞에 필수 라벨이 서고 판정 칸은 자동판정 여부를 낸다', () => {
    renderPane();

    expect(screen.getAllByText('필수').length).toBeGreaterThan(0);
    expect(screen.getByText('자동판정')).toBeInTheDocument();
    expect(screen.getByText('없음')).toBeInTheDocument();
  });

  it('행 아이콘 버튼의 접근 이름에 표시 번호가 들어간다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '1번 항목 수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2번 항목 삭제' })).toBeInTheDocument();
  });

  it('0건이면 첫 등록을 권한다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('등록된 검사 항목이 없습니다')).toBeInTheDocument();
  });

  it('버전을 고르기 전에는 선택 안내를 낸다', () => {
    renderPane({ drafts: [], isVersionSelected: false });

    expect(screen.getByText('버전을 선택하세요')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('조회 실패 표시가 있으면 표와 빈 상태를 함께 내지 않는다', () => {
    renderPane({ drafts: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 검사 항목이 없습니다')).not.toBeInTheDocument();
  });
});

describe('ItemPane — 편집', () => {
  it('「항목 추가」를 누르면 상위에 알린다', async () => {
    const { onAdd, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '항목 추가' }));

    expect(onAdd).toHaveBeenCalled();
  });

  it('행의 삭제를 누르면 그 초안 키를 알린다', async () => {
    const { onRemove, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '1번 항목 삭제' }));

    expect(onRemove).toHaveBeenCalledWith('saved:5101');
  });

  /*
   * 디자인 시스템에 「이동만 비활성」 스위치가 없다 —
   * 눌러도 아무 일이 없는 버튼을 남기는 것보다 열 자체를 내지 않는 편이 정직하다.
   */
  it('잠긴 버전에서는 순서 이동 열 자체가 렌더되지 않는다', () => {
    renderPane({ isEditable: false });

    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.replace('drag_indicator', ''));
    /* 잠긴 버전에는 편집 열도 없다 — 누를 수 없는 단추만 줄마다 남기지 않는다(#196). */
    expect(headers).toHaveLength(6);
    expect(headers).not.toContain('순서 변경');
    expect(headers).not.toContain('편집');
  });

  it('편집이 열려 있으면 순서 이동 열이 렌더된다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toContain('순서 변경');
  });

  /* 잠긴 버전에서는 누를 수 없는 추가 · 수정 · 삭제 · 저장 단추를 두지 않고, 표 위 안내 줄도 두지 않는다(#196). */
  it('잠긴 버전에서는 추가·수정·삭제·저장 단추와 표 위 안내 줄이 없다', () => {
    renderPane({ isEditable: false, isDirty: true });

    expect(screen.queryByRole('button', { name: '항목 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1번 항목 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1번 항목 삭제' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('검사 항목을 추가하려면 신규 버전을 발행하세요.'),
    ).not.toBeInTheDocument();
  });

  it('저장을 막는 사유가 있으면 비활성이고 사유가 보인다', () => {
    renderPane({ isDirty: true, saveBlockedReason: '먼저 버전을 저장하세요.' });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText('먼저 버전을 저장하세요.')).toBeInTheDocument();
  });

  it('고친 것이 있으면 저장을 누를 수 있다', async () => {
    const { onSave, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalled();
  });
});
