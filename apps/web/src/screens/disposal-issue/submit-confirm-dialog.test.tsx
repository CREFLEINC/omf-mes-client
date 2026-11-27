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
  issueTypeName: 'SAMPLE_GI_TYPE_A',
  sourceDocumentTypeName: 'INBOUND_RECEIPT',
  reasonName: 'SAMPLE_GI_REASON_A',
  issuedAt: '2026-08-11 09:30',
  businessDate: '2026-08-11',
  remarks: '',
  destination: t.values.selfDisposal,
  lines: [
    {
      ordinal: 1,
      itemName: '합성 자재 가',
      itemCode: 'SAMPLE-ITEM-01',
      lot: 'SAMPLE-LOT-0001',
      qty: '10 SAMPLE-UOM-EA',
    },
    {
      ordinal: 2,
      itemName: '합성 자재 나',
      itemCode: 'SAMPLE-ITEM-02',
      lot: 'SAMPLE-LOT-0003',
      qty: '2 SAMPLE-UOM-BX',
    },
  ],
  reason: '불량 판정분 폐기\n\n  입고 검사 부적합 12박스',
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
    expect(within(dialog).getByText('INBOUND_RECEIPT')).toBeInTheDocument();
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

    expect(within(dialog).getByText(t.formFields.disposalPartner)).toBeInTheDocument();
    expect(within(dialog).getByText(t.values.selfDisposal)).toBeInTheDocument();
  });

  /** 고른 거래처도 **같은 한 행**에 선다 — 갈래마다 자리가 달라지면 사용자가 찾아야 한다. */
  it('폐기 거래처를 골랐으면 그 이름이 같은 자리에 선다', () => {
    renderDialog({
      summary: { ...SUMMARY, destination: 'SAMPLE-PARTNER-01 · 합성 폐기업체 가' },
    });

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.formFields.disposalPartner)).toBeInTheDocument();
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

  /** 사용자가 넣은 적 없는 값이 전표에 실린다 — **값 자체가** 파생임을 밝힌다(접힌 「처리 상세」 안). */
  it('영업일이 파생임을 값에서 밝힌다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.businessDateAuto('2026-08-11'))).toBeInTheDocument();
  });

  /** 확인 빈도가 낮은 값은 접힌 「처리 상세」 안에 선다. */
  it('출고 유형 · 원천 문서 유형 · 영업일은 처리 상세 안에 있다', () => {
    const { container } = renderDialog();

    const details = container.ownerDocument.querySelector('details');

    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(details).toHaveTextContent(t.dialog.details);
    expect(details).toHaveTextContent('SAMPLE_GI_TYPE_A');
    expect(details).toHaveTextContent('INBOUND_RECEIPT');
    expect(details).toHaveTextContent(t.dialog.businessDateAuto('2026-08-11'));
  });

  /** 「출고 정보」 상자 — 입고 번호 · 창고 · 폐기 사유 · 출고 일시 · 폐기 거래처. */
  it('출고 정보 상자에 다섯 값을 보인다', () => {
    renderDialog();

    const info = screen.getByRole('region', { name: t.dialog.issueInfo });

    for (const label of [
      t.summary.goodsReceiptNo,
      t.summary.warehouse,
      t.formFields.reason,
      t.dialog.issuedAt,
      t.formFields.disposalPartner,
    ]) {
      expect(within(info).getByText(label)).toBeInTheDocument();
    }
  });

  /** 비고는 값이 있을 때만 — 빈 비고 행은 세우지 않는다. */
  it('비고는 값이 있을 때만 보인다', () => {
    const { unmount } = renderDialog();

    expect(screen.queryByText(t.formFields.remarks)).not.toBeInTheDocument();
    unmount();

    renderDialog({ summary: { ...SUMMARY, remarks: '합성 비고' } });

    const info = screen.getByRole('region', { name: t.dialog.issueInfo });

    expect(within(info).getByText(t.formFields.remarks)).toBeInTheDocument();
    expect(within(info).getByText('합성 비고')).toBeInTheDocument();
  });

  /** 합계만 보이면 어느 줄이 얼마인지 확인할 수 없다 — 줄마다 다시 보인다. */
  it('폐기 대상을 줄마다 품목명 · 코드 · LOT · 수량으로 보인다', () => {
    renderDialog();

    const target = screen.getByRole('region', { name: t.dialog.targetHead(2) });
    const rows = within(target).getAllByRole('listitem');

    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('합성 자재 가')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('SAMPLE-ITEM-01')).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByText(`${t.lineTable.lot} SAMPLE-LOT-0001`),
    ).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('10 SAMPLE-UOM-EA')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('2 SAMPLE-UOM-BX')).toBeInTheDocument();
  });
});

describe('SubmitConfirmDialog 사유', () => {
  /** 사유는 **한 번만** 보인다 — 첫 줄을 따로 되풀이하지 않는다. 첫 줄 안내 문장은 걷었다(사용자 지시 · #360). */
  it('결재 요청 사유를 한 번만 보인다', () => {
    renderDialog();

    expect(screen.getAllByText('불량 판정분 폐기')).toHaveLength(1);
    expect(screen.queryByText('결재함 목록에는 첫 줄이 표시됩니다.')).not.toBeInTheDocument();
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

    const reason = screen.getByRole('region', { name: t.dialog.approvalReason });
    const lines = [...reason.querySelectorAll('.di-confirm-reason > p')].map(
      (node) => node.textContent,
    );

    expect(lines).toEqual([
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

    expect(screen.getByRole('button', { name: t.actions.backToInput })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.requestApproval })).toBeInTheDocument();
  });

  /**
   * **사용자가 지정한 낱말**(#360) — 바닥 버튼은 「입력으로 돌아가기」 · 「결재 요청」이다.
   *
   * 나머지 시험은 버튼을 키로 조회해서 값이 무엇이든 늘 통과한다. 낱말이 되돌아가는 것을
   * 잡으려면 **보이는 글자를 직접 무는 자리**가 하나 있어야 한다.
   */
  it('바닥 버튼의 보이는 글자가 지정 문면 그대로다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.requestApproval })).toHaveTextContent(
      /^결재 요청$/,
    );
    expect(screen.getByRole('button', { name: t.actions.backToInput })).toHaveTextContent(
      /^입력으로 돌아가기$/,
    );
  });

  it('결재 요청을 누르면 알리고, 입력으로 돌아가기를 누르면 닫는다', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderDialog({ onConfirm, onClose });
    await user.click(screen.getByRole('button', { name: t.actions.requestApproval }));

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.backToInput }));

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
