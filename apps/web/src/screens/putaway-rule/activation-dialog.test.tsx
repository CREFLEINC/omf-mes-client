import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActivationDialog, type ActivationDialogProps } from './activation-dialog';

const t = messages.putawayRule;

const ITEM = 'SYN-ITEM-01 · 합성품목 가';
const LOCATION = 'SYN-LOC-01 · 합성위치 가';

const renderDialog = (overrides: Partial<ActivationDialogProps> = {}) => {
  const props: ActivationDialogProps = {
    intent: 'deactivate',
    itemLabel: ITEM,
    locationLabel: LOCATION,
    remaining: { kind: 'none' },
    isSaving: false,
    banner: null,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };

  return { ...render(<ActivationDialog {...props} />), props };
};

describe('ActivationDialog — 사용 중지', () => {
  /** 무엇을 끄는지 이름으로 말한다 — 확인 창이 대상을 밝히지 않으면 무엇을 확인한 것인지 모른다. */
  it('무엇을 끄는지 품목·위치 이름으로 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.deactivateTarget(ITEM, LOCATION))).toBeInTheDocument();
  });

  /**
   * ⭐ **제목이 갈래를 따른다.** 창의 제목은 사용자가 가장 먼저 읽는 문장이고, 바닥 버튼과
   * 함께 「지금 무엇을 확인하는가」를 정한다 — 켜려고 연 창이 「사용 중지할까요?」라고 물으면
   * 사용자는 반대 조작을 확인한 것으로 읽는다. 본문 문장과 **따로 잰다**(같은 자리가 아니다).
   */
  it('제목이 끄기의 물음이다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: t.dialog.deactivateTitle })).toBeInTheDocument();
  });

  /**
   * ⭐ **이것이 마지막 활성 규칙일 때 파급을 말한다**(공유계약 G-12 규칙 2).
   * 계약에 이 오퍼레이션의 400이 없어 화면의 경고가 유일한 방어다.
   */
  it('마지막 규칙이면 위치 검증 없이 통과한다는 사실을 말한다', () => {
    renderDialog({ remaining: { kind: 'none' } });

    expect(screen.getByText(t.dialog.deactivateLastRule)).toBeInTheDocument();
  });

  /**
   * ⛔ **남는 규칙이 있으면 그 문장을 세우지 않는다.** 갈래 없이 늘 세우면 화면이
   * **확인하지 않은 사실을 단언**한다 — 남는 규칙이 있는데 「검증 없이 통과합니다」는 거짓이다.
   */
  it('남는 규칙이 있으면 건수를 말하고 「검증 없이 통과」를 내지 않는다', () => {
    renderDialog({ remaining: { kind: 'some', count: 2 } });

    expect(screen.getByText(t.dialog.deactivateRemaining(2))).toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateLastRule)).not.toBeInTheDocument();
  });

  /** 건수는 넘겨받은 값 그대로다 — 창이 세지 않는다는 것을 값이 흐르는지로 잰다. */
  it('남는 건수를 넘겨받은 값 그대로 낸다', () => {
    renderDialog({ remaining: { kind: 'some', count: 7 } });

    expect(screen.getByText(t.dialog.deactivateRemaining(7))).toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateRemaining(2))).not.toBeInTheDocument();
  });

  /** 확인하지 못한 갈래 — 「마지막이다」로도 「남는다」로도 단언하지 않는다. */
  it('덮개를 확인하지 못했으면 어느 쪽도 단언하지 않는다', () => {
    renderDialog({ remaining: { kind: 'unknown', reason: 'failed' } });

    expect(screen.getByText(t.dialog.deactivateCoverageUnknown)).toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateLastRule)).not.toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateRemaining(0))).not.toBeInTheDocument();
  });

  /** 되돌릴 수 있다는 사실이 이 결정의 무게를 정한다 — 물리 삭제와 갈리는 자리다. */
  it('되돌릴 수 있다는 사실을 함께 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.deactivateReversible)).toBeInTheDocument();
  });

  it('확인 버튼이 「사용 중지」다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ActivationDialog — 다시 사용', () => {
  it('무엇을 켜는지와 무엇이 다시 적용되는지를 말한다', () => {
    renderDialog({ intent: 'activate' });

    expect(screen.getByText(t.dialog.activateTarget(ITEM, LOCATION))).toBeInTheDocument();
    expect(screen.getByText(t.dialog.activateApplies)).toBeInTheDocument();
  });

  /** 짝 방향 — **제목도 갈래를 따른다.** 끄기 제목이 그대로 서면 반대 조작을 확인한 것이 된다. */
  it('제목이 켜기의 물음이다', () => {
    renderDialog({ intent: 'activate' });

    expect(screen.getByRole('dialog', { name: t.dialog.activateTitle })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t.dialog.deactivateTitle })).toBeNull();
  });

  /** 두 갈래가 서로 다른 사실을 말해야 한다 — 같은 본문을 쓰면 사실과 다른 안내가 나간다. */
  it('끄기의 문장을 내지 않는다', () => {
    renderDialog({ intent: 'activate' });

    expect(screen.queryByText(t.dialog.deactivateTarget(ITEM, LOCATION))).not.toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateLastRule)).not.toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateReversible)).not.toBeInTheDocument();
  });

  /** 켜기는 덮개를 묻지 않는다 — 켜면 덮개가 **느는** 것이라 물음 자체가 성립하지 않는다. */
  it('덮개 판정이 무엇이든 켜기의 본문은 달라지지 않는다', () => {
    renderDialog({ intent: 'activate', remaining: { kind: 'some', count: 3 } });

    expect(screen.getByText(t.dialog.activateApplies)).toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateRemaining(3))).not.toBeInTheDocument();
  });

  it('확인 버튼이 「다시 사용」이다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ intent: 'activate' });

    await user.click(screen.getByRole('button', { name: t.actions.activate }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });
});

