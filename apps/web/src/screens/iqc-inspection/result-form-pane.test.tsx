import { messages } from '@omf-mes/i18n';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { toCodeOptions } from './code-options';
import { confirmedRound, draftRound, overallJudgmentCodeValues } from './fixtures';
import { EMPTY_QUANTITY_DRAFT, type QuantityDraft } from './quantity-draft';
import { ResultFormPane } from './result-form-pane';
import { toInspectionResultRound, type InspectionResultRound } from './types';

const t = messages.iqcInspection.result;

const renderPane = (
  draft: QuantityDraft = EMPTY_QUANTITY_DRAFT,
  round: InspectionResultRound | null = toInspectionResultRound(draftRound),
  inspectedQty = 500,
  overrides: Partial<Parameters<typeof ResultFormPane>[0]> = {},
) => {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const onConfirm = vi.fn();
  const onStartReinspection = vi.fn();

  renderWithProviders(
    <ResultFormPane
      round={round}
      inspectedQty={inspectedQty}
      uomCode={null}
      draft={draft}
      hasChanges
      onChange={onChange}
      onSave={onSave}
      isSaving={false}
      fieldErrors={{}}
      saveError={null}
      onReload={vi.fn()}
      judgmentOptions={toCodeOptions(overallJudgmentCodeValues)}
      judgment=""
      onJudgmentChange={vi.fn()}
      onConfirm={onConfirm}
      isConfirming={false}
      confirmError={null}
      isJustConfirmed={false}
      isReinspecting={false}
      onStartReinspection={onStartReinspection}
      onCancelReinspection={vi.fn()}
      {...overrides}
    />,
  );

  return { onChange, onSave, onConfirm, onStartReinspection };
};

const saveButton = () => screen.getByRole('button', { name: t.save });

/** 이미 만들어진 작성중 회차. 확정 갈래는 회차가 «있어야» 성립한다. */
const savedRound = toInspectionResultRound(draftRound);

/** 1단계(검사 수량 입력)를 다 채웠는가 — 합계가 검사수량과 맞으면 단계 머리에 `data-done` 이 선다(#185). */
const qtyStepDone = (): boolean =>
  document.querySelector('.iqc-inspection-step-head')?.hasAttribute('data-done') ?? false;

