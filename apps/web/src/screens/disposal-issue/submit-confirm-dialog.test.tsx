import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NO_BREAK_SPACE } from './approval-progress-pane';
import { INTERNAL_IDS } from './fixtures';
import {
  SubmitConfirmDialog,
  type SubmitConfirmDialogProps,
  type SubmitSummary,
} from './submit-confirm-dialog';

const t = messages.disposalIssue;

const SUMMARY: SubmitSummary = {
  goodsReceiptNo: 'GR-2026-900001',
  warehouseName: 'SAMPLE-WH-01 · 합성 폐기창고 가',
  issueTypeCode: 'SAMPLE_GI_TYPE_A',
  sourceDocumentTypeCode: 'SAMPLE_SRC_TYPE_A',
  reasonCode: 'SAMPLE_GI_REASON_A',
  issuedAt: '2026-08-11 09:30',
  businessDate: '2026-08-11',
  remarks: '',
  destination: t.values.selfDisposal,
  lines: [
    {
      ordinal: 1,
      item: 'SAMPLE-ITEM-01 · 합성 자재 가',
      lot: 'SAMPLE-LOT-0001',
      qty: '10 SAMPLE-UOM-EA',
    },
    {
      ordinal: 2,
      item: 'SAMPLE-ITEM-02 · 합성 자재 나',
      lot: 'SAMPLE-LOT-0003',
      qty: '2 SAMPLE-UOM-BX',
    },
  ],
  reason: '불량 판정분 폐기\n\n  입고 검사 부적합 12박스',
  reasonFirstLine: '불량 판정분 폐기',
  hasUnknownOnHand: false,
};

const renderDialog = (overrides: Partial<SubmitConfirmDialogProps> = {}) =>
  render(
    <SubmitConfirmDialog summary={SUMMARY} onConfirm={vi.fn()} onClose={vi.fn()} {...overrides} />,
  );

describe('SubmitConfirmDialog 보이는 것', () => {
  /** 확인 창에서 **처음 보는 값이 없어야** 한다 — 보낼 것을 그대로 되비춘다. */
  it('전표·코드·일시를 다시 보인다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('GR-2026-900001')).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE-WH-01 · 합성 폐기창고 가')).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE_GI_TYPE_A')).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE_SRC_TYPE_A')).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE_GI_REASON_A')).toBeInTheDocument();
    expect(within(dialog).getByText('2026-08-11 09:30')).toBeInTheDocument();
  });

  /**
   * **도착지를 한 행으로 보인다**(완료 조건 C19 · 변경 통지 #128).
   *
   * 없앤 「도착지 유형」·「폐기 계정」 두 행 자리에 **한 행**이 선다 — 사용자가 정한 것은
   * 유형과 번호 둘이 아니라 「어디로 가는가」 하나이고, 나가는 본문의 두 키는 그 하나에서
   * 따라온다(`describeDisposalDestination`).
   */
  it('도착지 한 행을 보인다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.formFields.destination)).toBeInTheDocument();
    expect(within(dialog).getByText(t.values.selfDisposal)).toBeInTheDocument();
  });

  /** 고른 거래처도 **같은 한 행**에 선다 — 갈래마다 자리가 달라지면 사용자가 찾아야 한다. */
  it('폐기 거래처를 골랐으면 그 이름이 같은 자리에 선다', () => {
    renderDialog({
      summary: { ...SUMMARY, destination: 'SAMPLE-PARTNER-01 · 합성 폐기업체 가' },
    });

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.formFields.destination)).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE-PARTNER-01 · 합성 폐기업체 가')).toBeInTheDocument();
    /* 짝 방향 — 자체 폐기 글자가 함께 서지 않는다(두 갈래가 한 자리를 나눠 쓴다). */
    expect(within(dialog).queryByText(t.values.selfDisposal)).not.toBeInTheDocument();
  });

  /**
   * **없앤 두 칸은 확인 창에도 서지 않는다**(#124 · #128). 사용자가 확인한 글자와 나가는 값은
   * 같은 자리에서 나와야 하는데, 본문이 싣지 않는 값을 창이 보이면 그 둘이 갈린다.
   *
   * 위 「전표·코드·일시를 다시 보인다」가 짝 양성이고, 여기서는 같은 창을 그린 뒤 잰다.
   */
  it.each(['폐기 계정', '도착지 유형'])('%s 행이 없다', (label) => {
    renderDialog();

    const dialog = screen.getByRole('dialog');

    /* 짝 양성 — 창이 실제로 요약 행을 그렸다. */
    expect(within(dialog).getByText(t.formFields.issueType)).toBeInTheDocument();

    expect(within(dialog).queryByText(label)).not.toBeInTheDocument();
  });

  /** 사용자가 넣은 적 없는 값이 전표에 실린다 — **값 자체가** 파생임을 밝힌다. */
  it('영업일이 파생임을 값에서 밝힌다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.businessDateDerived('2026-08-11'))).toBeInTheDocument();
  });

  it('빈 칸을 비워 두지 않는다', () => {
    renderDialog();

    expect(screen.getByText(t.values.empty)).toBeInTheDocument();
  });

  /** 합계만 보이면 어느 줄이 얼마인지 확인할 수 없다 — 줄마다 다시 보인다. */
  it('보낼 줄을 줄마다 보인다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.lineCount(2))).toBeInTheDocument();
    expect(
      screen.getByText(
        t.dialog.linePair('SAMPLE-ITEM-01 · 합성 자재 가', 'SAMPLE-LOT-0001', '10 SAMPLE-UOM-EA'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        t.dialog.linePair('SAMPLE-ITEM-02 · 합성 자재 나', 'SAMPLE-LOT-0003', '2 SAMPLE-UOM-BX'),
      ),
    ).toBeInTheDocument();
  });
});

