import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CloseConfirmDialog, type CloseSummary } from './close-confirm-dialog';

const t = messages.stocktaking;

const SUMMARY: CloseSummary = {
  countNo: 'IC-2026-900011',
  warehouseName: 'SAMPLE-WH-01 · 합성 창고 가',
  plannedDate: '2026-08-06',
  summary: { plannedCount: 40, countedCount: 40, uncountedCount: 0, varianceCount: 0 },
};

const renderDialog = (summary: CloseSummary = SUMMARY) => {
  const onConfirm = vi.fn<() => void>();
  const onClose = vi.fn<() => void>();

  render(<CloseConfirmDialog summary={summary} onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('CloseConfirmDialog — 마감할 대상과 진행 요약을 다시 보인다', () => {
  /*
   * **완료 조건 C55** — 무엇을 마감하는지(실사번호·창고·계획일)와 **요약 4칸**이 전부 보인다.
   *
   * 개시 창과 갈리는 자리다: 개시는 **보낼 값**을 다시 보이지만 마감이 보내는 값은 영업일
   * 하나이고 그것마저 화면이 파생한다 — 확인의 실질은 「무엇을 마감하는가」와 「지금 어디까지
   * 됐는가」다.
   */
  it('마감할 실사와 요약 4칸이 전부 나열된다', () => {
    renderDialog();

    for (const value of [SUMMARY.countNo, SUMMARY.warehouseName, SUMMARY.plannedDate]) {
      expect(within(dialog()).getByText(value)).toBeInTheDocument();
    }

    expect(within(dialog()).getAllByText(t.detail.countValue(40))).toHaveLength(2);
    expect(within(dialog()).getAllByText(t.detail.countValue(0))).toHaveLength(2);
  });

  /*
   * **나열 차례가 제목줄·요약 구획과 같다.** 사용자는 아래 구획에서 보던 것을 창에서 다시
   * 읽으므로, 차례가 갈리면 값이 다 보여도 **눈으로 맞춰 볼 수 없다.** 존재만 세면 차례를
   * 통째로 뒤집어도 통과한다(개시 창 N-1이 세운 잣대를 그대로 쓴다).
   */
  it('나열 차례가 제목줄과 요약 구획의 차례와 같다', () => {
    renderDialog();

    expect(
      within(dialog())
        .getAllByRole('term')
        .map((node) => node.textContent),
    ).toEqual([
      t.detail.inventoryCountNo,
      t.detail.warehouse,
      t.detail.plannedDate,
      t.detail.planned,
      t.detail.counted,
      t.detail.uncounted,
      t.detail.variance,
    ]);
  });

  /*
   * **계획 결정 12 · 완료 조건 C55** — 마감한 실사를 다시 여는 오퍼레이션이 계약에 없다
   * (실측 — 이 자원의 경로는 넷뿐이다). 그 사실을 보내기 직전에 밝히는 자리가 이 창뿐이다.
   */
  it('되돌릴 수 없다는 사실을 밝힌다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.closeIrreversible)).toBeInTheDocument();
  });

  /*
   * **감지기 M53 · 완료 조건 C55** — 창 안에 선택칸을 두지 않는다(#45 · DS
   * `design-system-v2-webui#68`). 창 본문이 펼침 목록을 자르는 결함이 아직 고쳐지지 않았다 —
   * 고칠 수 없는 결함은 **걸릴 자리를 만들지 않는 것**으로 피한다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    /* 짝 방향 — 창이 실제로 그려졌다(아무것도 없어서 통과하는 것이 아니다). */
    expect(within(dialog()).getByText(SUMMARY.countNo)).toBeInTheDocument();
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('checkbox')).toHaveLength(0);
  });

  /*
   * **스크림 클릭으로 닫히지 않는다**(`closeOnBackdropClick={false}`). 개시 확인 창과 같은
   * 편에 서는 자리이고 **파기 확인 창과 갈리는** 자리다 — 되돌릴 수 없는 조작을 확인하는 창이
   * 스치는 클릭에 사라지면 확인 자체가 형식이 된다. 마감은 그중에서도 가장 비싸다.
   *
   * 설치본은 `<dialog>` 자신이 클릭 대상일 때만 닫기를 부른다(실측) — 그 자리를 그대로 누른다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  /*
   * 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다.
   * 개시 창의 「계속 입력」을 재사용하지 않는 이유는 **마감 창에 고칠 입력이 없기** 때문이다.
   */
  it('두 버튼이 무엇을 하는지 이름으로 밝힌다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.confirmClose }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.keepCounting }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /*
   * **이름을 풀지 못한 창고도 그 사정을 그대로 낸다**(#44 · 참조 4갈래). 번호를 대신 내면
   * 사용자가 뜻을 모르는 값을 확인하고 되돌릴 수 없는 마감을 누른다.
   */
  it('창고 이름을 풀지 못한 사정도 그대로 내고 번호를 내지 않는다', () => {
    const { container } = render(
      <CloseConfirmDialog
        summary={{ ...SUMMARY, warehouseName: t.values.referenceFailed }}
        onConfirm={vi.fn<() => void>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(within(dialog()).getByText(t.values.referenceFailed)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9101');
    expect(container.textContent ?? '').not.toContain('9001');
  });
});
