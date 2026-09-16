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
      { code: 'SYN-PERM-02', label: '합성 권한 둘', isGranted: true, isUnlisted: false },
    ],
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
      onSave={() => undefined}
      onCancel={() => undefined}
      {...overrides}
    />,
  );

  return { user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '기능 권한' });

const NOTE = /칸을 눌러 권한을 주거나 거둔 뒤 저장하세요/;

describe('PermissionGridPane 격자', () => {
  /**
   * ⭐ **열은 후보 목록에서 온다.** 부여분만 보면 아무것도 받지 않은 역할에 열이 하나도 서지
   * 않아 권한을 새로 줄 수 없다 — 격자가 보기 전용으로 닫혀 있던 까닭이 그것이었다.
   */
  it('후보의 이름이 격자의 열 머리로 나온다 — 코드가 아니다', () => {
    renderPane();

    // 첫 머리글은 행 라벨 칸의 모서리다(디자인 시스템이 붙인다) — 자료 열은 그 뒤부터다.
    expect(
      within(pane())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(expect.arrayContaining(['합성 권한 하나', '합성 권한 둘']));
  });

  /** ⭐ 열이 화면 수만큼이라 묶지 않으면 관리자가 옆으로 끝없이 스크롤한다. */
  it('묶음 이름이 격자 위에 밴드로 선다', () => {
    renderPane();

    expect(within(pane()).getByText('자재·창고')).toBeTruthy();
  });

  /** 행은 **고른 역할 하나**다 — 전체 역할을 그리면 여기서 다른 역할을 바꿀 수 있다고 읽힌다. */
  it('행이 고른 역할 하나뿐이다', () => {
    renderPane();

    const rowHeaders = within(pane()).getAllByRole('rowheader');

    expect(rowHeaders).toHaveLength(1);
    expect(rowHeaders[0]?.textContent).toBe('SYN-ROLE-01');
  });

  /**
   * ⭐ **격자를 키보드로 만질 수 있어야 한다.** 디자인 시스템은 `onCellClick`을 받을 때만
   * 셀에 `tabindex`·`data-clickable`을 붙인다 — 넘기지 않으면 마우스 없이는 권한을 줄 수 없다.
   */
  it('셀에 누를 수 있는 표식이 붙는다', () => {
    renderPane();

    const cells = within(pane()).getByRole('grid').querySelectorAll('tbody td');

    expect(cells.length).toBeGreaterThan(0);

    for (const cell of cells) {
      expect(cell.hasAttribute('tabindex')).toBe(true);
    }
  });

  it('셀을 누르면 그 열의 코드로 알린다', async () => {
    const onToggle = vi.fn();
    const { user } = renderPane({ onToggle });

    const cell = within(pane()).getByRole('grid').querySelector('tbody td');

    expect(cell).not.toBeNull();

    if (cell !== null) await user.click(cell);

    expect(onToggle).toHaveBeenCalledWith('SYN-PERM-01');
  });

  /**
   * ⛔ **저장 중에는 흘린다.** 보낸 뒤에 바뀐 값은 서버 응답이 덮어써, 사용자가 누른 것과
   * 저장된 것이 어긋난다.
   */
  it('저장 중에 셀을 눌러도 알리지 않는다', async () => {
    const onToggle = vi.fn();
    const { user } = renderPane({ onToggle, isSaving: true, isDirty: true });

    const cell = within(pane()).getByRole('grid').querySelector('tbody td');

    if (cell !== null) await user.click(cell);

    expect(onToggle).not.toHaveBeenCalled();
  });

  /**
   * 셀에 내용이 없으므로 **접근 이름이 그 칸의 유일한 뜻**이다.
   *
   * 디자인 시스템의 자동 조합은 상태가 있는 셀에만 도는데 `'none'`은 「상태 없음」으로
   * 정규화된다 — 화면이 만들지 않으면 **부여되지 않은 칸만** 이름 없는 빈 칸이 된다.
   */
  it('부여된 칸과 부여되지 않은 칸이 서로 다른 접근 이름을 갖는다', () => {
    renderPane({
      groups: [
        {
          key: '01',
          label: '자재·창고',
          columns: [
            { code: 'SYN-PERM-01', label: '합성 권한 하나', isGranted: true, isUnlisted: false },
            { code: 'SYN-PERM-03', label: '합성 권한 셋', isGranted: false, isUnlisted: false },
          ],
        },
      ],
    });

    // `<td>`의 접근 역할은 `cell`이다 — 표 자체의 `role="grid"`와 별개다.
    expect(
      within(pane())
        .getAllByRole('cell')
        .map((cell) => cell.getAttribute('aria-label')),
    ).toEqual([
      'SYN-ROLE-01 · 합성 권한 하나 · 부여됨',
      'SYN-ROLE-01 · 합성 권한 셋 · 부여되지 않음',
    ]);
  });

  it('이름 없는 칸이 하나도 없다', () => {
    renderPane();

    for (const cell of within(pane()).getAllByRole('cell')) {
      expect(cell.getAttribute('aria-label')).toBeTruthy();
    }
  });
});

describe('PermissionGridPane 저장', () => {
  /** 고친 것이 없으면 주 액션을 **비활성 + 사유**로 둔다(배치 규범 4). */
  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', () => {
    renderPane({ isDirty: false });

    expect(within(pane()).getByText('저장은 고친 내용이 있을 때 누를 수 있습니다.')).toBeTruthy();
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

    expect(within(pane()).getByRole('button', { name: '취소' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('저장 실패 배너를 맨 위에 그대로 낸다', () => {
    renderPane({ banner: <p>합성 저장 실패</p> });

    expect(within(pane()).getByText('합성 저장 실패')).toBeTruthy();
  });
});

describe('PermissionGridPane 안내', () => {
  it('조작 안내가 항상 보이고 격자보다 앞에 있다', () => {
    renderPane();

    const note = within(pane()).getByText(NOTE);
    const grid = within(pane()).getByRole('grid');

    expect(note.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('격자가 그 안내를 가리킨다', () => {
    renderPane();

    const noteId = within(pane()).getByText(NOTE).getAttribute('id');

    expect(noteId).toBeTruthy();
    expect(within(pane()).getByRole('grid').getAttribute('aria-describedby')).toBe(noteId);
  });

  /** 후보에 없는데 부여돼 있는 열이 섰다는 사실을 **감추지 않는다.** */
  it('목록에 없는 권한 안내를 넘기면 그대로 낸다', () => {
    renderPane({ unlistedNotice: <p>합성 미등재 안내</p> });

    expect(within(pane()).getByText('합성 미등재 안내')).toBeTruthy();
  });
});

describe('PermissionGridPane 빈 상태와 실패', () => {
  /**
   * ⭐ **열이 0개면 「줄 수 있는 권한이 없다」다** — 「부여된 권한이 없다」가 아니다.
   * 후보 목록이 비었거나 못 받은 것이고, 부여분이 0건인 것과는 다른 사실이다.
   */
  it('열이 하나도 없으면 격자 대신 빈 상태가 나온다', () => {
    renderPane({ groups: [] });

    expect(within(pane()).getByText('부여할 수 있는 기능 권한이 없습니다')).toBeTruthy();
    expect(within(pane()).queryByRole('grid')).toBeNull();
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
  it('조회 실패에는 격자도 빈 상태도 내지 않는다', () => {
    renderPane({ loadError: <p>합성 조회 실패</p> });

    expect(within(pane()).getByText('합성 조회 실패')).toBeTruthy();
    expect(within(pane()).queryByRole('grid')).toBeNull();
    expect(within(pane()).queryByText('부여할 수 있는 기능 권한이 없습니다')).toBeNull();
  });

  it('불러오는 중에는 격자 대신 진행 표시가 나온다', () => {
    renderPane({ isLoading: true });

    expect(within(pane()).getByRole('status', { name: '기능 권한을 불러오는 중' })).toBeTruthy();
    expect(within(pane()).queryByRole('grid')).toBeNull();
  });
});
