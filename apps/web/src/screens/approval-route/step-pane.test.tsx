import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toApproverOptions } from './approver-options';
import { ENABLED_APPROVER_TYPE_CODES, toApproverTypeOptions } from './code-options';
import { APPROVER_OPTION_LABEL, stepDraftFixtures, userFixtures } from './fixtures';
import { STEP_COLUMN_WIDTH, StepPane, type StepPaneProps } from './step-pane';
import type { StepDraft } from './step-draft';

const t = messages.approvalRoute;

const approverOptions = toApproverOptions(userFixtures);

const paneElement = (overrides: Partial<StepPaneProps> = {}) => (
  <StepPane
    drafts={stepDraftFixtures}
    isLoading={false}
    loadError={null}
    banner={null}
    approverOptions={approverOptions}
    approverTypeOptions={toApproverTypeOptions(ENABLED_APPROVER_TYPE_CODES)}
    isLocked={false}
    saveDisabledReason={null}
    onAdd={() => undefined}
    onRemove={() => undefined}
    onReorder={() => undefined}
    onSave={() => undefined}
    {...overrides}
  />
);

const renderPane = (overrides: Partial<StepPaneProps> = {}) => render(paneElement(overrides));

/** 제목 줄 「단계 추가」로 추가 줄을 펼친다(사용자 지시 2026-11-25 — 기본은 접혀 있다). */
const openAddRow = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.addStep }));
};

const rowOf = (text: string): HTMLElement =>
  screen.getAllByRole('row').find((row) => within(row).queryByText(text) !== null) as HTMLElement;

const draftOf = (approverUserId: number | null, draftId: string): StepDraft => ({
  draftId,
  approverUserId,
  approverName: approverUserId === null ? null : `합성 승인자${String(approverUserId)}`,
  approverDepartmentName: null,
  approverIsActive: true,
});

describe('StepPane — 단계 표', () => {
  it('단계마다 한 줄을 낸다', () => {
    renderPane();

    expect(screen.getAllByRole('row')).toHaveLength(stepDraftFixtures.length + 1);
  });

  /**
   * **순서는 배열의 위치다.** 서버가 준 순서 값을 그리면 행을 옮긴 뒤 표시와 자료가 어긋난다 —
   * 보내는 것은 지금 보이는 순서이므로 보이는 것도 지금 순서여야 한다.
   */
  it('순서를 배열 위치로 매긴다', () => {
    renderPane({ drafts: [draftOf(9305, 'e'), draftOf(9301, 'a')] });

    expect(within(rowOf('합성 승인자9305')).getByText('1')).toBeInTheDocument();
    expect(within(rowOf('합성 승인자9301')).getByText('2')).toBeInTheDocument();
  });

  it('승인자 이름과 부서를 응답 값 그대로 쓴다', () => {
    renderPane();

    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
  });

  it('이름이 오지 않은 승인자는 번호가 아니라 사유로 적는다', () => {
    renderPane();

    // 선행 단언 — 이름이 있는 줄은 이름이 나와야 「번호가 없다」가 뜻을 갖는다.
    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
    expect(screen.getByText(t.values.approverUnknown)).toBeInTheDocument();
    expect(screen.getByRole('table').textContent).not.toContain('9303');
    expect(screen.getByRole('table').textContent).not.toContain('9203');
  });

  it('사용 중지된 승인자에 글자 표식과 사유가 함께 선다', () => {
    renderPane();

    const row = rowOf('합성 승인자2 · 합성부서 나');

    expect(within(row).getByText(messages.common.usage.inactive)).toBeInTheDocument();
    expect(within(row).getByText(t.notes.approverInactiveWarning)).toBeInTheDocument();
  });

  it('사용 중인 승인자에는 경고를 붙이지 않는다', () => {
    renderPane();

    const row = rowOf('합성 승인자1 · 합성부서 가');

    expect(within(row).getByText(messages.common.usage.active)).toBeInTheDocument();
    expect(within(row).queryByText(t.notes.approverInactiveWarning)).not.toBeInTheDocument();
  });
});

/**
 * **같은 승인자가 두 단계에 오는 것을 막지 않는다.** 같은 사람이 다른 자격으로 두 번 결재하는
 * 것은 업무상 정당할 수 있고, 계약도 이슈도 그것을 금지하지 않았다 — 보이기만 한다.
 */