describe('ResultFormPane', () => {
  it('회차를 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.round(1))).toBeInTheDocument();
  });

  it('아직 회차가 없으면 회차 표시를 내지 않고, 확정은 임시 저장부터라고 단추 곁에서 말한다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null);

    expect(screen.queryByText(t.round(1))).not.toBeInTheDocument();
    expect(screen.getByText(t.confirmBlockedByUnsaved)).toBeInTheDocument();
  });

  it('세 칸을 손으로 넣는다 — 자동 계산을 만들지 않는다', async () => {
    const { onChange } = renderPane();

    await userEvent.type(screen.getByLabelText(t.fields.accepted), '4');

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_QUANTITY_DRAFT, accepted: '4' });
  });

  it('합계가 맞으면 1단계가 다 채워진 것으로 서고, 따로 일치 문장은 없다(#133 · #185)', () => {
    renderPane({ accepted: '480', rejected: '15', held: '5' });

    expect(qtyStepDone()).toBe(true);
    expect(screen.queryByText('검사수량과 일치합니다.')).not.toBeInTheDocument();
  });

  it('모자라면 1단계가 아직이고 따로 문장은 없다(#133 · #185)', () => {
    renderPane({ accepted: '400', rejected: '0', held: '0' });

    expect(qtyStepDone()).toBe(false);
    /* 모자란 양은 총 검사 수량 옆 「-100」으로 말한다(#185). */
    expect(screen.getByText(t.shortDelta('100'))).toBeInTheDocument();
    expect(screen.queryByText(/남았습니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(t.overDelta('100'))).not.toBeInTheDocument();
  });

  it('넘기면 얼마나 넘겼는지 말한다 — 0으로 깎아 감추지 않는다', () => {
    renderPane({ accepted: '600', rejected: '0', held: '0' });

    /* 총 검사 수량 카드에 「+100」으로 넘친 양을 붙인다(#185). */
    expect(screen.getByText(t.overDelta('100'))).toBeInTheDocument();
    /* 음수 잔여(「잔여 -100」)로 말하지 않는다(#133). 넘친 것은 다 채운 것이 아니다. */
    expect(screen.queryByText(/-100/)).not.toBeInTheDocument();
    expect(qtyStepDone()).toBe(false);
  });

  it('소수 합이 부동소수 오차로 어긋나지 않는다', () => {
    renderPane({ accepted: '0.1', rejected: '0.2', held: '0' }, null, 0.3);

    expect(qtyStepDone()).toBe(true);
  });

  it('오류를 타이핑마다 보이지 않는다 — 「0.5」를 치는 도중 「0.」에서 틀렸다고 하지 않는다', () => {
    renderPane({ ...EMPTY_QUANTITY_DRAFT, accepted: '0.' });

    expect(screen.queryByText(t.quantityInvalid)).not.toBeInTheDocument();
  });

  it('저장을 누른 뒤부터 수량이 아닌 값을 짚는다', async () => {
    renderPane({ ...EMPTY_QUANTITY_DRAFT, accepted: '-1' });

    await userEvent.click(saveButton());

    expect(screen.getByText(t.quantityInvalid)).toBeInTheDocument();
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 잘못된 칸을 0으로 읽고 세면 화면이 오류와 「일치합니다」를
   * 동시에 내고, 그중 하나가 거짓이다.
   */
  it('한 칸이 수량이 아니면 일치한다고 말하지 않는다 — 셀 수 없는 것을 셌다고 하지 않는다', () => {
    /* 0으로 읽고 세면 abc + 500 + 빈칸 = 500 이 되어 「일치합니다」가 거짓이 된다. */
    renderPane({ accepted: 'abc', rejected: '500', held: '' });

    expect(qtyStepDone()).toBe(false);
  });

  it('확정된 회차는 고칠 수 있는 것처럼 보이지 않는다 — 이전 회차는 정정하지 않는다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, toInspectionResultRound(confirmedRound));

    expect(screen.getByLabelText(t.fields.accepted)).toBeDisabled();
    expect(screen.getAllByText(t.confirmed).length).toBeGreaterThan(0);
  });

  it('저장을 누르면 저장한다', async () => {
    const { onSave } = renderPane({ accepted: '480', rejected: '15', held: '5' });

    await userEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  /*
   * ⭐ 임시 저장은 판정을 확정하는 것이 아니라 하던 일을 남기는 것이다. 계약도 「작성중」에는
   * 합계 제약을 걸지 않는다(스펙 §6). 여기서 막으면 검사자가 중간에 자리를 뜰 수 없다.
   */
  it('합계가 맞지 않아도 저장한다 — 확정이 아니라 하던 일을 남기는 것이다', async () => {
    const { onSave } = renderPane({ accepted: '100', rejected: '0', held: '0' });

    await userEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('수량이 아닌 값이 남아 있으면 저장하지 않고 사유를 보인다 — 보낼 수 없는 값이다', async () => {
    const { onSave } = renderPane({ ...EMPTY_QUANTITY_DRAFT, accepted: 'abc' });

    await userEvent.click(saveButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(t.saveBlockedByInvalid)).toBeInTheDocument();
  });

  it('저장 중에는 칸과 단추를 잠근다 — 같은 값을 두 번 보내지 않는다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, { isSaving: true });

    expect(screen.getByLabelText(t.fields.accepted)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.saving })).toBeDisabled();
  });

  it('서버가 칸을 짚어 주면 그 칸에 낸다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, {
      fieldErrors: { acceptedQty: '합격수량이 검사수량을 넘습니다.' },
    });

    expect(screen.getByText('합격수량이 검사수량을 넘습니다.')).toBeInTheDocument();
  });

  const confirmButton = () => screen.queryByRole('button', { name: t.confirm });

  it('⛔ 확정이 되돌릴 수 없다는 사실을 누르기 전에 알린다', () => {
    renderPane({ accepted: '480', rejected: '15', held: '5' }, savedRound, 500, {
      judgment: 'ACCEPTED',
    });

    expect(confirmButton()).toBeEnabled();
    expect(screen.getByText(t.confirmNote)).toBeInTheDocument();
  });

  /* #133 — 막힌 동안에는 막힌 까닭 하나만 — 경고 띠를 겹쳐 띄우지 않는다. */
  it('확정이 막힌 동안에는 되돌릴 수 없다는 경고 대신 막힌 까닭만 보인다', () => {
    renderPane();

    expect(confirmButton()).toBeDisabled();
    expect(screen.queryByText(t.confirmNote)).not.toBeInTheDocument();
  });

  /* ⭐ 회차를 «있는 것»으로 둔다 — 회차가 없으면 합계와 무관하게 확정 자체가 불가능하다. */
  it('합계가 맞지 않으면 확정을 막고 사유를 밝힌다', () => {
    renderPane({ accepted: '100', rejected: '0', held: '0' }, savedRound, 500, {
      judgment: 'ACCEPTED',
    });

    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText(t.confirmBlockedByTotals)).toBeInTheDocument();
  });

  it('판정을 고르지 않으면 확정을 막고 사유를 밝힌다 — 합계와 다른 사유다', () => {
    renderPane({ accepted: '480', rejected: '15', held: '5' }, savedRound, 500, { judgment: '' });

    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText(t.confirmBlockedByJudgment)).toBeInTheDocument();
  });

  it('합계가 맞고 판정을 고르면 확정할 수 있다', async () => {
    const { onConfirm } = renderPane(
      { accepted: '480', rejected: '15', held: '5' },
      savedRound,
      500,
      {
        judgment: 'ACCEPTED',
      },
    );

    expect(confirmButton()).toBeEnabled();
    await userEvent.click(confirmButton() as HTMLElement);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('셀 수 없는 수량이 있으면 확정을 막는다 — 「일치」를 지어내지 않는다', () => {
    renderPane({ accepted: 'abc', rejected: '500', held: '' }, null, 500, { judgment: 'ACCEPTED' });

    expect(confirmButton()).toBeDisabled();
  });

  it('판정 목록이 비면 감추지 않고 사유를 밝힌다 — 시드가 아직 없을 수 있다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, { judgmentOptions: [] });

    expect(screen.getByLabelText(t.judgment)).toBeDisabled();
    expect(screen.getByText(t.judgmentUnavailable)).toBeInTheDocument();
  });

  it('저장된 판정이 목록에 없으면 알린다 — 조용히 비우면 고른 것이 지워진다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, { judgment: 'RETIRED' });

    expect(screen.getByText(t.judgmentUnknown('RETIRED'))).toBeInTheDocument();
  });

  it('확정된 회차에는 확정 자리를 만들지 않는다 — 재검사로 새 회차를 쌓는다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, toInspectionResultRound(confirmedRound));

    expect(confirmButton()).not.toBeInTheDocument();
  });

  it('확정된 회차에는 저장 자리를 만들지 않는다 — 눌러도 아무 일이 없는 컨트롤을 두지 않는다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, toInspectionResultRound(confirmedRound));

    expect(screen.queryByRole('button', { name: t.save })).not.toBeInTheDocument();
  });
});

