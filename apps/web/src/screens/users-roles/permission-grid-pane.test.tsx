import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PermissionGroup } from './permission-catalog';
import { PermissionGridPane, type PermissionGridPaneProps } from './permission-grid-pane';

const GROUPS: PermissionGroup[] = [
  {
    key: '01',
    label: '자재·창고',
    columns: [
      { code: 'SYN-PERM-01', label: '합성 권한 하나', isGranted: true, isUnlisted: false },
      { code: 'SYN-PERM-02', label: '합성 권한 둘', isGranted: false, isUnlisted: false },
    ],
  },
  {
    key: '06',
    label: '기준정보',
    columns: [{ code: 'SYN-PERM-03', label: '합성 권한 셋', isGranted: false, isUnlisted: false }],
  },
];

const renderPane = (overrides: Partial<PermissionGridPaneProps> = {}) => {
  render(
    <PermissionGridPane
      roleLabel="SYN-ROLE-01"
      groups={GROUPS}
      isLoading={false}
      loadError={null}
      banner={null}
      unlistedNotice={null}
      isDirty={false}
      isSaving={false}
      onToggle={() => undefined}
      onSelectAll={() => undefined}
      onClearAll={() => undefined}
      onSave={() => undefined}
      onCancel={() => undefined}
      {...overrides}
    />,
  );

  return { user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '기능 권한' });

const NOTE = /칸을 눌러 권한을 주거나 거둔 뒤 저장하세요/;

/** 권한 확인칸 하나. 이름이 「역할 · 권한 이름 · 상태」라 그것으로 집는다. */
const permissionBox = (name: string): HTMLElement =>
  within(pane()).getByRole('checkbox', { name: new RegExp(`· ${name} ·`) });

