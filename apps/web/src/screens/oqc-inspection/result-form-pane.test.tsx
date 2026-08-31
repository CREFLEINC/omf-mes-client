import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { toCodeOptions } from './code-options';
import { confirmedRound, overallJudgmentCodeValues, waitingRequest } from './fixtures';
import { EMPTY_QUANTITY_DRAFT, type QuantityDraft } from './quantity-draft';
import { ResultFormPane, type ResultFormPaneProps } from './result-form-pane';
import { toInspectionResultRound } from './types';

const t = messages.oqcInspection.result;
const transition = messages.oqcInspection.transition;
const confirm = messages.oqcInspection.confirm;

const options = toCodeOptions(overallJudgmentCodeValues);

/** 합계가 딱 맞는 초안 — 저장이 열리는 정상 경로다(480 + 15 + 5 = 500). */
const MATCHING: QuantityDraft = { accepted: '480', rejected: '15', held: '5' };

const renderPane = (overrides: Partial<ResultFormPaneProps> = {}) => {
  const onSave = vi.fn();
  const props: ResultFormPaneProps = {
    round: null,
    inspectionRequestNo: waitingRequest.inspectionRequestNo,
    inspectedQty: 500,
    draft: EMPTY_QUANTITY_DRAFT,
    onChange: vi.fn(),
    judgmentOptions: options,
    judgment: '',
    onJudgmentChange: vi.fn(),
    onSave,
    isSaving: false,
    isJustSaved: false,
    fieldErrors: {},
    saveError: null,
    onReload: vi.fn(),
    isReinspecting: false,
    onStartReinspection: vi.fn(),
    onCancelReinspection: vi.fn(),
    ...overrides,
  };

  renderWithProviders(<ResultFormPane {...props} />);

  return { onSave, props };
};

describe('ResultFormPane — 판정 폼', () => {
  it('수량 세 칸과 종합 판정을 그리고, 임시 저장 자리를 두지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText(t.fields.accepted)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.rejected)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.held)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.judgment })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.save })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '임시 저장' })).not.toBeInTheDocument();
  });

  it('회차가 하나도 없으면 0을 미리 채우지 않는다 — 「0으로 판정했다」와 같아 보이면 안 된다', () => {
    renderPane();

    expect(screen.getByLabelText(t.fields.accepted)).toHaveValue('');
    expect(screen.getByText(t.notStarted)).toBeInTheDocument();
  });

  it('검사성적서 발행 자리를 감추지 않고 비활성 + 사유로 세운다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.coaIssue })).toBeDisabled();
    expect(screen.getByText(t.coaPending)).toBeInTheDocument();
  });
});

describe('ResultFormPane — 막힌 사유 네 갈래', () => {
  it('합계가 어긋나면 무엇이 막혔는지 말한다', () => {
    renderPane({ draft: { accepted: '480', rejected: '15', held: '' } });

    expect(screen.getByText(t.blockedByTotals)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled();
  });

  it('판정을 고르지 않았으면 고르라고 말한다', () => {
    renderPane({ draft: MATCHING });

    expect(screen.getByText(t.blockedByJudgment)).toBeInTheDocument();
  });

  it('판정 목록이 비면 감추지 않고 사유를 밝힌다 — 「고르세요」라고 하지 않는다', () => {
    renderPane({ draft: MATCHING, judgmentOptions: [] });

    expect(screen.getByRole('combobox', { name: t.judgment })).toBeDisabled();
    expect(screen.getByText(t.judgmentUnavailable)).toBeInTheDocument();
    expect(screen.getByText(t.blockedByJudgmentOptions)).toBeInTheDocument();
    expect(screen.queryByText(t.blockedByJudgment)).not.toBeInTheDocument();
  });

  it('확정된 회차는 칸이 잠기고 재검사만 열린다', () => {
    renderPane({ round: toInspectionResultRound(confirmedRound), draft: MATCHING });

    expect(screen.getByLabelText(t.fields.accepted)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.reinspect })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.save })).not.toBeInTheDocument();
    expect(screen.getByText(t.blockedByConfirmed)).toBeInTheDocument();
  });
});

describe('ResultFormPane — 전이 경고', () => {
  it('네 규칙을 담고, 아는 판정에는 방향을 덧붙인다', () => {
    renderPane({ draft: MATCHING, judgment: 'ACCEPTED' });

    const banner = screen.getByRole('alert');

    expect(within(banner).getByText(transition.quantities('480', '15', '5'))).toBeInTheDocument();
    expect(within(banner).getByText(transition.directionRelease)).toBeInTheDocument();
    expect(within(banner).getByText(transition.pickingImpact)).toBeInTheDocument();
    expect(within(banner).getByText(transition.pickedNotReturned)).toBeInTheDocument();
    expect(within(banner).getByText(transition.noAmendment)).toBeInTheDocument();
    expect(within(banner).getByText(transition.dispositionPath)).toBeInTheDocument();
  });

  it('모르는 판정 코드에는 방향을 지어내지 않는다', () => {
    renderPane({ draft: MATCHING, judgment: 'SOMETHING_NEW' });

    expect(screen.getByText(transition.directionUnknown)).toBeInTheDocument();
    expect(screen.queryByText(transition.directionRelease)).not.toBeInTheDocument();
  });

  it('셀 수 없으면 경고 자체를 그리지 않는다 — 숫자가 거짓이 되는 동안 권하지 않는다', () => {
    renderPane({ draft: { accepted: 'abc', rejected: '15', held: '5' }, judgment: 'ACCEPTED' });

    expect(screen.queryByText(transition.title)).not.toBeInTheDocument();
  });
});

describe('ResultFormPane — 확인 창', () => {
  it('저장을 누르면 창이 열릴 뿐이고 쓰기는 창의 버튼에서 나간다', async () => {
    const { onSave } = renderPane({ draft: MATCHING, judgment: 'ACCEPTED' });

    await userEvent.click(screen.getByRole('button', { name: t.save }));

    const dialog = screen.getByRole('dialog');

    expect(
      within(dialog).getByText(confirm.title(waitingRequest.inspectionRequestNo)),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(confirm.judgment('합격'))).toBeInTheDocument();
    expect(within(dialog).getByText(confirm.irreversible)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: confirm.confirm }));

    /* 검사한 시각은 창을 여는 순간 한 번 읽은 값이다 — 형식만 확인한다. */
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(String(onSave.mock.calls[0]?.[0])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('취소하면 창이 닫히고 아무것도 나가지 않는다', async () => {
    const { onSave } = renderPane({ draft: MATCHING, judgment: 'ACCEPTED' });

    await userEvent.click(screen.getByRole('button', { name: t.save }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: confirm.cancel }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