describe('StepPane — 같은 승인자 경고', () => {
  const duplicated = [draftOf(9301, 'a'), draftOf(9302, 'b'), draftOf(9301, 'c')];

  it('겹치는 승인자의 두 줄에 모두 경고가 선다', () => {
    renderPane({ drafts: duplicated });

    expect(screen.getAllByText(t.notes.approverDuplicateWarning)).toHaveLength(2);
  });

  it('겹치지 않는 줄에는 경고가 없다', () => {
    renderPane({ drafts: duplicated });

    expect(
      within(rowOf('합성 승인자9302')).queryByText(t.notes.approverDuplicateWarning),
    ).toBeNull();
  });

  it('겹치는 승인자가 없으면 경고가 아예 없다', () => {
    renderPane();

    expect(screen.queryByText(t.notes.approverDuplicateWarning)).toBeNull();
  });

  it('겹쳐도 저장을 막지 않는다', () => {
    renderPane({ drafts: duplicated });

    expect(screen.getByRole('button', { name: t.actions.saveSteps })).toBeEnabled();
  });
});

describe('StepPane — 순서 이동', () => {
  /**
   * 이동 열은 디자인 시스템이 렌더하고 접근성 처리(포커스 이동·이동 뒤 라이브 안내)도 맡는다.
   * 두 버튼의 접근 이름은 **행마다 같다** — 행 맥락은 표 구조와 라이브 안내가 준다.
   */
  it('행마다 위·아래 이동 버튼이 선다', () => {
    renderPane();

    expect(screen.getAllByRole('button', { name: '위로 이동' })).toHaveLength(
      stepDraftFixtures.length,
    );
    expect(screen.getAllByRole('button', { name: '아래로 이동' })).toHaveLength(
      stepDraftFixtures.length,
    );
  });

  it('첫 행의 위로·마지막 행의 아래로가 잠긴다', () => {
    renderPane();

    const up = screen.getAllByRole('button', { name: '위로 이동' });
    const down = screen.getAllByRole('button', { name: '아래로 이동' });

    expect(up[0]).toBeDisabled();
    expect(up[1]).toBeEnabled();
    expect(down[down.length - 1]).toBeDisabled();
    expect(down[0]).toBeEnabled();
  });

  it('아래로를 누르면 그 위치에서 다음 위치로 옮기라고 알린다', async () => {
    const onReorder = vi.fn();
    const user = userEvent.setup();

    renderPane({ onReorder });
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);

    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('위로를 누르면 그 위치에서 앞 위치로 옮기라고 알린다', async () => {
    const onReorder = vi.fn();
    const user = userEvent.setup();

    renderPane({ onReorder });
    await user.click(screen.getAllByRole('button', { name: '위로 이동' })[2] as HTMLElement);

    expect(onReorder).toHaveBeenCalledWith(2, 1);
  });

  /** 전송 중에는 열 자체를 내지 않는다 — 눌러도 아무 일이 없는 버튼을 남기는 것보다 정직하다. */
  it('전송 중에는 이동 버튼이 모두 잠긴다', () => {
    renderPane({ isLocked: true });

    for (const button of [
      ...screen.getAllByRole('button', { name: '위로 이동' }),
      ...screen.getAllByRole('button', { name: '아래로 이동' }),
    ]) {
      expect(button).toBeDisabled();
    }
  });

  /* 단계 수는 표와 같은 기준으로 카드 제목 옆에 낸다(사용자 지시 2026-11-24). */
  /* 제목 바로 뒤에 다른 화면 목록 건수와 같은 모양으로, [단계 추가]는 오른쪽 끝(사용자 지시 2026-11-25). */
  it('카드 제목 바로 뒤에 표의 줄 수만큼 「총 N단계」를 건수 모양으로 낸다', () => {
    renderPane();

    const count = screen.getByText(t.values.stepCountOf(stepDraftFixtures.length));
    const heading = screen.getByRole('heading', { name: t.panes.steps });
    const addButton = screen.getByRole('button', { name: t.actions.addStep });

    expect(count).toHaveClass('po-board-list-count');
    expect(heading.nextElementSibling).toBe(count);
    expect(count.parentElement).toBe(heading.parentElement);
    expect(addButton.parentElement).toBe(heading.parentElement);
    expect(heading.parentElement?.lastElementChild).toBe(addButton);
  });
});

describe('StepPane — 삭제', () => {
  it('행마다 그 순서를 담은 삭제 버튼이 선다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.actions.removeStep(1) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.removeStep(3) })).toBeInTheDocument();
  });

  it('삭제는 그 행의 식별자로 알린다', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    renderPane({ onRemove });
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(2) }));

    expect(onRemove).toHaveBeenCalledWith('saved:9202');
  });

  /**
   * **마지막 한 단계는 지울 수 없다.** 저장 잠금(단계 0)보다 한 걸음 앞선 방어다 —
   * 지운 뒤에 「저장할 수 없다」고 말하면 사용자는 이미 화면에서 그것을 잃은 뒤다.
   */
  it('단계가 하나뿐이면 삭제가 잠기고 사유가 그 버튼의 설명이 된다', () => {
    renderPane({ drafts: [draftOf(9301, 'a')] });

    const button = screen.getByRole('button', { name: t.actions.removeStep(1) });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.actionReasons.stepRemoveLast);
  });

  it('단계가 하나뿐일 때 삭제를 눌러도 알리지 않는다', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    renderPane({ drafts: [draftOf(9301, 'a')], onRemove });
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(1) }));

    expect(onRemove).not.toHaveBeenCalled();
  });

  it('전송 중에는 삭제가 잠긴다', () => {
    renderPane({ isLocked: true });

    expect(screen.getByRole('button', { name: t.actions.removeStep(1) })).toBeDisabled();
  });

  /**
   * **지울 것이 없으면 「지울 수 없다」고 말하지 않는다.**
   *
   * 사유는 삭제 버튼의 설명이라 그 버튼이 없으면 가리킬 대상이 없다 — 빈 상태 안내
   * (「이 결재선에는 결재 단계가 없습니다」) 옆에 서면 사용자는 지울 것도 없는 화면에서
   * 지울 수 없다는 말을 읽는다. `aria-describedby`가 가리키는 요소도 없는 고아 `id`가 된다.
   */
  it('단계가 0줄이면 삭제 사유가 서지 않는다', () => {
    renderPane({ drafts: [] });

    // 선행 단언 — 실제로 빈 상태여야 이 감지기가 뜻을 갖는다.
    expect(screen.getByText(t.empty.noStepsTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.removeStep(1) })).toBeNull();
    expect(screen.queryByText(t.actionReasons.stepRemoveLast)).toBeNull();
  });

  /** 짝 방향 — 한 줄이면 사유가 서고, 그것이 그 버튼의 설명이다. */
  it('단계가 한 줄이면 삭제 사유가 선다', () => {
    renderPane({ drafts: [draftOf(9301, 'a')] });

    expect(screen.getByText(t.actionReasons.stepRemoveLast)).toBeInTheDocument();
  });

  /* 사유는 제목 줄의 라벨이다 — 「총 N단계」 뒤, [단계 추가] 앞(사용자 지시 2026-11-25). */
  it('삭제 사유는 제목 줄에 「총 N단계」 다음 라벨로 선다', () => {
    renderPane({ drafts: [draftOf(9301, 'a')] });

    const heading = screen.getByRole('heading', { name: t.panes.steps });
    const headingRow = heading.parentElement as HTMLElement;
    const reason = within(headingRow).getByText(t.actionReasons.stepRemoveLast);
    const count = within(headingRow).getByText(t.values.stepCountOf(1));
    const chip = count.nextElementSibling as HTMLElement;

    expect(chip).toContainElement(reason);
    expect(chip.nextElementSibling).toBe(
      within(headingRow).getByRole('button', { name: t.actions.addStep }),
    );
  });

  it('단계가 둘 이상이면 삭제 사유 라벨이 서지 않는다', () => {
    renderPane();

    expect(screen.queryByText(t.actionReasons.stepRemoveLast)).toBeNull();
  });
});

