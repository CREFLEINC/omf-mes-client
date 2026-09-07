import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlanActionDialog, type PlanActionDialogProps } from './plan-action-dialog';
import {
  VersionTransitionDialog,
  type VersionTransitionDialogProps,
} from './version-transition-dialog';

const t = messages.inspectionStandard;

const renderPlanAction = (overrides: Partial<PlanActionDialogProps> = {}) => {
  const props: PlanActionDialogProps = {
    open: true,
    kind: 'approve',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isSaving: false,
    banner: null,
    ...overrides,
  };

  return { ...render(<PlanActionDialog {...props} />), props };
};

const renderVersionTransition = (overrides: Partial<VersionTransitionDialogProps> = {}) => {
  const props: VersionTransitionDialogProps = {
    open: true,
    kind: 'confirm',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isSaving: false,
    banner: null,
    ...overrides,
  };

  return { ...render(<VersionTransitionDialog {...props} />), props };
};

describe('PlanActionDialog — 문면 잣대', () => {
  /**
   * ⭐ **승인은 되돌릴 수 없고 기록 주체는 서버다.** 제목·버튼만 검사하면 이 두 사실을
   * 본문에서 지워도 통과한다. 사실 → 제공되지 않는 되돌림 → 기록 주체의 순서도 함께 문다.
   */
  it('승인의 비가역성과 서버 기록을 차례로 밝힌다', () => {
    renderPlanAction();

    const description = t.dialog.approveDescription;
    const irreversibleAt = description.indexOf('되돌릴 수 없습니다');
    const noUndoAt = description.indexOf('승인 해제는 제공되지 않습니다');
    const serverAt = description.indexOf('서버가 기록합니다');

    expect(screen.getByRole('dialog', { name: t.dialog.approveTitle })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(irreversibleAt).toBeGreaterThanOrEqual(0);
    expect(irreversibleAt).toBeLessThan(noUndoAt);
    expect(noUndoAt).toBeLessThan(serverAt);
    expect(screen.getByRole('button', { name: t.actions.approve })).toBeInTheDocument();
  });

  /** 사용 중지는 삭제가 아니며 앞으로 적용되지 않는다는 두 사실을 함께 말해야 한다. */
  it('사용 중지가 삭제가 아니고 새 검사에서 적용되지 않음을 밝힌다', () => {
    renderPlanAction({ kind: 'deactivate' });

    const description = t.dialog.deactivateDescription;

    expect(screen.getByRole('dialog', { name: t.dialog.deactivateTitle })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(description).toContain('삭제하지 않습니다');
    expect(description).toContain('새 검사');
    expect(description).toContain('쓸 수 없게 됩니다');
    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeInTheDocument();
  });
});

describe('VersionTransitionDialog — 문면 잣대', () => {
  /** 확정은 편집을 잠그며 이후 변경 경로가 신규 버전임을 순서대로 말한다. */
  it('확정 뒤 편집 잠금과 신규 버전 경로를 밝힌다', () => {
    renderVersionTransition();

    const description = t.dialog.confirmDescription;
    const lockAt = description.indexOf('더 이상 수정할 수 없습니다');
    const nextAt = description.indexOf('신규 버전');

    expect(screen.getByRole('dialog', { name: t.dialog.confirmTitle })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(lockAt).toBeLessThan(nextAt);
    expect(screen.getByRole('button', { name: t.actions.confirm })).toBeInTheDocument();
  });

  /** 폐기는 삭제와 다르지만 새 검사에 쓸 수 없다는 업무 결과를 함께 말한다. */
  it('폐기가 삭제가 아니고 새 검사에서 적용되지 않음을 밝힌다', () => {
    renderVersionTransition({ kind: 'obsolete' });

    const description = t.dialog.obsoleteDescription;

    expect(screen.getByRole('dialog', { name: t.dialog.obsoleteTitle })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(description).toContain('삭제하지 않습니다');
    expect(description).toContain('새 검사');
    expect(description).toContain('쓸 수 없게 됩니다');
    expect(screen.getByRole('button', { name: t.actions.obsolete })).toBeInTheDocument();
  });
});

describe.each([
  ['기준 상태 변경', renderPlanAction],
  ['버전 상태 전이', renderVersionTransition],
] as const)('%s 확인 창 — 경계', (_name, renderDialog) => {
  /**
   * ⭐ 나가는 길을 바닥 버튼 둘로 좁힌다. 머리 닫기 손잡이는 전송 상태를 받지 않아
   * 보내는 중에도 눌리므로, 취소만 잠그고 손잡이를 남기면 잠근 적이 없는 것과 같다.
   */
  it('머리 닫기 손잡이를 두지 않는다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.close })).toBeNull();
  });

  it('스크림을 눌러도 닫히지 않는다', () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('전송 중에는 창 안의 모든 버튼이 잠긴다', () => {
    renderDialog({ isSaving: true });

    const buttons = screen.getAllByRole('button');

    expect(buttons.length).toBe(2);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  it('대기 중에는 취소와 실행 경로가 각각 열린다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    const buttons = screen.getAllByRole('button');

    expect(buttons.length).toBe(2);
    await user.click(buttons[0]!);
    await user.click(buttons[1]!);

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('실패 배너를 창 안에 유지한다', () => {
    renderDialog({ banner: <p>합성 상태 변경 실패</p> });

    expect(screen.getByText('합성 상태 변경 실패')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toContainElement(screen.getByText('합성 상태 변경 실패'));
  });
});

describe('검사기준 상태 변경 — 결과 문면 잣대', () => {
  /**
   * ⭐ 일반 저장과 구별되는 결과다. 어떤 상태가 바뀌었는지와 완료 시제가 모두 있어야
   * 사용자가 같은 버튼을 다시 누르지 않는다.
   */
  it.each([
    ['승인', t.result.approved, '검사기준', '승인'],
    ['사용 중지', t.result.deactivated, '검사기준', '중지'],
    ['확정', t.result.confirmed, '버전', '확정'],
    ['폐기', t.result.obsoleted, '버전', '폐기'],
  ])('%s 결과가 대상·행위·완료를 말한다', (_name, result, target, action) => {
    expect(result).toContain(target);
    expect(result).toContain(action);
    expect(result).toMatch(/했습니다\.$/);
    expect(result).not.toBe(messages.common.saved);
  });
});