/**
 * ⭐ **문면의 「내용」을 잰다** — 위 시험들은 *어느 키가 그려졌는가*(구조)만 본다.
 *
 * 구조만 재면 `deactivateCoverageUnknown`을 「이 품목에 사용 중인 규칙이 더 없습니다. 끄면
 * …통과합니다.」로 바꿔도 전건이 통과한다 — **확인하지 못한 갈래가 거짓을 단언하는데 아무도
 * 무는 사람이 없다.** 같은 회차가 응답 없음 안내에는 이미 이 잣대를 세웠다(사실 → 금지 →
 * 확인 자리 차례). 덮개 삼형제에도 같은 잣대를 둔다.
 *
 * **가르는 축은 「파급을 조건 없이 단언하는가」** 하나다.
 */
describe('ActivationDialog — 덮개 세 갈래의 문면 잣대', () => {
  /** 세 문장이 공유하는 파급 표현. 이 낱말이 어느 갈래에 서는지가 사실성을 가른다. */
  const UNCOVERED = '위치 검증 없이 통과';
  /** 조건 표지 — 이것이 파급 **앞**에 서야 단언이 아니라 가정이 된다. */
  const CONDITION = '마지막이면';

  it('마지막 갈래만 파급을 조건 없이 단언한다', () => {
    expect(t.dialog.deactivateLastRule).toContain(UNCOVERED);
    expect(t.dialog.deactivateLastRule).not.toContain(CONDITION);
  });

  it('확인하지 못한 갈래는 확인 실패를 먼저 말하고 파급은 조건절로만 단다', () => {
    const note = t.dialog.deactivateCoverageUnknown;

    expect(note).toContain('확인하지 못했습니다');
    expect(note).toContain(UNCOVERED);

    /* 차례가 뜻을 정한다 — 조건 표지가 파급 뒤에 서면 단언이 먼저 읽힌다. */
    const factAt = note.indexOf('확인하지 못했습니다');
    const conditionAt = note.indexOf(CONDITION);
    const clauseAt = note.indexOf(UNCOVERED);

    expect(factAt).toBeLessThan(conditionAt);
    expect(conditionAt).toBeLessThan(clauseAt);
  });

  /** 남는 규칙이 있으면 파급 자체가 거짓이다 — 조건절로도 달지 않는다. */
  it('남는 갈래는 파급을 말하지 않고 건수를 담는다', () => {
    expect(t.dialog.deactivateRemaining(3)).toContain('3');
    expect(t.dialog.deactivateRemaining(3)).not.toContain(UNCOVERED);
  });

  /**
   * ⭐ **되돌리기를 무조건으로 약속하지 않는다.** 켜기는 같은 조합의 활성 규칙이 서면
   * 화면이 막고 계약도 400이다 — 이 화면이 스스로 구현한 갈래다. 무조건 부사는 그 갈래와
   * 어긋날 뿐 아니라 **끄기 결정의 무게를 낮추는 쪽**으로 작용한다.
   */
  it('되돌리기 문장이 무조건을 약속하지 않고 단서를 함께 단다', () => {
    expect(t.dialog.deactivateReversible).toContain('다시 사용할 수 있습니다');
    expect(t.dialog.deactivateReversible).not.toContain('언제든');
    expect(t.dialog.deactivateReversible).toContain('되면');
  });
});

