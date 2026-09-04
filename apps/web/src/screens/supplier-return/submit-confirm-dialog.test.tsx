import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { INTERNAL_IDS, PARTNER_LABEL } from './fixtures';
import { SubmitConfirmDialog, type SubmitSummary } from './submit-confirm-dialog';

const t = messages.supplierReturn;

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const LOT_LABEL = 'LOT-2026-900010';

const SUMMARY: SubmitSummary = {
  supplierName: PARTNER_LABEL,
  issueTypeCode: 'SAMPLE_ISSUE_TYPE_A',
  sourceDocumentTypeCode: 'GOODS_RECEIPT',
  destinationTypeCode: 'PARTNER',
  reasonCode: 'SAMPLE_REASON_A',
  issuedAt: '2026-08-06 09:12',
  businessDate: '2026-08-06',
  replacementExpected: false,
  sendToErp: true,
  remarks: '',
  lines: [{ ordinal: 1, item: ITEM_LABEL, lot: LOT_LABEL, qty: '30 SAMPLE-EA' }],
  hasUnknownOnHand: false,
};

const renderDialog = (overrides: Partial<SubmitSummary> = {}) => {
  const onConfirm = vi.fn<() => void>();
  const onClose = vi.fn<() => void>();

  const rendered = render(
    <SubmitConfirmDialog
      summary={{ ...SUMMARY, ...overrides }}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  return { ...rendered, onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('SubmitConfirmDialog — 반품 처리 확인', () => {
  /* **C39** — 보낼 것을 빠짐없이 보인다. 창에서 처음 보는 값이 있으면 확인이 성립하지 않는다. */
  it('공급사·코드 넷·출고 일시·영업일·두 토글을 밝힌다', () => {
    renderDialog();

    const body = dialog();

    expect(body).toHaveTextContent(PARTNER_LABEL);
    expect(body).toHaveTextContent('SAMPLE_ISSUE_TYPE_A');
    expect(body).toHaveTextContent('GOODS_RECEIPT');
    expect(body).toHaveTextContent('PARTNER');
    expect(body).toHaveTextContent('SAMPLE_REASON_A');
    expect(body).toHaveTextContent('2026-08-06 09:12');
    expect(within(body).getByText(t.fields.replacementExpected)).toBeInTheDocument();
    expect(within(body).getByText(t.fields.sendToErp)).toBeInTheDocument();
  });

  /* **영업일이 파생값이라는 사실을 값 자체가 밝힌다** — 사용자가 넣은 칸이 없다. */
  it('영업일을 파생값이라고 밝힌다', () => {
    renderDialog();

    expect(
      within(dialog()).getByText(t.dialog.businessDateDerived('2026-08-06')),
    ).toBeInTheDocument();
  });

  it('참·거짓을 글자로 낸다', () => {
    renderDialog({ replacementExpected: true, sendToErp: false });

    const values = within(dialog()).getAllByText(t.values.yes);

    expect(values.length).toBeGreaterThan(0);
    expect(within(dialog()).getAllByText(t.values.no).length).toBeGreaterThan(0);
  });

  /* 값이 없는 칸을 비워 두지 않는다 — 빠뜨린 것인지 없는 것인지 구분되지 않는다. */
  it('비고가 비어 있으면 없음이라고 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.values.empty)).toBeInTheDocument();
  });

  /*
   * **줄마다 무엇이 얼마나 나가는지 다시 보인다.** 합계만 보이면 어느 줄이 얼마인지 확인할 수
   * 없고, 잘못 실린 수량은 재고에서 그대로 빠진다.
   */
  it('고른 줄 수와 줄별 품목·LOT·수량을 보인다', () => {
    renderDialog({
      lines: [
        { ordinal: 1, item: ITEM_LABEL, lot: LOT_LABEL, qty: '30 SAMPLE-EA' },
        { ordinal: 2, item: '알 수 없음', lot: 'LOT-2026-900011', qty: '5 SAMPLE-EA' },
      ],
    });

    const body = dialog();

    expect(within(body).getByText(t.dialog.lineCount(2))).toBeInTheDocument();
    expect(body).toHaveTextContent(t.dialog.linePair(ITEM_LABEL, LOT_LABEL, '30 SAMPLE-EA'));
    expect(body).toHaveTextContent(
      t.dialog.linePair('알 수 없음', 'LOT-2026-900011', '5 SAMPLE-EA'),
    );
  });

  /*
   * **되돌릴 수 없다는 사실을 정확히 말한다**(계획 결정 12 · 어긋남 1). 취소 오퍼레이션은
   * 계약에 실재하고 승인을 타며 다른 화면 소관이다 — 「계약에 없다」고 적으면 사실과 다르다.
   */
  it('재고 차감·등록과 전기의 결합·이 화면에 되돌릴 수단이 없음을 밝힌다', () => {
    renderDialog();

    const body = dialog();

    expect(within(body).getByText(t.dialog.submitEffects)).toBeInTheDocument();
    expect(within(body).getByText(t.dialog.submitNoUndoHere)).toBeInTheDocument();
    expect(body.textContent ?? '').not.toContain('계약에 취소');
  });

  /* 반품했으니 보류가 풀릴 것으로 읽는 사용자가 있다 — 이 화면에는 푸는 수단이 없다. */
  it('LOT 보류가 유지된다는 사실을 밝힌다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.submitLotHoldKept)).toBeInTheDocument();
  });

  /* **위험 10** — 상한을 확인하지 못한 줄이 섞여 있으면 그 사실을 여기서 마지막으로 밝힌다. */
  it('상한을 확인하지 못한 줄이 있으면 그 사실을 밝힌다', () => {
    renderDialog({ hasUnknownOnHand: true });

    expect(within(dialog()).getByText(t.dialog.submitOnHandUnknown)).toBeInTheDocument();
  });

  it('전부 확인된 줄만 있으면 그 안내를 내지 않는다', () => {
    renderDialog();

    expect(within(dialog()).queryByText(t.dialog.submitOnHandUnknown)).not.toBeInTheDocument();
  });

  /*
   * **M43 · C40** — 창 안에 선택칸을 두지 않는다(#45 · DS 이슈). 반품 정보 폼을 창에 넣지
   * 않은 것도 같은 이유다 — 그 폼에는 선택칸이 다섯이라 넣었다면 정면으로 걸린다.
   */
  it('창 안에 선택칸과 입력칸이 없다', () => {
    renderDialog();

    /* 짝 방향 — 창이 실제로 값을 그렸다. */
    expect(dialog()).toHaveTextContent(PARTNER_LABEL);
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('switch')).toHaveLength(0);
  });

  /* **M50 · C50** — 이름을 보이고 번호를 내지 않는다. 도착지도 이름을 풀지 않되 번호도 안 낸다. */
  it('내부 번호를 내지 않는다', () => {
    const { container } = renderDialog();

    expect(container.textContent ?? '').toContain(PARTNER_LABEL);

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /*
   * **스크림 클릭으로 닫히지 않는다.** 되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에
   * 사라지면 확인 자체가 형식이 된다 — 파기 확인 창과 **갈리는 자리**다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  /* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
  it('두 버튼이 무엇을 하는지 이름으로 밝힌다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.confirmSubmit }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