describe('SubmitConfirmDialog 사유', () => {
  /**
   * **전문과 첫 줄을 나눠 보인다**(완료 조건 C62). 첫 줄만 보이면 무엇을 보내는지 모르고,
   * 전문만 보이면 어느 줄이 결재함에서 요약으로 보일지 모른다.
   */
  it('전문과 첫 줄을 나눠 보이고 요약 노릇을 밝힌다', () => {
    renderDialog();

    const full = screen.getByRole('region', { name: t.dialog.reasonFull });
    const first = screen.getByRole('region', { name: t.dialog.reasonFirstLine });

    expect(within(full).getByText('불량 판정분 폐기')).toBeInTheDocument();
    expect(within(first).getByText('불량 판정분 폐기')).toBeInTheDocument();
    expect(screen.getByText(t.dialog.reasonSummaryNote)).toBeInTheDocument();
  });

  /**
   * 줄바꿈이 뜻을 나른다 — 한 줄로 이어 붙이면 문단 구분이 사라진다.
   *
   * **접근성 조회로 재지 않는다.** 이름으로 집는 조회는 공백을 접어 U+00A0과 보통 공백을
   * 가르지 못한다 — 빈 줄과 들여쓰기가 **보이는 글자로 남는가**가 이 잣대의 요점이라 DOM을
   * 직접 센다(결재 진행 구획 시험과 같은 처리).
   */
  it('전문의 줄바꿈과 들여쓰기를 살린다', () => {
    renderDialog();

    const full = screen.getByRole('region', { name: t.dialog.reasonFull });
    const lines = [...full.querySelectorAll('p')].map((node) => node.textContent);

    expect(lines).toEqual([
      t.dialog.reasonFull,
      '불량 판정분 폐기',
      NO_BREAK_SPACE,
      `${NO_BREAK_SPACE.repeat(2)}입고 검사 부적합 12박스`,
    ]);
  });
});

describe('SubmitConfirmDialog 사실', () => {
  /** 이 조작으로 재고가 움직이지 않는다 — 경계를 흐리면 승인 뒤의 처리를 잊는다. */
  it('지금은 재고가 움직이지 않는다고 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.submitEffects)).toBeInTheDocument();
  });

  /** 되돌릴 수 없다는 **사실을 정확히** 말한다 — 반려 뒤 재상신은 새 요청이다. */
  it('되돌릴 수 없음을 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.submitNoUndo)).toBeInTheDocument();
  });

  /** 상한을 확인하지 못한 줄이 **섞여 있을 때만** 밝힌다 — 늘 적으면 경고가 배경이 된다. */
  it('보유 수량 미확인 줄이 섞였을 때만 그 사실을 적는다', () => {
    const { unmount } = renderDialog();

    expect(screen.queryByText(t.dialog.submitOnHandUnknown)).not.toBeInTheDocument();
    unmount();

    renderDialog({ summary: { ...SUMMARY, hasUnknownOnHand: true } });

    expect(screen.getByText(t.dialog.submitOnHandUnknown)).toBeInTheDocument();
  });
});

describe('SubmitConfirmDialog 창의 규율', () => {
  /** **창 안에 선택칸을 두지 않는다**(`omf-mes#45` · 완료 조건 C79). */
  it('선택칸이 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  /** 되돌릴 수 없는 조작의 확인이 스치는 클릭에 사라지면 확인 자체가 형식이 된다. */
  it('X 손잡이가 없다', () => {
    renderDialog();

    expect(screen.queryByRole('button', { name: messages.common.close })).not.toBeInTheDocument();
  });

  it('바닥 버튼 둘이 무엇을 하는지 낱말로 말한다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.confirmSubmit })).toBeInTheDocument();
  });

  /**
   * **통지가 문면으로 지정한 낱말**(#124) — 확인 창의 바닥 버튼은 「상신」이 아니라 **「요청」**이다.
   *
   * 나머지 시험은 이 버튼을 `t.actions.confirmSubmit` **키로 조회**해서 값이 무엇이든 늘
   * 통과한다. 낱말이 통지 이전으로 되돌아가는 것을 잡으려면 **보이는 글자를 직접 무는 자리**가
   * 하나 있어야 한다 — 짝이 되는 낱말 셋도 각자 그 컨트롤이 서는 시험에 같은 형태로 있다.
   */
  it('바닥 버튼의 보이는 글자가 통지 문면 그대로다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.confirmSubmit })).toHaveTextContent(
      /^요청$/,
    );
  });

  it('상신을 누르면 알리고, 계속 작성을 누르면 닫는다', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderDialog({ onConfirm, onClose });
    await user.click(screen.getByRole('button', { name: t.actions.confirmSubmit }));

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /** **내부 번호를 내지 않는다**(`omf-mes#44`) — 짝으로 업무 번호가 보이는 것을 함께 잰다. */
  it('업무 번호는 보이고 내부 번호는 보이지 않는다', () => {
    const { container } = renderDialog();

    expect(screen.getByText('GR-2026-900001')).toBeInTheDocument();

    const text = container.textContent ?? '';

    for (const id of INTERNAL_IDS) expect(text).not.toContain(id);
  });
});