describe('ResultFormPane — 재검사', () => {
  it('확정된 회차에는 재검사로 가는 길이 있다 — 사유만 내고 막지 않는다', async () => {
    const { onStartReinspection } = renderPane(
      EMPTY_QUANTITY_DRAFT,
      toInspectionResultRound(confirmedRound),
    );

    await userEvent.click(screen.getByRole('button', { name: t.reinspect }));

    expect(onStartReinspection).toHaveBeenCalledTimes(1);
  });

  it('확정되지 않은 회차에는 재검사 자리를 두지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: t.reinspect })).not.toBeInTheDocument();
  });

  /*
   * ⭐ 재검사 중에는 «아직 만들어지지 않은» 회차라 번호가 없다. 번호를 붙이면 화면이 회차를
   * 세는 셈인데 +1 은 서버가 한다 — 두 사람이 동시에 열면 같은 번호를 만든다.
   */
  it('재검사 중에는 번호 없이 새 회차임을 말한다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, { isReinspecting: true });

    expect(screen.getByText(t.reinspectRound)).toBeInTheDocument();
    expect(screen.getByText(t.reinspectNote)).toBeInTheDocument();
  });

  it('재검사를 그만두는 길이 함께 있다 — 열고 나서 갇히지 않는다', async () => {
    const onCancelReinspection = vi.fn();
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, { isReinspecting: true, onCancelReinspection });

    await userEvent.click(screen.getByRole('button', { name: t.reinspectCancel }));

    expect(onCancelReinspection).toHaveBeenCalledTimes(1);
  });

  it('재검사 중에는 칸이 열려 있다 — 확정본을 고치는 것이 아니다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, { isReinspecting: true });

    expect(screen.getByLabelText(t.fields.accepted)).toBeEnabled();
    expect(saveButton()).toBeEnabled();
  });
});

