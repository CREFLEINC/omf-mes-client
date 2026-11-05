import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { routingOperationFixtures } from './fixtures';
import { toOperationDrafts } from './operation-order';
import { OperationsPane, type OperationsPaneProps } from './operations-pane';

const DRAFTS = toOperationDrafts(routingOperationFixtures);

const PROCESS_LABELS: Record<string, string> = { '9001': '사출', '9002': '조립' };

const OPERATIONS_LOCK_REASON =
  '공정 라인은 작성중 Rev에서만 편집할 수 있습니다. 변경하려면 신규 Rev를 발행하세요.';

const renderPane = (overrides: Partial<OperationsPaneProps> = {}) => {
  const props: OperationsPaneProps = {
    drafts: DRAFTS,
    processLabel: (processId) => PROCESS_LABELS[processId] ?? processId,
    isLoading: false,
    isRevisionSelected: true,
    loadError: null,
    optionsNotice: null,
    isEditable: true,
    lockReason: OPERATIONS_LOCK_REASON,
    isDirty: false,
    isSaving: false,
    saveBlockedReason: null,
    dependenciesBlockedReason: null,
    removeBlockedReason: () => null,
    banner: null,
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onOpenDependencies: vi.fn(),
    ...overrides,
  };

  render(<OperationsPane {...props} />);

  return { props, user: userEvent.setup() };
};

const bodyRows = (): HTMLElement[] => screen.getAllByRole('row').slice(1);

