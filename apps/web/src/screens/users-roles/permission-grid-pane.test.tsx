import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PermissionGridPane, type PermissionGridPaneProps } from './permission-grid-pane';

const COLUMNS = [
  { code: 'SYN-PERM-01', isGranted: true },
  { code: 'SYN-PERM-02', isGranted: true },
];

const renderPane = (overrides: Partial<PermissionGridPaneProps> = {}) => {
  render(
    <PermissionGridPane
      roleLabel="SYN-ROLE-01"
      columns={COLUMNS}
      isLoading={false}
      loadError={null}
      {...overrides}
    />,
  );

  return { user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '기능 권한' });

const NOTE = /기능 권한은 권한 목록이 확정된 뒤에/;

describe('PermissionGridPane 격자', () => {
  it('부여된 코드가 격자의 열로 나온다', () => {
    renderPane();

    // 첫 머리글은 행 라벨 칸의 모서리다(디자인 시스템이 붙인다) — 자료 열은 그 뒤부터다.
    expect(
      within(pane())
        .getAllByRole('columnheader')
        .slice(1)
        .map((header) => header.textContent),
    ).toEqual(['SYN-PERM-01', 'SYN-PERM-02']);
  });

  /** 행은 **고른 역할 하나**다 — 전체 역할을 그리면 여기서 다른 역할을 바꿀 수 있다고 읽힌다. */
  it('행이 고른 역할 하나뿐이다', () => {
    renderPane();

    const rowHeaders = within(pane()).getAllByRole('rowheader');

    expect(rowHeaders).toHaveLength(1);
    expect(rowHeaders[0]?.textContent).toBe('SYN-ROLE-01');
  });

  /**
   * **격자가 비활성이다.** 디자인 시스템은 `onCellClick`을 받을 때만 셀에
   * `tabindex`·`data-clickable`을 붙인다 — 넘기는 순간 격자가 눌린다.
   */
  it('셀에 누를 수 있는 표식이 붙지 않는다', () => {
    renderPane();

    const grid = within(pane()).getByRole('grid');
    const cells = grid.querySelectorAll('tbody td');

    expect(cells.length).toBeGreaterThan(0);

    for (const cell of cells) {
      expect(cell.hasAttribute('data-clickable')).toBe(false);
      expect(cell.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('셀을 눌러도 아무 일이 없다', async () => {
    const { user } = renderPane();

    const cell = within(pane()).getByRole('grid').querySelector('tbody td');

    expect(cell).not.toBeNull();

    if (cell !== null) await user.click(cell);

    // 누를 수 있는 표식이 여전히 없다 — 클릭으로 격자가 열리지 않는다.
    expect(cell?.hasAttribute('data-clickable')).toBe(false);
  });

  /**
   * 셀에 내용이 없으므로 **접근 이름이 그 칸의 유일한 뜻**이다.
   *
   * 디자인 시스템의 자동 조합은 상태가 있는 셀에만 도는데 `'none'`은 「상태 없음」으로
   * 정규화된다 — 화면이 만들지 않으면 **부여되지 않은 칸만** 이름 없는 빈 칸이 된다.
   * 자리표시가 채워지는 날 그 칸이 처음 생기므로 지금 고정해 둔다.
   */
  it('부여된 칸과 부여되지 않은 칸이 서로 다른 접근 이름을 갖는다', () => {
    renderPane({
      columns: [
        { code: 'SYN-PERM-01', isGranted: true },
        { code: 'SYN-PERM-03', isGranted: false },
      ],
    });

    // `<td>`의 접근 역할은 `cell`이다 — 표 자체의 `role="grid"`와 별개다.
    expect(
      within(pane()).getByRole('cell', { name: 'SYN-ROLE-01 · SYN-PERM-01 · 부여됨' }),
    ).toBeInTheDocument();
    expect(
      within(pane()).getByRole('cell', { name: 'SYN-ROLE-01 · SYN-PERM-03 · 부여되지 않음' }),
    ).toBeInTheDocument();
  });

  it('이름 없는 칸이 하나도 없다', () => {
    renderPane({
      columns: [
        { code: 'SYN-PERM-01', isGranted: true },
        { code: 'SYN-PERM-03', isGranted: false },
      ],
    });

    const cells = [...within(pane()).getByRole('grid').querySelectorAll('tbody td')];

    expect(cells).toHaveLength(2);

    for (const cell of cells) {
      expect(cell.getAttribute('aria-label')).not.toBe(null);
      expect(cell.getAttribute('aria-label')).not.toBe('');
    }
  });

  /** 누를 수 있는 저장이 없으면 「비활성 저장 버튼」도 두지 않는다(계획 결정 5·9). */
  it('저장 버튼이 없다', () => {
    renderPane();

    expect(within(pane()).queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    expect(within(pane()).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('PermissionGridPane 안내', () => {
  /**
   * 비활성 컨트롤은 포커스를 받지 못해 사유를 시각으로만 두면 보조기술이 닿을 수 없다 —
   * 감추지 않고 항상 보이는 DOM 텍스트로 두고 `aria-describedby`로 잇는다(배치 규범 4).
   */
  it('안내가 항상 보이고 격자보다 앞에 있다', () => {
    renderPane();

    const note = within(pane()).getByText(NOTE);
    const grid = within(pane()).getByRole('grid');

    expect(note).toBeVisible();
    expect(note.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('격자가 그 안내를 가리킨다', () => {
    renderPane();

    const note = within(pane()).getByText(NOTE);

    expect(within(pane()).getByRole('grid')).toHaveAttribute('aria-describedby', note.id);
  });

  /** 여러 컨트롤이 함께 보는 안내라 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다. */
  it('안내가 무엇에 대한 것인지로 시작한다', () => {
    renderPane();

    expect(within(pane()).getByText(NOTE).textContent?.startsWith('기능 권한은')).toBe(true);
  });

  it('부여분이 없어도 안내는 그대로 보인다', () => {
    renderPane({ columns: [] });

    expect(within(pane()).getByText(NOTE)).toBeVisible();
  });
});

describe('PermissionGridPane 빈 상태와 실패', () => {
  /** 열 없는 격자는 라벨 칸만 남은 빈 표가 된다. */
  it('부여된 권한이 0개면 격자 대신 빈 상태가 나온다', () => {
    renderPane({ columns: [] });

    expect(within(pane()).queryByRole('grid')).not.toBeInTheDocument();
    expect(within(pane()).getByText('이 역할에 부여된 기능 권한이 없습니다')).toBeInTheDocument();
  });

  it('빈 상태도 같은 안내를 가리킨다', () => {
    renderPane({ columns: [] });

    const note = within(pane()).getByText(NOTE);

    expect(within(pane()).getByRole('status')).toHaveAttribute('aria-describedby', note.id);
  });

  /**
   * 실패를 「부여된 권한이 없습니다」로 내면 **없는 사실을 단정한다** —
   * 없는 것이 아니라 못 불러온 것이다.
   */
  it('조회 실패에는 격자도 빈 상태도 내지 않는다', () => {
    renderPane({ columns: [], loadError: <p>권한 조회 실패 표시</p> });

    expect(screen.getByText('권한 조회 실패 표시')).toBeInTheDocument();
    expect(within(pane()).queryByRole('grid')).not.toBeInTheDocument();
    expect(within(pane()).queryByText('이 역할에 부여된 기능 권한이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 격자 대신 진행 표시가 나온다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '기능 권한을 불러오는 중' })).toBeInTheDocument();
    expect(within(pane()).queryByRole('grid')).not.toBeInTheDocument();
  });
});