describe('ResultFormPane — 저장 전 확정', () => {
  /**
   * ⛔ **회차가 없으면 확정할 것이 없다.** 확정은 회차 하나를 «경로로» 지목하는 쓰기라,
   * 없는 회차를 지목하면 치환되지 않은 주소 틀이 그대로 나가 알 수 없는 오류만 돌아온다.
   * 화면에서 가장 중요한 단추가 그렇게 실패하면 사용자는 무엇을 해야 할지 알 수 없다.
   */
  it('회차가 없으면 확정을 막고 먼저 저장하라고 말한다', () => {
    renderPane({ accepted: '500', rejected: '0', held: '0' }, null, 500, { judgment: 'ACCEPTED' });

    expect(screen.getByRole('button', { name: t.confirm })).toBeDisabled();
    expect(screen.getByText(t.confirmBlockedByUnsaved)).toBeInTheDocument();
  });

  it('재검사 중에도 저장 전에는 확정을 막는다', () => {
    renderPane({ accepted: '500', rejected: '0', held: '0' }, null, 500, {
      judgment: 'ACCEPTED',
      isReinspecting: true,
    });

    expect(screen.getByRole('button', { name: t.confirm })).toBeDisabled();
  });

  /* 회차가 있으면 그 사유는 사라진다 — 늘 막으면 확정 자체가 불가능하다. */
  it('회차가 있으면 확정이 열린다', () => {
    renderPane(
      { accepted: '500', rejected: '0', held: '0' },
      toInspectionResultRound(draftRound),
      500,
      {
        judgment: 'ACCEPTED',
      },
    );

    expect(screen.getByRole('button', { name: t.confirm })).toBeEnabled();
    expect(screen.queryByText(t.confirmBlockedByUnsaved)).not.toBeInTheDocument();
  });
});