describe('PermissionGridPane 표', () => {
  /**
   * ⭐ **세로 표다**(#1308). 가로 격자일 때는 권한이 117개라 열이 117개가 되어 오른쪽 끝
   * 권한을 **눌러서 고를 수가 없었다.** 권한이 행으로 서는 것이 이 표의 존재 이유다.
   */
  it('권한이 행으로 서고 이름과 코드를 함께 보인다', () => {
    renderPane();

    const rows = within(pane()).getAllByRole('row');
    const text = rows.map((row) => row.textContent ?? '');

    expect(text.some((line) => line.includes('합성 권한 하나') && line.includes('SYN-PERM-01'))).toBe(
      true,
    );
    expect(text.some((line) => line.includes('합성 권한 셋') && line.includes('SYN-PERM-03'))).toBe(
      true,
    );
  });

  it('열 머리가 부여·권한·코드다', () => {
    renderPane();

    expect(
      within(pane())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['부여', '권한', '코드']);
  });

  /** ⭐ 권한이 117개라 묶지 않으면 어디를 보고 있는지 알 수 없다. */
  it('묶음 이름이 머리행으로 선다', () => {
    renderPane();

    expect(within(pane()).getByText('자재·창고')).toBeInTheDocument();
    expect(within(pane()).getByText('기준정보')).toBeInTheDocument();
  });

  /**
   * ⛔ **DS `Table` 의 선택 열을 쓰지 않는다.** 그 열은 행마다 같은 이름(`행 선택`)을 붙여
   * 117행이 전부 「행 선택」으로 읽힌다. 어느 권한의 칸인지가 보조기술에 닿아야 한다.
   */
  it('확인칸마다 어느 역할의 어느 권한인지가 이름으로 붙는다', () => {
    renderPane();

    expect(
      within(pane())
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-label')),
    ).toEqual([
      'SYN-ROLE-01 · 합성 권한 하나 · 부여됨',
      'SYN-ROLE-01 · 합성 권한 둘 · 부여되지 않음',
      'SYN-ROLE-01 · 합성 권한 셋 · 부여되지 않음',
    ]);
  });

  it('이름 없는 확인칸이 하나도 없다', () => {
    renderPane();

    for (const box of within(pane()).getAllByRole('checkbox')) {
      expect(box.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('부여된 권한의 확인칸만 켜져 있다', () => {
    renderPane();

    expect(permissionBox('합성 권한 하나')).toBeChecked();
    expect(permissionBox('합성 권한 둘')).not.toBeChecked();
  });

  it('확인칸을 누르면 그 행의 코드로 알린다', async () => {
    const onToggle = vi.fn();
    const { user } = renderPane({ onToggle });

    await user.click(permissionBox('합성 권한 둘'));

    expect(onToggle).toHaveBeenCalledWith('SYN-PERM-02');
  });

  /** ⛔ 보낸 뒤에 바뀐 값은 서버 응답이 덮어써, 누른 것과 저장된 것이 어긋난다. */
  it('저장 중에는 확인칸이 잠긴다', () => {
    renderPane({ isSaving: true, isDirty: true });

    for (const box of within(pane()).getAllByRole('checkbox')) {
      expect(box).toBeDisabled();
    }
  });

  /** ⭐ 표만 굴러야 아래 「취소·저장」 줄이 화면 밖으로 밀리지 않는다. */
  it('표가 자기 스크롤 상자 안에 선다', () => {
    renderPane();

    const table = within(pane()).getByRole('table');

    expect(table.closest('.permission-table-scroll')).not.toBeNull();
  });
});

describe('PermissionGridPane 전체 선택·해제', () => {
  it('전체 선택을 누르면 알린다', async () => {
    const onSelectAll = vi.fn();
    const { user } = renderPane({ onSelectAll });

    await user.click(within(pane()).getByRole('button', { name: '전체 선택' }));

    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('전체 해제를 누르면 알린다', async () => {
    const onClearAll = vi.fn();
    const { user } = renderPane({ onClearAll });

    await user.click(within(pane()).getByRole('button', { name: '전체 해제' }));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  /**
   * ⛔ **「저장」과 나란히 두지 않는다.** 나란히 서면 누르는 순간 저장되는 것으로 읽힌다 —
   * 이 둘은 고르기만 하고 서버로 나가는 것은 「저장」뿐이다.
   */
  it('전체 선택·해제가 표보다 앞에 선다', () => {
    renderPane();

    const bulk = within(pane()).getByRole('button', { name: '전체 선택' });
    const table = within(pane()).getByRole('table');

    expect(bulk.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('저장 중에는 잠긴다', () => {
    renderPane({ isSaving: true, isDirty: true });

    expect(within(pane()).getByRole('button', { name: '전체 선택' })).toBeDisabled();
    expect(within(pane()).getByRole('button', { name: '전체 해제' })).toBeDisabled();
  });

  /** 표가 없으면 고를 것도 없다 — 누를 수 없는 버튼을 두지 않는다. */
  it('표가 서지 않으면 버튼도 두지 않는다', () => {
    renderPane({ groups: [] });

    expect(within(pane()).queryByRole('button', { name: '전체 선택' })).toBeNull();
  });
});

describe('PermissionGridPane 저장', () => {
  /** 고친 것이 없으면 주 액션을 **비활성 + 사유**로 둔다(배치 규범 4). */
  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', () => {
    renderPane({ isDirty: false });

    /* ⛔ 사유 문구만 재면 **저장이 눌리게 되는 회귀를 잡지 못한다.** 잠긴 것 자체를 못 박는다. */
    expect(within(pane()).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(
      within(pane()).getByText('저장은 고친 내용이 있을 때 누를 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('고친 것이 있으면 저장을 누를 수 있다', async () => {
    const onSave = vi.fn();
    const { user } = renderPane({ isDirty: true, onSave });

    await user.click(within(pane()).getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('취소는 고친 것이 있을 때만 눌린다', async () => {
    const onCancel = vi.fn();
    const { user } = renderPane({ isDirty: true, onCancel });

    await user.click(within(pane()).getByRole('button', { name: '취소' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('저장 중에는 취소도 잠긴다 — 되돌린 값이 응답에 덮인다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(within(pane()).getByRole('button', { name: '취소' })).toBeDisabled();
  });

  /** ⭐ 액션 줄은 **표 뒤**에 서고, 우측 정렬은 `.form-actions` 가 준다. */
  it('취소·저장이 표 뒤의 액션 줄에 함께 선다', () => {
    renderPane({ isDirty: true });

    const actions = within(pane()).getByRole('button', { name: '저장' }).closest('.form-actions');

    expect(actions).not.toBeNull();
    expect(actions?.querySelector('button')?.textContent).toContain('취소');
  });

  it('저장 실패 배너를 맨 위에 그대로 낸다', () => {
    renderPane({ banner: <p>합성 저장 실패</p> });

    expect(within(pane()).getByText('합성 저장 실패')).toBeInTheDocument();
  });
});

describe('PermissionGridPane 안내', () => {
  it('조작 안내가 항상 보이고 표보다 앞에 있다', () => {
    renderPane();

    const note = within(pane()).getByText(NOTE);
    const table = within(pane()).getByRole('table');

    expect(note).toBeVisible();
    expect(note.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('표가 그 안내를 가리킨다', () => {
    renderPane();

    const noteId = within(pane()).getByText(NOTE).getAttribute('id');

    expect(noteId).toBeTruthy();
    expect(within(pane()).getByRole('table')).toHaveAttribute('aria-describedby', noteId);
  });

  /** 후보에 없는데 부여돼 있는 행이 섰다는 사실을 **감추지 않는다.** */
  it('목록에 없는 권한 안내를 넘기면 그대로 낸다', () => {
    renderPane({ unlistedNotice: <p>합성 미등재 안내</p> });

    expect(within(pane()).getByText('합성 미등재 안내')).toBeInTheDocument();
  });
});

describe('PermissionGridPane 빈 상태와 실패', () => {
  /**
   * ⭐ **행이 0개면 「줄 수 있는 권한이 없다」다** — 「부여된 권한이 없다」가 아니다.
   * 후보 목록이 비었거나 못 받은 것이고, 부여분이 0건인 것과는 다른 사실이다.
   */
  it('행이 하나도 없으면 표 대신 빈 상태가 나온다', () => {
    renderPane({ groups: [] });

    expect(within(pane()).getByText('부여할 수 있는 기능 권한이 없습니다')).toBeInTheDocument();
    expect(within(pane()).queryByRole('table')).toBeNull();
  });

  it('빈 상태도 같은 안내를 가리킨다', () => {
    renderPane({ groups: [] });

    const noteId = within(pane()).getByText(NOTE).getAttribute('id');
    const described = pane().querySelector(`[aria-describedby="${noteId ?? ''}"]`);

    expect(noteId).toBeTruthy();
    expect(described).not.toBeNull();
    expect(described?.textContent).toContain('부여할 수 있는 기능 권한이 없습니다');
  });

  /**
   * 실패를 빈 상태로 내면 **없는 사실을 단정한다** — 없는 것이 아니라 못 불러온 것이고,
   * 그 상태로 저장하면 가진 권한이 통째로 회수된다.
   */
  it('조회 실패에는 표도 빈 상태도 내지 않는다', () => {
    renderPane({ loadError: <p>합성 조회 실패</p> });

    expect(within(pane()).getByText('합성 조회 실패')).toBeInTheDocument();
    expect(within(pane()).queryByRole('table')).toBeNull();
    expect(within(pane()).queryByText('부여할 수 있는 기능 권한이 없습니다')).toBeNull();
    /* 고를 것이 없으니 전체 선택도 두지 않는다. */
    expect(within(pane()).queryByRole('button', { name: '전체 선택' })).toBeNull();
  });

  it('불러오는 중에는 표 대신 진행 표시가 나온다', () => {
    renderPane({ isLoading: true });

    expect(within(pane()).getByRole('status', { name: '기능 권한을 불러오는 중' })).toBeTruthy();
    expect(within(pane()).queryByRole('table')).toBeNull();
  });
});