/**
 * **추가 줄은 표 밖이다.** 표는 디자인 시스템이 가로 넘침 상자로 감싸므로 셀 안의 펼침 목록이
 * 상자 경계에서 잘릴 수 있다 — 이 저장소 이슈 #45와 같은 형태의 자리를 만들지 않는다.
 */
describe('StepPane — 추가 줄', () => {
  /* 추가 줄은 접혀 있다가 제목 줄 「단계 추가」로 펼친다(사용자 지시 2026-11-25). */
  it('처음에는 추가 줄이 접혀 있고 「단계 추가」가 제목 줄에 선다', () => {
    renderPane();

    expect(screen.queryByRole('combobox', { name: t.fields.approverSelect })).toBeNull();
    expect(screen.queryByRole('combobox', { name: t.fields.approverType })).toBeNull();

    const heading = screen.getByRole('heading', { name: /결재 단계/ });
    const headingRow = heading.parentElement as HTMLElement;
    expect(within(headingRow).getByRole('button', { name: t.actions.addStep })).toBeInTheDocument();
    expect(headingRow).toHaveTextContent(t.values.stepCountOf(stepDraftFixtures.length));
  });

  it('「단계 추가」를 누르면 표 아래에 결재자 유형 · 결재자 줄이 펼쳐지고 취소로 접힌다', async () => {
    const user = userEvent.setup();
    renderPane();

    await openAddRow(user);

    expect(screen.getByRole('combobox', { name: t.fields.approverType })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.addStep })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('combobox', { name: t.fields.approverSelect })).toBeNull();
    expect(screen.getByRole('button', { name: t.actions.addStep })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('승인자 선택칸이 표 밖에 있다', async () => {
    const user = userEvent.setup();
    renderPane();
    await openAddRow(user);

    const table = screen.getByRole('table');
    const combobox = screen.getByRole('combobox', { name: t.fields.approverSelect });

    // 선행 단언 — 표와 선택칸이 둘 다 있어야 「표 밖이다」가 뜻을 갖는다.
    expect(table).toBeInTheDocument();
    expect(table.contains(combobox)).toBe(false);
  });

  it('표 셀 안에 선택칸이 없다', async () => {
    const user = userEvent.setup();
    renderPane();
    await openAddRow(user);

    expect(within(screen.getByRole('table')).queryAllByRole('combobox')).toHaveLength(0);
  });

  it('고른 승인자로 추가를 알리고 줄을 접는다', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    renderPane({ onAdd });
    await openAddRow(user);
    await user.click(screen.getByRole('combobox', { name: t.fields.approverSelect }));
    await user.click(screen.getByRole('option', { name: APPROVER_OPTION_LABEL }));
    await user.click(screen.getByRole('button', { name: t.actions.confirmAddStep }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ appUserId: 9304 }));
    expect(screen.queryByRole('combobox', { name: t.fields.approverSelect })).toBeNull();
  });

  it('추가한 뒤 다시 펼치면 선택칸이 비어 있다 — 같은 사람을 두 번 넣는 실수를 줄인다', async () => {
    const user = userEvent.setup();

    renderPane();
    await openAddRow(user);
    await user.click(screen.getByRole('combobox', { name: t.fields.approverSelect }));
    await user.click(screen.getByRole('option', { name: APPROVER_OPTION_LABEL }));
    await user.click(screen.getByRole('button', { name: t.actions.confirmAddStep }));
    await openAddRow(user);

    expect(screen.getByRole('combobox', { name: t.fields.approverSelect })).not.toHaveTextContent(
      APPROVER_OPTION_LABEL,
    );
  });

  it('취소하면 고르던 사람도 함께 버리고 추가를 알리지 않는다', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    renderPane({ onAdd });
    await openAddRow(user);
    await user.click(screen.getByRole('combobox', { name: t.fields.approverSelect }));
    await user.click(screen.getByRole('option', { name: APPROVER_OPTION_LABEL }));
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    await openAddRow(user);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: t.fields.approverSelect })).not.toHaveTextContent(
      APPROVER_OPTION_LABEL,
    );
  });

  /* 결재자 칸의 「결재자를 선택하세요」가 이미 말하므로 사유 글 없이 꺼진 단추만 둔다(사용자 지시 2026-11-24). */
  it('결재자를 고르지 않으면 추가가 잠긴다', async () => {
    const user = userEvent.setup();
    renderPane();
    await openAddRow(user);

    expect(screen.getByRole('button', { name: t.actions.confirmAddStep })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.fields.approverSelect })).toHaveTextContent(
      t.fields.approverPlaceholder,
    );
  });

  it('승인자 목록이 잘리면 그 사실을 밝힌다', async () => {
    const user = userEvent.setup();
    renderPane({ approverNote: t.notes.approverListTruncated });
    await openAddRow(user);

    expect(screen.getByText(t.notes.approverListTruncated)).toBeInTheDocument();
  });

  it('전송 중에는 「단계 추가」와 펼친 추가 줄이 잠긴다', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPane();
    await openAddRow(user);

    rerender(paneElement({ isLocked: true }));

    expect(screen.getByRole('button', { name: t.actions.addStep })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.fields.approverSelect })).toBeDisabled();
  });
});