describe('ResultFormPane — 미결과 결과 문면', () => {
  /**
   * ⚠ **자리는 확정이고 규칙만 미정이다**(스펙 §8 #2). ⛔ 감추지 않는다 — 감추면 이 화면에
   * 그 갈래가 «없는 것»이 되고, 협의가 끝나면 사용자는 「없던 것이 생겼다」로 만난다.
   */
  it('부분 입고 허용 자리를 두되 아직 쓸 수 없다고 밝힌다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.partialReceipt })).toBeDisabled();
    expect(screen.getByText(t.partialReceiptPending)).toBeInTheDocument();
  });

  /* ⛔ 확정된 회차에는 판정을 바꿀 자리를 두지 않는다 — 부분 입고도 그 자리다. */
  it('확정된 회차에는 부분 입고 자리를 두지 않는다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, toInspectionResultRound(confirmedRound));

    expect(screen.queryByRole('button', { name: t.partialReceipt })).not.toBeInTheDocument();
  });

  /*
   * ⛔ 되돌릴 수 없는 쓰기가 끝난 것을 말한다. 저장은 「저장했습니다」를 내는데 확정만
   * 아무 말이 없으면 사용자는 그것이 됐는지 확인할 문장을 못 찾아 한 번 더 누를 자리를 찾는다.
   */
  it('방금 확정했으면 그 사실을 말한다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, toInspectionResultRound(confirmedRound), 500, {
      isJustConfirmed: true,
    });

    expect(screen.getByText(t.confirmSucceeded)).toBeInTheDocument();
  });

  /**
   * ⭐ **상태가 아니라 결과다.** 어제 확정된 회차에도 「확정했습니다」를 내면 화면에 들어올
   * 때마다 방금 한 일처럼 말한다 — 사용자는 자기가 누른 적 없는 쓰기를 했다고 읽는다.
   */
  it('예전에 확정된 회차에는 방금 한 일처럼 말하지 않는다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, toInspectionResultRound(confirmedRound));

    expect(screen.queryByText(t.confirmSucceeded)).not.toBeInTheDocument();
  });

  it('단위 코드를 알면 총 검사 수량 · 칸 옆에 붙인다 — 입력값에는 넣지 않는다', () => {
    renderPane({ accepted: '400', rejected: '', held: '' }, undefined, 500, { uomCode: 'EA' });

    expect(screen.getByText('500 EA')).toBeInTheDocument();
    expect(screen.getAllByText('EA')).toHaveLength(3);
    expect(screen.getByLabelText(t.fields.accepted)).toHaveValue('400');
  });

  it('바뀐 것이 없으면 [임시 저장]을 끈다 — 확정 조건과는 따로다', () => {
    renderPane({ accepted: '480', rejected: '15', held: '5' }, undefined, 500, {
      hasChanges: false,
    });

    expect(saveButton()).toBeDisabled();
  });
});

