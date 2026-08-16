import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  PartnerRoleConfirmDialog,
  type PartnerRoleConfirmDialogProps,
} from './partner-role-confirm-dialog';
import type { PartnerRoleOption } from './partner-role-draft';
/* 코드 글자를 시험이 다시 적지 않는다(결정 2) — 리터럴은 어휘 고정 감지기 한 자리에만 둔다. */
import { PARTNER_ROLE_CODES } from './partner-role-vocab';

const RELEASED: PartnerRoleOption[] = [
  { roleTypeCode: PARTNER_ROLE_CODES.customer, label: '고객사', isKnown: true },
  { roleTypeCode: 'SAMPLE-ROLE-X', label: '샘플 역할 엑스', isKnown: false },
];

const renderDialog = (overrides: Partial<PartnerRoleConfirmDialogProps> = {}) => {
  const props: PartnerRoleConfirmDialogProps = {
    released: RELEASED,
    willHaveNoRole: false,
    isSaving: false,
    banner: null,
    onConfirm: vi.fn<() => void>(),
    onClose: vi.fn<() => void>(),
    ...overrides,
  };

  render(<PartnerRoleConfirmDialog {...props} />);

  return { props, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('PartnerRoleConfirmDialog — 잃는 것을 전부 밝힌다 (결정 10)', () => {
  /*
   * **해제되는 역할의 이름이 전부 나온다.** 통째 교체라 목록에 없는 역할은 해제되는데,
   * 창이 그 이름을 밝히지 않으면 사용자는 자기가 무엇을 잃는지 모른 채 확인을 누른다.
   */
  it('해제되는 역할 이름이 전부 나열된다', () => {
    renderDialog();

    const panel = dialog();

    expect(within(panel).getByText('저장하면 아래 역할이 해제됩니다.')).toBeInTheDocument();
    expect(within(panel).getByText('고객사')).toBeInTheDocument();
    expect(within(panel).getByText('샘플 역할 엑스')).toBeInTheDocument();
  });

  it('해제되지 않는 역할은 창에 나오지 않는다', () => {
    renderDialog();

    const panel = dialog();

    /* 짝 방향 — 창이 실제로 그려졌다(아무것도 없어서 통과하는 것이 아니다). */
    expect(within(panel).getByText('고객사')).toBeInTheDocument();
    expect(within(panel).queryByText('공급사')).not.toBeInTheDocument();
  });

  /*
   * 어휘 밖 코드가 가장 위험한 자리다 — 화면에서 다시 붙일 수 없으므로
   * 무엇이 사라지는지 창에서마저 흐려지면 되돌릴 단서가 남지 않는다.
   */
  it('어휘 밖 역할에는 모르는 역할 표식이 함께 붙는다', () => {
    renderDialog();

    expect(within(dialog()).getByText('이 화면이 모르는 역할')).toBeInTheDocument();
  });

  /*
   * 이름과 표식이 붙어 읽히지 않게 **낱말 공백 하나**가 든다(페인 쪽과 같은 규율).
   * 페인은 체크칸의 접근 이름이 그 공백을 재지만 창의 `<li>`에는 접근 이름이 없다 —
   * `getByText`는 직계 텍스트 노드만 보므로 공백이 없어도 통과한다. 줄 전체를 재야 잡힌다.
   */
  it('어휘 밖 역할의 이름과 표식이 붙어 읽히지 않는다', () => {
    renderDialog();

    const rows = within(dialog())
      .getAllByRole('listitem')
      .map((row) => row.textContent);

    expect(rows).toEqual(['고객사', '샘플 역할 엑스 이 화면이 모르는 역할']);
  });

  it('어휘 안 역할만 해제되면 그 표식이 붙지 않는다', () => {
    renderDialog({ released: [RELEASED[0]!] });

    const panel = dialog();

    expect(within(panel).getByText('고객사')).toBeInTheDocument();
    expect(within(panel).queryByText('이 화면이 모르는 역할')).not.toBeInTheDocument();
  });

  /* 화면 스펙이 명시적으로 요구하는 갈래다 — 계약이 빈 배열을 「전부 해제」로 정의한다. */
  it('전부 해제하는 저장에서는 하나도 남지 않는다는 사실을 함께 낸다', () => {
    renderDialog({ willHaveNoRole: true });

    expect(
      within(dialog()).getByText('저장하면 이 거래처의 역할이 하나도 남지 않습니다.'),
    ).toBeInTheDocument();
  });

  it('남는 역할이 있으면 그 문장을 내지 않는다', () => {
    renderDialog();

    const panel = dialog();

    expect(within(panel).getByText('고객사')).toBeInTheDocument();
    expect(
      within(panel).queryByText('저장하면 이 거래처의 역할이 하나도 남지 않습니다.'),
    ).not.toBeInTheDocument();
  });
});

describe('PartnerRoleConfirmDialog — 스치는 클릭으로 닫히지 않는다', () => {
  /*
   * **스크림 클릭으로 닫히지 않는다**(`closeOnBackdropClick={false}`). 되돌릴 수 없는 조작을
   * 확인하는 창이 스치는 클릭에 사라지면 확인 자체가 형식이 된다.
   *
   * 설치본은 `<dialog>` 자신이 클릭 대상일 때만 닫기를 부른다(실측) — 그 자리를 그대로 누른다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { props } = renderDialog();

    fireEvent.click(dialog());

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('닫기 손잡이가 없다', () => {
    renderDialog();

    expect(within(dialog()).queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });

  it('바닥 버튼 둘로만 나간다', async () => {
    const { props, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '계속 편집' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '해제하고 저장' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  /**
   * **Escape는 막을 수 없다** — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다. 규율은 「닫히지 않게」가 아니라 「닫혀도 무너지지 않게」다 —
   * 화면이 그 요청을 `onClose`로 받아 나가는 중인 쓰기를 끊지 않고 창만 거둔다.
   */
  it('Escape는 닫기 요청으로 이어지고 저장으로 이어지지 않는다', () => {
    const { props } = renderDialog();

    fireEvent(dialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});

describe('PartnerRoleConfirmDialog — 저장 중과 실패', () => {
  it('저장 중에는 두 버튼이 잠긴다', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: '해제하고 저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '계속 편집' })).toBeDisabled();
  });

  /* **실패해도 창을 닫지 않는다** — 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('저장 실패 배너를 창 안에 낸다', () => {
    renderDialog({ banner: <p>저장하지 못했습니다</p> });

    expect(within(dialog()).getByText('저장하지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '해제하고 저장' })).toBeInTheDocument();
  });

  /* 이 창은 값을 고치는 자리가 아니라 확인하는 자리다 — 고칠 것이 있으면 닫고 고친다. */
  it('창 안에 고치는 칸이 없다', () => {
    renderDialog();

    const panel = dialog();

    expect(within(panel).getByText('고객사')).toBeInTheDocument();
    expect(within(panel).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(panel).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(panel).queryAllByRole('combobox')).toHaveLength(0);
  });
});
