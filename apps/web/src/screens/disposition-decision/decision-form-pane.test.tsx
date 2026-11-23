import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_DECISION_FORM } from './decision-form';
import { DecisionFormPane, type DecisionFormPaneProps } from './decision-form-pane';
import type { DispositionLookup } from './lookups';

const t = messages.dispositionDecision;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODE = 'REWORK';

const lookup = (): DispositionLookup => ({
  entries: [{ value: '7001', label: 'EA', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const baseProps = (): DecisionFormPaneProps => ({
  value: EMPTY_DECISION_FORM,
  errors: {},
  lockReason: undefined,
  isUncertain: false,
  onCheckOutcome: vi.fn(),
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

    expect(screen.getByLabelText(t.form.qtyLabel)).toBeInTheDocument();
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
    expect(screen.getByLabelText(t.form.qtyLabel)).toHaveAccessibleDescription(reason);
    expect(saveButton()).toHaveAccessibleDescription(reason);
  });

  /* 005 FR-038 — 처분 수량은 남은 수량 전부로 고정한다(입력 없음). 옛 「남은 수량 초과 예고」 두 시험은 칸과 함께 없어졌다. */
  it('모든 유형이 같은 이유로 막히면 이유를 한 번만 보인다(#275)', () => {
    const closed = t.form.typeLock.closed;
    renderPane({
      dispositionOptions: [
        { value: 'NORMAL', label: '정상', lockReason: closed },
        { value: 'SCRAP', label: '폐기', lockReason: closed },
      ],
      concession: { lockReason: closed, onRequest: () => undefined },
    });
    const visible = screen
      .getAllByText(closed)
      .filter((node) => !node.classList.contains('visually-hidden'));
    expect(visible).toHaveLength(1);
    expect(screen.getByRole('radio', { name: '정상' })).toHaveAccessibleDescription(closed);
    /* 고를 유형이 없으면 저장 · 사유 입력도 잠그고 그 이유를 잇는다. */
    const save = screen.getByRole('button', { name: t.actions.save });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(closed);
    expect(screen.getByRole('textbox', { name: t.form.reasonLabel })).toBeDisabled();
  });

  it('일부 유형만 막히면 유형 이름과 이유를 함께 보인다(#275)', () => {
    renderPane({
      dispositionOptions: [
        { value: 'NORMAL', label: '정상' },
        { value: 'SORT', label: '선별', lockReason: t.form.typeLock.sortSingleLot },
      ],
    });
    expect(screen.getByText(`선별: ${t.form.typeLock.sortSingleLot}`)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '선별' })).toHaveAccessibleDescription(
      t.form.typeLock.sortSingleLot,
    );
  });

  it('처분 수량은 남은 수량 전부를 읽기 전용으로 보인다 — 입력하지 않는다', () => {
    renderPane({ remainingQty: 320 });

    /* 입력칸이 아니라 글이다(#275). */
    expect(screen.getByLabelText(t.form.qtyLabel)).toHaveTextContent('320 EA');
    expect(screen.queryByRole('textbox', { name: t.form.qtyLabel })).toBeNull();
  });

  it('저장 중에는 저장·취소를 함께 잠근다 — 두 번 보내지 않게 한다', () => {
    renderPane({ isSaving: true, canCancel: true, lockReason: t.form.savingReason });

    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.cancel })).toBeDisabled();
  });

  it('고른 유형을 한 번 더 누르면 선택을 푼다(#352) — 안 고른 유형은 그대로 고른다', async () => {
    const options = [
      { value: 'SCRAP', label: '폐기' },
      { value: 'SORT', label: '선별' },
    ];
    const { props, user } = renderPane({
      dispositionOptions: options,
      value: { ...EMPTY_DECISION_FORM, dispositionTypeCode: 'SCRAP' },
    });
    const onChange = vi.mocked(props.onChange);

    await user.click(screen.getByRole('radio', { name: '폐기' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ dispositionTypeCode: '' }));

    onChange.mockClear();
    await user.click(screen.getByText('선별'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dispositionTypeCode: 'SORT' }),
    );
  });

  it('고른 유형으로 저장하면 생기는 일을 취소 왼쪽 안내 라벨로 보인다(#352)', () => {
    renderPane({
      dispositionOptions: [{ value: 'SCRAP', label: '폐기' }],
      value: { ...EMPTY_DECISION_FORM, dispositionTypeCode: 'SCRAP' },
      lots: [
        { lotId: 1, lotNoText: 'L1' },
        { lotId: 2, lotNoText: 'L2' },
      ] as unknown as DecisionFormPaneProps['lots'],
    });
    const note = screen.getByText('저장하면 자재 관리 LOT 2개에 모두 ‘폐기’ 판정이 적용됩니다.');
    expect(note).toHaveAttribute('data-tone', 'info');
    expect(note.nextElementSibling).toBe(screen.getByRole('button', { name: t.actions.cancel }));
  });

  it('입력이 없으면 취소를 잠근다', () => {
    renderPane({ canCancel: false });

    expect(screen.getByRole('button', { name: t.actions.cancel })).toBeDisabled();
  });

  it('처분을 고르면 값만 바꿔 알린다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('radio', { name: CODE }));

    expect(props.onChange).toHaveBeenCalledWith({
      ...EMPTY_DECISION_FORM,
      dispositionTypeCode: CODE,
    });
  });

  it('⭐ 적용 여부를 모르는 저장에는 빠져나갈 길을 함께 낸다', async () => {
    const { props, user } = renderPane({
      lockReason: t.form.uncertainReason,
      isUncertain: true,
    });

    await user.click(screen.getByRole('button', { name: t.form.checkOutcome }));

    expect(props.onCheckOutcome).toHaveBeenCalledOnce();
  });

  it('그 밖의 잠금에는 확인 액션을 내지 않는다 — 확인할 것이 없다', () => {
    renderPane({ lockReason: t.form.forbiddenReason, isUncertain: false });

    expect(screen.queryByRole('button', { name: t.form.checkOutcome })).toBeNull();
  });

  it('오류 문구를 입력칸에 붙인다', () => {
    renderPane({
      errors: { reason: t.form.reasonRequired, decisionQty: t.form.remainingUnknown },
    });

    expect(screen.getByText(t.form.reasonRequired)).toBeInTheDocument();
    expect(screen.getByText(t.form.remainingUnknown)).toBeInTheDocument();
  });
});