describe('OperationsPane', () => {
  /*
   * 서버 채번은 서버 재량이다(연번일 수도, 간격 채번일 수도 있다).
   * 그 값을 그대로 보이면 사용자가 그것을 자료로 읽고 「10번 공정」이라고 부르게 된다.
   */
  it('서버가 순서 값 10·20을 줘도 표시 번호는 1·2다', () => {
    renderPane();

    const rows = bodyRows();
    expect(within(rows[0] as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();
  });

  it('공정과 공정명을 다른 열로 낸다', () => {
    renderPane();

    const first = bodyRows()[0] as HTMLElement;
    expect(within(first).getByText('사출')).toBeInTheDocument();
    expect(within(first).getByText('1차 사출')).toBeInTheDocument();
  });

  /*
   * 확인 아이콘을 7개 늘어놓으면 보조기술에서 의미가 잡히지 않고 열이 화면 폭을 먹는다.
   * 켜진 것의 이름만 이어 한 칸에 낸다.
   */
  /* 「첫 항목 외 N개」로 줄이고, 누르면 칸 안에서 전체를 펼친다(아코디언 · #231). */
  it('관리 항목 열은 「첫 항목 외 N개」로 줄이고, 누르면 전체를 펼치고 다시 누르면 접는다', async () => {
    const { user } = renderPane();

    const first = bodyRows()[0] as HTMLElement;
    const toggle = within(first).getByRole('button', { name: 'MES 관리 외 2개' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(first).queryByRole('list')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const items = within(within(first).getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['MES 관리', '실적 관리', '검사 관리']);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(within(first).queryByRole('list')).not.toBeInTheDocument();
  });

  it('관리 항목이 전부 꺼져 있으면 「없음」을 낸다', () => {
    renderPane();

    expect(within(bodyRows()[1] as HTMLElement).getByText('없음')).toBeInTheDocument();
  });

  /* 서버 비율 0.98 을 화면은 98% 로 보인다(사용자 지시 · #231). */
  it('표준 수율을 퍼센트로 내고 라벨에 (%)를 적는다', () => {
    renderPane();

    expect(screen.getByText('표준 수율(%)')).toBeInTheDocument();
    expect(within(bodyRows()[0] as HTMLElement).getByText('98%')).toBeInTheDocument();
    expect(screen.queryByText('0.98')).not.toBeInTheDocument();
  });

  it('표준 C/T 라벨에 단위 「초」가 있고 값이 없으면 빈 값 표식을 낸다', () => {
    renderPane();

    expect(screen.getByText('표준 C/T(초)')).toBeInTheDocument();
    expect(within(bodyRows()[0] as HTMLElement).getByText('45')).toBeInTheDocument();
    expect(within(bodyRows()[1] as HTMLElement).getAllByText('—').length).toBeGreaterThan(0);
  });

  /*
   * 정렬은 보는 방식이고 재배치는 편집이라 함께 쓰면 결과가 어긋난다.
   * 디자인 시스템도 정렬이 켜지면 순서 이동 버튼을 비활성화한다.
   */
  it('정렬 가능한 열을 두지 않는다 — 헤더에 정렬 버튼도 aria-sort도 없다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBeGreaterThan(0);

    for (const header of headers) {
      expect(within(header).queryByRole('button')).toBeNull();
      expect(header).not.toHaveAttribute('aria-sort');
    }
  });

  it('Rev를 고르기 전에는 선택 안내만 낸다', () => {
    renderPane({ isRevisionSelected: false, drafts: [] });

    expect(screen.getByText('개정을 선택하세요')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('라인이 0건이면 빈 상태를 낸다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('등록된 공정이 없습니다')).toBeInTheDocument();
  });

  it('조회에 실패하면 표도 빈 상태도 내지 않고 받은 오류 표시만 낸다', () => {
    renderPane({ drafts: [], loadError: <p>공정을 불러오지 못했습니다</p> });

    expect(screen.getByText('공정을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 공정이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 스켈레톤을 낸다', () => {
    renderPane({ drafts: [], isLoading: true });

    expect(screen.getByRole('status', { name: '공정 라인을 불러오는 중' })).toBeInTheDocument();
  });

  it('선후행 설정을 막는 이유가 있으면 감추지 않고 사유와 함께 비활성으로 둔다', () => {
    renderPane({ dependenciesBlockedReason: '선후행을 지금은 열 수 없습니다.' });

    expect(screen.getByRole('button', { name: '공정 연결' })).toBeDisabled();
    expect(screen.getByText('선후행을 지금은 열 수 없습니다.')).toBeInTheDocument();
  });

  it('잠긴 Rev 에서도 선후행 설정은 열 수 있다 — 읽기 전용으로 보여 준다', async () => {
    const { props, user } = renderPane({ isEditable: false });

    await user.click(screen.getByRole('button', { name: '공정 연결' }));

    expect(props.onOpenDependencies).toHaveBeenCalledTimes(1);
  });

  it('선택 목록 안내를 받으면 표 위에 낸다', () => {
    renderPane({ optionsNotice: <p>선택 목록을 불러오지 못했습니다.</p> });

    expect(screen.getByText('선택 목록을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});

describe('OperationsPane — 편집', () => {
  it('공정 추가를 누르면 상위에 올린다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '공정 추가' }));

    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  /*
   * 행 안의 아이콘 버튼은 보이는 글자가 없어 접근 이름이 곧 이름이다.
   * 표시 번호를 함께 넣지 않으면 「수정」이 행마다 되풀이돼 어느 행인지 알 수 없다.
   */
  it('행마다 표시 번호가 붙은 수정·삭제를 낸다', async () => {
    const { props, user } = renderPane();
    const rows = bodyRows();

    await user.click(within(rows[1] as HTMLElement).getByRole('button', { name: '2번 공정 수정' }));
    expect(props.onEdit).toHaveBeenCalledWith(DRAFTS[1]?.draftId);

    await user.click(within(rows[0] as HTMLElement).getByRole('button', { name: '1번 공정 삭제' }));
    expect(props.onRemove).toHaveBeenCalledWith(DRAFTS[0]?.draftId);
  });

  /*
   * 순서 이동 열은 디자인 시스템 `Table`이 렌더한다.
   * 첫 행의 위로·마지막 행의 아래로가 비활성인 것도 디자인 시스템의 몫이며, 여기서는 그것이 켜졌는지를 본다.
   */
  it('순서 이동 버튼을 내고 첫 행 위로·마지막 행 아래로는 비활성이다', () => {
    renderPane();
    const rows = bodyRows();

    expect(
      within(rows[0] as HTMLElement).getByRole('button', { name: '위로 이동' }),
    ).toBeDisabled();
    expect(
      within(rows[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    ).toBeEnabled();
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: '위로 이동' })).toBeEnabled();
    expect(
      within(rows[1] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    ).toBeDisabled();
  });

  /** 순서를 바꾸는 것은 초안만 바꾼다. 여기서 저장을 부르지 않는다(공유계약 A-5). */
  it('아래로 이동은 자기 자리와 다음 자리를 올리고 저장은 부르지 않는다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(
      within(bodyRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(
      within(bodyRows()[1] as HTMLElement).getByRole('button', { name: '위로 이동' }),
    );

    expect(props.onReorder).toHaveBeenNthCalledWith(1, 0, 1);
    expect(props.onReorder).toHaveBeenNthCalledWith(2, 1, 0);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('고친 것이 없으면 저장·취소가 비활성이다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('고친 것이 있으면 저장·취소를 눌러 상위에 올린다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(props.onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('저장을 막는 사유가 있으면 저장이 비활성이고 그 사유가 보인다', () => {
    renderPane({
      isDirty: true,
      saveBlockedReason:
        '공정 저장은 Routing 정보에 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(
      screen.getByText(
        '공정 저장은 Routing 정보에 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('저장 실패 배너를 표 위에 낸다', () => {
    renderPane({ banner: <p>공정을 저장하지 못했습니다.</p> });

    expect(screen.getByText('공정을 저장하지 못했습니다.')).toBeInTheDocument();
  });

  /*
   * 확정·폐기 Rev에서는 라인도 잠긴다. 「추가·수정·삭제·순서 이동·저장」이 전부 막히고
   * 무엇이 막혔는지·어떻게 푸는지가 한 번 보인다(여러 컨트롤이 공유하는 안내 — 배치 규범 4의 이탈 조건).
   */
  /*
   * 잠긴 Rev(확정 · 폐기)는 고칠 수단을 세우지 않는다 — 비활성 단추와 사유 문장 대신 조회할 정보만(사용자 지시 · #231).
   * 저장 · 취소는 이 칸이 아니라 설정 탭 맨 아래 줄 몫이고, 그 줄도 잠긴 Rev 에는 세우지 않는다.
   */
  it('잠긴 상태에서는 공정 추가 · 수정 · 삭제 · 순서 이동을 세우지 않고 정보 칸만 낸다', () => {
    /* 상세 카드처럼 저장 줄은 바깥(설정 탭 맨 아래)에 맡긴다. */
    renderPane({ isEditable: false, isDirty: true, showSaveActions: false });

    expect(screen.queryByRole('button', { name: '공정 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /편집/ })).not.toBeInTheDocument();
    for (const row of bodyRows()) {
      expect(within(row).queryByRole('button', { name: /공정 수정$/ })).toBeNull();
      expect(within(row).queryByRole('button', { name: /공정 삭제$/ })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: '위로 이동' })).not.toBeInTheDocument();
    /* 사유 문장은 화면에 펼치지 않는다 — 남은 것은 화면 낭독기용 숨긴 글뿐이다. */
    for (const note of screen.queryAllByText(OPERATIONS_LOCK_REASON)) {
      expect(note.className).toMatch(/visually-hidden/);
    }
    /* 공정 정보는 그대로 보인다. */
    expect(screen.getByText('1차 사출')).toBeInTheDocument();
  });
});