/**
 * 승인자 구분 — **잠긴 선택지를 감추지 않는다.** 감추면 사용자는 역할·부서 결재가 아예 없는
 * 기능이라고 읽는다(`omf-mes#69`).
 */
describe('StepPane — 승인자 구분', () => {
  /* 「결재자는 사용자만 고를 수 있습니다.」 ⓘ 는 걷었다(사용자 지시 2026-11-25). */
  it('구분 선택칸 라벨 옆에 ⓘ 가 없다', async () => {
    const user = userEvent.setup();
    renderPane();
    await openAddRow(user);

    const cell = screen
      .getByRole('combobox', { name: t.fields.approverType })
      .closest('.field-cell') as HTMLElement;
    expect(cell.querySelector('.info-tip')).toBeNull();
  });

  it('역할·부서 선택지가 보이되 잠겨 있다', async () => {
    const user = userEvent.setup();

    renderPane();
    await openAddRow(user);
    await user.click(screen.getByRole('combobox', { name: t.fields.approverType }));

    /* 디자인 시스템이 선택지를 네이티브 요소가 아니라 `role="option"`으로 그린다. */
    expect(screen.getByRole('option', { name: t.values.approverTypeUser })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(screen.getByRole('option', { name: t.values.approverTypeRole })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('option', { name: t.values.approverTypeDepartment })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('StepPane — 저장', () => {
  it('저장을 누르면 알린다', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    renderPane({ onSave });
    await user.click(screen.getByRole('button', { name: t.actions.saveSteps }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('막혔으면 비활성 저장과 사유가 함께 서고 사유가 그 버튼의 설명이 된다', () => {
    renderPane({ saveDisabledReason: t.actionReasons.stepSaveNoSteps, drafts: [] });

    const button = screen.getByRole('button', { name: t.actions.saveSteps });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.actionReasons.stepSaveNoSteps);
  });

  it('전송 중에는 저장이 잠긴다', () => {
    renderPane({ isLocked: true });

    expect(screen.getByRole('button', { name: t.actions.saveSteps })).toBeDisabled();
  });

  it('실패 배너를 받은 자리에 낸다', () => {
    renderPane({ banner: <p>단계 저장 실패 배너</p> });

    expect(screen.getByText('단계 저장 실패 배너')).toBeInTheDocument();
  });
});

describe('StepPane — 제목 ⓘ', () => {
  /* 제목 옆 규칙 ⓘ 는 걷었다(사용자 지시 2026-11-25). */
  it('결재 단계 제목 줄에 ⓘ 단추가 없다', () => {
    renderPane();

    const heading = screen.getByRole('heading', { name: t.panes.steps });
    expect(within(heading).queryByRole('button')).toBeNull();
  });
});

describe('StepPane — 빈 상태와 실패', () => {
  it('단계가 0이면 표의 빈 자리가 안내를 맡는다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noStepsTitle)).toBeInTheDocument();
  });

  it('조회 실패는 빈 상태가 아니다', () => {
    renderPane({ drafts: null, loadError: <p>단계 조회 실패 배너</p> });

    expect(screen.getByText('단계 조회 실패 배너')).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noStepsTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 자리 표시를 낸다', () => {
    renderPane({ drafts: null, isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.steps })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noStepsTitle)).not.toBeInTheDocument();
  });

  /** 초안을 세우지 못했으면 **편집 수단을 내지 않는다** — 무엇을 고치는지 알 수 없는 자리다. */
  it('초안을 세우지 못했으면 추가·저장도 내지 않는다', () => {
    renderPane({ drafts: null, isLoading: true });

    expect(screen.queryByRole('button', { name: t.actions.addStep })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.saveSteps })).toBeNull();
  });
});

describe('StepPane — 표의 경계', () => {
  it('정렬 가능한 열을 두지 않는다', () => {
    // 행 순서가 곧 자료다 — 정렬을 켜면 디자인 시스템이 순서 이동을 잠근다.
    renderPane();

    for (const header of screen.getAllByRole('columnheader')) {
      expect(within(header).queryByRole('button')).toBeNull();
    }
  });

  /**
   * 폭 없는 흡수 열은 승인자 하나뿐이다. 나머지 열은 상자 폭에 대한 비율이고(사용자 지시 2026-11-25) 그 합이
   * 상자를 넘지 않아야 결재자 열이 남는 폭을 갖는다.
   */
  it('폭 없는 흡수 열이 하나뿐이고 지정 비율 합이 상자 안이다', () => {
    const { container } = renderPane();

    const cols = [...container.querySelectorAll('col')];

    expect(cols.filter((col) => col.style.width === '' && col.className === '')).toHaveLength(1);

    const widths = Object.values(STEP_COLUMN_WIDTH);
    expect(widths.every((width) => width.endsWith('%'))).toBe(true);

    const sum = widths.reduce((total, width) => total + Number.parseFloat(width), 0);

    expect(sum).toBeLessThan(60);
  });

  /* 모든 열은 가운데 맞춤(사용자 지시 2026-11-25) — 결재자 열 포함. */
  it('표의 머리 칸이 모두 가운데 맞춤이다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader');

    expect(headers).toHaveLength(4);
    for (const header of headers) {
      expect(header).toHaveAttribute('data-align', 'center');
    }
  });
});
