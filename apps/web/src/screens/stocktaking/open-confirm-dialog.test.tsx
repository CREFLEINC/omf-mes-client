import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpenConfirmDialog, type OpenSummary } from './open-confirm-dialog';

const t = messages.stocktaking;

const SUMMARY: OpenSummary = {
  countTypeCode: 'SAMPLE_COUNT_TYPE_A',
  warehouseName: 'SAMPLE-WH-01 · 합성 창고 가',
  plannedDate: '2026-08-06',
  blindCount: '아니오',
};

const renderDialog = (summary: OpenSummary = SUMMARY) => {
  const onConfirm = vi.fn<() => void>();
  const onClose = vi.fn<() => void>();

  render(<OpenConfirmDialog summary={summary} onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('OpenConfirmDialog — 보낼 값을 그대로 다시 보인다', () => {
  /* **C24** — 보낼 값 넷이 전부 나열된다. 하나라도 빠지면 확인하지 않은 값이 함께 나간다. */
  it('보낼 값 넷이 전부 나열된다', () => {
    renderDialog();

    for (const value of [
      SUMMARY.countTypeCode,
      SUMMARY.warehouseName,
      SUMMARY.plannedDate,
      SUMMARY.blindCount,
    ]) {
      expect(within(dialog()).getByText(value)).toBeInTheDocument();
    }
  });

  /*
   * **N-1 — 나열 차례가 세 자리에서 같아야 한다**(개시 폼의 칸 · 버튼 사유 · 이 창).
   * 무엇을 세는가 → 어디를 세는가 → 언제 세는가 → 어떻게 세는가. 갈리면 사용자가 폼에서
   * 확인한 것과 창에서 다시 읽는 것을 **눈으로 맞춰 볼 수 없다** — 값이 다 보여도 확인의
   * 비용이 올라간다. 존재만 세면 차례를 통째로 뒤집어도 통과한다.
   */
  it('나열 차례가 개시 폼의 칸 차례와 같다', () => {
    renderDialog();

    expect(
      within(dialog())
        .getAllByRole('term')
        .map((node) => node.textContent),
    ).toEqual([t.fields.countType, t.fields.warehouse, t.fields.plannedDate, t.fields.blindCount]);
  });

  /*
   * **이름을 풀지 못한 창고도 그 사정을 그대로 낸다**(#44 · 참조 4갈래). 번호를 대신 내면
   * 사용자가 뜻을 모르는 값을 확인하고 되돌릴 수 없는 전표를 만든다. 빈 칸으로 두지도 않는다 —
   * 빠뜨린 것인지 없는 것인지 구분되지 않는다.
   */
  it('창고 이름을 풀지 못한 사정도 그대로 낸다', () => {
    renderDialog({ ...SUMMARY, warehouseName: t.values.referenceLoading });

    expect(within(dialog()).getByText(t.values.referenceLoading)).toBeInTheDocument();
    expect(within(dialog()).queryByText('9101')).not.toBeInTheDocument();
  });

  /*
   * **C24 · 계획 결정 11** — 개시한 실사를 지우거나 되돌리는 오퍼레이션이 계약에 없다(실측).
   * 그 사실을 보내기 직전에 밝히는 자리가 이 창뿐이다.
   */
  it('되돌릴 수 없다는 사실을 밝힌다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.openIrreversible)).toBeInTheDocument();
  });

  /*
   * **M28 · C25** — 창 안에 선택칸을 두지 않는다(#45 · DS `design-system-v2-webui#68`).
   * 창 본문이 펼침 목록을 자르는 결함이 아직 고쳐지지 않았다 — 고칠 수 없는 결함은
   * **걸릴 자리를 만들지 않는 것**으로 피한다. 개시 폼을 창에 넣지 않은 것도 같은 이유다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    /* 짝 방향 — 창이 실제로 그려졌다(아무것도 없어서 통과하는 것이 아니다). */
    expect(within(dialog()).getByText(SUMMARY.countTypeCode)).toBeInTheDocument();
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('checkbox')).toHaveLength(0);
  });

  /*
   * **스크림 클릭으로 닫히지 않는다**(`closeOnBackdropClick={false}`). 실수로 닫혀도 초안이
   * 남아 잃는 것은 없지만, **되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에 사라지면
   * 확인 자체가 형식이 된다** — 파기 확인 창과 갈리는 자리이고, 그 갈림이 규칙이다.
   *
   * 설치본은 `<dialog>` 자신이 클릭 대상일 때만 닫기를 부른다(실측) — 그 자리를 그대로 누른다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  /* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
  it('두 버튼이 무엇을 하는지 이름으로 밝힌다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
