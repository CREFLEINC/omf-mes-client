import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_DECISION_FORM } from './decision-form';
import { DecisionFormPane, type DecisionFormPaneProps } from './decision-form-pane';
import type { DispositionLookup } from './lookups';

const t = messages.dispositionDecision;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODE = 'CODE-A';

const lookup = (): DispositionLookup => ({
  entries: [{ value: '7001', label: 'EA', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const baseProps = (): DecisionFormPaneProps => ({
  value: EMPTY_DECISION_FORM,
  errors: {},
  qtyNotice: undefined,
  lockReason: undefined,
  dispositionOptions: [{ value: CODE, label: CODE }],
  uomId: 7001,
  uoms: lookup(),
  writeError: null,
  isSaving: false,
  canCancel: false,
  onChange: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onReload: vi.fn(),
});

const renderPane = (overrides: Partial<DecisionFormPaneProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<DecisionFormPane {...props} />), props, user: userEvent.setup() };
};

const saveButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.save });

describe('DecisionFormPane', () => {
  it('⛔ 승인·반려 컨트롤을 두지 않는다 — 결재는 결재함이 처리한다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '승인' })).toBeNull();
    expect(screen.queryByRole('button', { name: '반려' })).toBeNull();
  });

  it('단위를 수량 라벨에 담아 어떤 단위로 저장되는지 보인다', () => {
    renderPane();

    expect(screen.getByLabelText(`${t.form.qtyLabel} (EA)`)).toBeInTheDocument();
  });

  it('단위를 모르면 라벨에 괄호를 붙이지 않는다', () => {
    renderPane({ uomId: undefined });

    expect(screen.getByLabelText(t.form.qtyLabel)).toBeInTheDocument();
  });

  it('처분 선택지가 비면 저장까지 함께 잠그고 사유를 붙인다(G-2)', () => {
    renderPane({ dispositionOptions: [], lockReason: t.dispositionPending });

    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveAccessibleDescription(t.dispositionPending);
  });

  it('잠금 사유는 모든 판정 컨트롤에 연결된다 — 어느 칸이 왜 막혔는지 읽힌다', () => {
    renderPane({ lockReason: t.form.forbiddenReason });

    // 도움말과 «함께» 읽히므로 포함 여부로 본다 — 사유만 남기면 도움말이 사라진다.
    const reason = new RegExp(t.form.forbiddenReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    expect(screen.getByLabelText(t.form.reasonLabel)).toBeDisabled();
    expect(screen.getByLabelText(t.form.reasonLabel)).toHaveAccessibleDescription(reason);
    expect(screen.getByLabelText(`${t.form.qtyLabel} (EA)`)).toHaveAccessibleDescription(reason);
    expect(saveButton()).toHaveAccessibleDescription(reason);
  });

  it('남은 수량 초과는 예고할 뿐 저장을 막지 않는다 — 잔량 판정은 서버 몫이다', () => {
    const notice = t.form.qtyOverRemaining('120');
    renderPane({ qtyNotice: notice });

    expect(saveButton()).toBeEnabled();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  it('⭐ 남은 수량이 0이라는 예고도 저장을 막지 않는다', () => {
    renderPane({ qtyNotice: t.form.qtySettledNotice });

    expect(saveButton()).toBeEnabled();
    expect(screen.getByText(t.form.qtySettledNotice)).toBeInTheDocument();
  });

  it('저장 중에는 저장·취소를 함께 잠근다 — 두 번 보내지 않게 한다', () => {
    renderPane({ isSaving: true, canCancel: true, lockReason: t.form.savingReason });

    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.cancel })).toBeDisabled();
  });

  it('입력이 없으면 취소를 잠근다', () => {
    renderPane({ canCancel: false });

    expect(screen.getByRole('button', { name: t.actions.cancel })).toBeDisabled();
  });

  it('되돌릴 수 없다는 사실을 저장 줄에 상시 적는다', () => {
    renderPane();

    expect(screen.getByText(t.form.irreversible)).toBeInTheDocument();
  });

  it('처분을 고르면 값만 바꿔 알린다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('radio', { name: CODE }));

    expect(props.onChange).toHaveBeenCalledWith({
      ...EMPTY_DECISION_FORM,
      dispositionTypeCode: CODE,
    });
  });

  it('오류 문구를 입력칸에 붙인다', () => {
    renderPane({ errors: { reason: t.form.reasonRequired, decisionQty: t.form.qtyRequired } });

    expect(screen.getByText(t.form.reasonRequired)).toBeInTheDocument();
    expect(screen.getByText(t.form.qtyRequired)).toBeInTheDocument();
  });
});