describe('ResultFormPane — 입력 현황(#185)', () => {
  it('진행 막대는 두지 않는다 — 라벨 · 수량 · 미입력 글만 선다', () => {
    renderPane({ accepted: '400', rejected: '0', held: '0' });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

/** 검사 수량을 다 채운 초안 — 수량 창의 [확정]이 켜진다(#197). */
const FULL_DRAFT: QuantityDraft = { accepted: '500', rejected: '0', held: '0' };

/** 단계 상태 — 펼친 단계는 open, 나머지는 마침(done) · 덜 채운 첫 단계(current) · 남음(todo)(#197). */
const stepStates = (): string[] =>
  [...document.querySelectorAll('.iqc-inspection-stepper > li')].map((item) =>
    item.hasAttribute('data-open') ? 'open' : (item.getAttribute('data-step-state') ?? ''),
  );
const stepItem = (step: number): HTMLElement =>
  document.querySelectorAll<HTMLElement>('.iqc-inspection-stepper > li')[step - 1] as HTMLElement;

/** 단계 줄 아래에 펼쳐 그린 단계 구획 — 차례로 열 때는 없다(입력은 단계 줄 아래 한 자리). */
const renderedSteps = (): string[] =>
  [...document.querySelectorAll('.iqc-inspection-qty-judgment-row > .iqc-inspection-section')].map(
    (section) => section.getAttribute('data-step') ?? '',
  );

/* 지금 단계의 입력 자리(#197) — 창이 아니라 단계 줄 아래 한 상자이고, 이름이 그 단계 제목이다. */
const qtyPanel = () => screen.queryByRole('region', { name: t.sectionTitle });
const judgmentPanel = () => screen.queryByRole('region', { name: t.judgmentSectionTitle });
const fourMPanel = () => screen.queryByRole('region', { name: t.fourMChange.sectionTitle });
/** 그 자리의 [확정] — ① 은 불량 내역을 쓰는 화면이면 [입력 완료]다(#197). */
const nextOf = (panel: HTMLElement | null): HTMLElement =>
  within(panel as HTMLElement).getByRole('button', {
    name: new RegExp(`^(${t.stepSummary.next}|${t.stepSummary.qtyDone})$`),
  });
/** 수량 자리의 [확정] — ② 판정 자리가 같은 곳에 선다. */
const toJudgmentStep = async (): Promise<HTMLElement> => {
  await userEvent.click(nextOf(qtyPanel()));
  return judgmentPanel() as HTMLElement;
};
/** 판정 자리의 [확정] — ③ 으로 넘어간다. */
const confirmJudgment = async (): Promise<void> => {
  await userEvent.click(nextOf(judgmentPanel()));
};
/** 아직 저장된 진행이 없는 새 검사 — 처음 ① 부터 연다. */
const NEW: InspectionResultRound | null = null;

describe('ResultFormPane — 상하 배치 판정(#185)', () => {
  /* 「판정 상세 입력」 창은 모두 펼칠 때(확정된 회차)만 남았다 — 차례로 열 때는 판정 자리 안에 칸이 선다(#197). */
  it('「판정 상세 입력」 창의 [취소]는 열 때 값으로 되돌리게 알린다(모두 펼칠 때)', async () => {
    const onJudgmentDetailOpen = vi.fn();
    const onJudgmentDetailCancel = vi.fn();
    renderPane(FULL_DRAFT, toInspectionResultRound(confirmedRound), 500, {
      inlineJudgment: true,
      hasJudgmentDetail: true,
      judgmentDetail: <p>불합격 칸</p>,
      onJudgmentDetailOpen,
      onJudgmentDetailCancel,
    });

    await userEvent.click(screen.getByRole('button', { name: t.judgmentDetailOpen }));
    expect(onJudgmentDetailOpen).toHaveBeenCalledTimes(1);
    await userEvent.click(await screen.findByRole('button', { name: t.judgmentDetailCancel }));
    expect(onJudgmentDetailCancel).toHaveBeenCalledTimes(1);
  });

  it('입력만으로는 넘어가지 않는다 — 수량 [확정]으로 판정, 판정 [확정]으로 3단계(#197)', async () => {
    const fourMSlot = <p>4M 칸</p>;

    renderPane(FULL_DRAFT, NEW, 500, { inlineJudgment: true, fourMSlot, judgmentDone: true });
    /* 합계가 맞고 판정까지 채워져 있어도 ① 에 머문다 — [확정]을 눌러야 넘어가고, 그 전에는 뒤 단계가 보이지 않는다. */
    expect(stepStates()).toEqual(['open']);
    expect(qtyPanel()).not.toBeNull();
    await toJudgmentStep();
    expect(stepStates()).toEqual(['done', 'open']);
    await confirmJudgment();
    expect(judgmentPanel()).toBeNull();
    expect(stepStates()).toEqual(['done', 'done', 'open']);
    expect(within(fourMPanel() as HTMLElement).getByText('4M 칸')).toBeInTheDocument();
  });

  it('최종 판정은 판정 자리에 서고, 적을 것이 없으면 판정 상세 칸 · 「판정 상세 입력」이 없다', async () => {
    renderPane(FULL_DRAFT, NEW, 500, { inlineJudgment: true });

    const panel = await toJudgmentStep();
    expect(within(stepItem(2)).getByText(t.judgmentSectionTitle)).toBeInTheDocument();
    expect(within(panel).getByRole('combobox', { name: t.judgment })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.judgmentDetailOpen })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t.judgmentDetailTitle })).not.toBeInTheDocument();
  });

  it('불합격 · 판정 변경 사유가 있으면 그 칸이 판정 자리 안에 바로 선다 — 창을 띄우지 않는다(#197)', async () => {
    renderPane(FULL_DRAFT, NEW, 500, {
      inlineJudgment: true,
      hasJudgmentDetail: true,
      judgmentBelow: <p>변경 사유 칸</p>,
      judgmentDetail: <p>불합격 칸</p>,
    });

    const panel = await toJudgmentStep();
    expect(within(panel).getByText('불합격 칸')).toBeInTheDocument();
    expect(within(panel).getByText('변경 사유 칸')).toBeInTheDocument();
    expect(screen.getAllByText('불합격 칸')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ResultFormPane — 단계를 차례로 연다(#197)', () => {
  const fourMSlot = <p>4M 칸</p>;

  it('처음에는 ① 수량 입력만 바로 서고, 뒤 단계는 보이지 않는다 — 창도 [입력]도 없다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, NEW, 500, { inlineJudgment: true, fourMSlot });

    expect(stepStates()).toEqual(['open']);
    expect(renderedSteps()).toEqual([]);
    expect(within(qtyPanel() as HTMLElement).getByLabelText(t.fields.accepted)).toBeInTheDocument();
    expect(judgmentPanel()).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    /* 남은 단계(판정 · 4M)는 아예 그리지 않는다. */
    expect(screen.queryByText('4M 칸')).not.toBeInTheDocument();
  });

  it('합계가 맞지 않아도 [확정]으로 판정 단계에 넘어간다 — 임시 저장 흐름(#197)', async () => {
    const pane = renderPane({ accepted: '400', rejected: '', held: '' }, NEW, 500, {
      inlineJudgment: true,
      fourMSlot,
    });

    const next = nextOf(qtyPanel());
    expect(next).toBeEnabled();
    await userEvent.click(next);
    expect(judgmentPanel()).not.toBeNull();
    expect(stepStates()).toEqual(['done', 'open']);
    expect(pane.onSave).not.toHaveBeenCalled();
  });

  it('수량 칸이 수량이 아니면 [확정]이 꺼져 있다(#197)', () => {
    renderPane({ accepted: 'abc', rejected: '', held: '' }, NEW, 500, {
      inlineJudgment: true,
      fourMSlot,
    });

    expect(nextOf(qtyPanel())).toBeDisabled();
  });

  it('수량 칸 Enter 는 합계가 맞지 않아도 판정 단계로 넘기며, 저장하지 않는다(#197)', async () => {
    const short = renderPane({ accepted: '400', rejected: '', held: '' }, NEW, 500, {
      inlineJudgment: true,
      fourMSlot,
    });
    await userEvent.type(screen.getByLabelText(t.fields.accepted), '{Enter}');
    expect(qtyPanel()).toBeNull();
    expect(judgmentPanel()).not.toBeNull();
    expect(stepStates()).toEqual(['done', 'open']);
    expect(short.onSave).not.toHaveBeenCalled();
  });

  it('수량 [확정] 뒤 ① 카드에 요약과 [변경]이 선다', async () => {
    renderPane({ accepted: '480', rejected: '15', held: '5' }, NEW, 500, {
      inlineJudgment: true,
      fourMSlot,
    });

    const panel = await toJudgmentStep();
    expect(qtyPanel()).toBeNull();
    expect(within(panel).getByRole('combobox', { name: t.judgment })).toBeInTheDocument();
    expect(stepStates()).toEqual(['done', 'open']);
    expect(
      within(stepItem(1)).getByText(t.stepSummary.quantities('480', '15', '5')),
    ).toBeInTheDocument();
    expect(within(stepItem(1)).getByRole('button', { expanded: false })).toBeInTheDocument();
  });

  it('판정 [확정]은 판정을 채운 뒤에만 켜지고, 누르면 ③ 4M 이 같은 자리에 선다', async () => {
    renderPane(FULL_DRAFT, NEW, 500, { inlineJudgment: true, fourMSlot });
    const empty = await toJudgmentStep();
    expect(nextOf(empty)).toBeDisabled();
    cleanup();

    renderPane(FULL_DRAFT, NEW, 500, {
      inlineJudgment: true,
      fourMSlot,
      judgmentDone: true,
      fourMSummary: t.stepSummary.fourMNone,
    });
    await toJudgmentStep();
    await confirmJudgment();
    expect(judgmentPanel()).toBeNull();
    expect(stepStates()).toEqual(['done', 'done', 'open']);
    expect(renderedSteps()).toEqual([]);
    expect(within(fourMPanel() as HTMLElement).getByText('4M 칸')).toBeInTheDocument();
    /* ③ 은 선택이라 [확정]이 없다 — 마무리는 아래 [임시 저장] · [판정 확정]이다. */
    expect(within(fourMPanel() as HTMLElement).queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(2);
  });

  it('4M 이 없으면 판정 [확정] 뒤 모든 카드가 마침이고 입력 자리가 없다', async () => {
    renderPane(FULL_DRAFT, NEW, 500, { inlineJudgment: true, judgmentDone: true });

    await toJudgmentStep();
    await confirmJudgment();
    expect(stepStates()).toEqual(['done', 'done']);
    expect(document.querySelector('.iqc-inspection-step-panel')).toBeNull();
  });

  it('마친 카드의 [변경] — 그 단계 입력이 같은 자리에 다시 서고, 적은 값과 완료 표시는 그대로다', async () => {
    renderPane(FULL_DRAFT, NEW, 500, {
      inlineJudgment: true,
      fourMSlot,
      judgmentDone: true,
    });
    await toJudgmentStep();
    await confirmJudgment();

    await userEvent.click(within(stepItem(2)).getByRole('button'));
    expect(judgmentPanel()).not.toBeNull();
    expect(stepStates()).toEqual(['done', 'open', 'current']);

    await userEvent.click(within(stepItem(1)).getByRole('button'));
    expect(within(qtyPanel() as HTMLElement).getByLabelText(t.fields.accepted)).toHaveValue('500');
    /* 단계를 옮겨 봤다고 완료가 풀리지 않는다. */
    expect(stepStates()).toEqual(['open', 'done', 'current']);
  });

  it('펼친 단계 머리를 다시 누르면 접히고, 다시 누르면 펼쳐진다(#197)', async () => {
    renderPane(EMPTY_QUANTITY_DRAFT, NEW, 500, { inlineJudgment: true, fourMSlot });

    const head = within(stepItem(1)).getByRole('button', { expanded: true });
    await userEvent.click(head);
    expect(qtyPanel()).toBeNull();
    expect(stepStates()).toEqual(['current']);
    await userEvent.click(within(stepItem(1)).getByRole('button', { expanded: false }));
    expect(qtyPanel()).not.toBeNull();
  });

  it('다시 열면 저장된 진행으로 단계를 정한다 — 수량 · 판정까지 저장된 회차는 ③ 을 연다', () => {
    renderPane(FULL_DRAFT, savedRound, 500, {
      inlineJudgment: true,
      fourMSlot,
      judgmentDone: true,
    });

    expect(stepStates()).toEqual(['done', 'done', 'open']);
    expect(fourMPanel()).not.toBeNull();
  });

  it('확정된 회차는 단계 줄 없이 모든 단계를 펼친다 — 수량도 창이 아니라 그 자리에 선다', () => {
    renderPane(FULL_DRAFT, toInspectionResultRound(confirmedRound), 500, {
      inlineJudgment: true,
      fourMSlot,
    });

    expect(stepStates()).toEqual([]);
    expect(renderedSteps()).toEqual(['1', '2', '3']);
    expect(screen.getByLabelText(t.fields.accepted)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.stepSummary.next })).not.toBeInTheDocument();
  });
});