describe('ActivationDialog — 창의 경계', () => {
  /**
   * **창 안에 펼침 목록을 두지 않는다**(`design-system-v2-webui#68`). 짝 방향으로 잰다 —
   * 아무것도 그리지 않아도 통과하는 단언이 되지 않게 본문이 실제로 섰는지를 먼저 본다.
   */
  it('선택칸이 없다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.deactivateReversible)).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('listbox')).toHaveLength(0);
  });

  /** 내부 번호는 화면 어디에도 내지 않는다(`omf-mes#44`) — 확인 창도 예외가 아니다. */
  it('내부 번호를 내지 않는다', () => {
    const { container } = renderDialog();

    expect(screen.getByText(t.dialog.deactivateTarget(ITEM, LOCATION))).toBeInTheDocument();
    expect(container.textContent).not.toContain('9001');
  });

  /**
   * **나가는 길을 바닥 버튼 둘로 좁힌다**(사본 체크리스트 5번 ①).
   *
   * 디자인 시스템 `Dialog`는 머리에 X 손잡이를 기본으로 그리는데 **그 손잡이는 진행 상태를
   * 받지 않는다** — 전송 중에도 눌린다. 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
   */
  it('창 머리에 닫기 손잡이를 두지 않는다', () => {
    renderDialog();

    // 선행 단언 — 나가는 길 자체는 있어야 한다. 없으면 이 단언이 「갇힌 창」과 구별되지 않는다.
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.close })).toBeNull();
  });

  /**
   * **스크림 클릭으로 닫히지 않는다**(사본 체크리스트 5번 ②).
   *
   * 되돌리기에 현장 업무가 걸린 확인 창이 실수로 사라지면 사용자는 자기가 무엇을 취소했는지
   * 모른다 — 초안 파기 창이 **일부러 열어 두는 것**과 정확히 반대 자리다
   * (`discard-confirm-dialog.test.tsx`가 그 반대 방향을 잰다).
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  /** 짝 방향 — 닫는 길 자체는 열려 있어야 한다. 안 그러면 위 단언이 「닫을 길이 없다」와 같아진다. */
  it('취소를 누르면 닫힌다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * **Escape는 막을 수 없다**(사본 체크리스트 5번 ③). native `<dialog>`가 `cancel`을 내고
   * 디자인 시스템이 그것을 닫기 요청으로 무조건 잇는다 — 그러므로 이 창의 규율은
   * 「닫히지 않게」가 아니라 **「닫혀도 나가는 요청이 무너지지 않게」**이고, 그 몫은 창을
   * 여닫는 쪽에 있다(`screen.test.tsx`의 「창을 닫아도 전환의 되먹임이 끊기지 않는다」).
   */
  it('Escape는 닫기 요청으로 이어진다', () => {
    const { props } = renderDialog({ isSaving: true });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * 전송 중에는 연타로 두 번 나가지 않게 한다 — 쓰기 훅이 호출마다 새 멱등 키를 만든다.
   *
   * **버튼을 이름으로 세지 않고 창 안의 모든 버튼을 센다** — 나가는 길이 하나 늘면
   * 이름을 아는 잣대는 그 길을 비껴간다.
   */
  it('전송 중에는 창 안의 모든 버튼이 잠긴다', () => {
    renderDialog({ isSaving: true });

    const buttons = screen.getAllByRole('button');

    // 선행 단언 — 버튼이 실제로 있어야 「전부 잠겼다」가 뜻을 갖는다.
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  /** 실패해도 창을 닫지 않는다 — 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('배너 슬롯을 창 안에 낸다', () => {
    renderDialog({ banner: <p>합성 전환 실패</p> });

    expect(screen.getByText('합성 전환 실패')).toBeInTheDocument();
  });
});
