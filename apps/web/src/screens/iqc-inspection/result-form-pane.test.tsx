import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { confirmedRound, draftRound } from './fixtures';
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

  renderWithProviders(
    <ResultFormPane
      round={round}
      inspectedQty={inspectedQty}
      draft={draft}
      onChange={onChange}
      onSave={onSave}
      isSaving={false}
      isSaved={false}
      fieldErrors={{}}
      saveError={null}
      onReload={vi.fn()}
      {...overrides}
    />,
  );

  return { onChange, onSave };
};

const saveButton = () => screen.getByRole('button', { name: t.save });

describe('ResultFormPane', () => {
  it('회차를 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.round(1))).toBeInTheDocument();
  });

  it('아직 회차가 없으면 시작 전임을 말한다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null);

    expect(screen.getByText(t.notStarted)).toBeInTheDocument();
  });

  it('세 칸을 손으로 넣는다 — 자동 계산을 만들지 않는다', async () => {
    const { onChange } = renderPane();

    await userEvent.type(screen.getByLabelText(t.fields.accepted), '4');

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_QUANTITY_DRAFT, accepted: '4' });
  });

  it('합계가 맞으면 일치한다고 말한다', () => {
    renderPane({ accepted: '480', rejected: '15', held: '5' });

    expect(screen.getByText(t.matched)).toBeInTheDocument();
  });

  it('모자라면 얼마나 모자란지 숫자로 말한다 — 사용자가 다시 세지 않게', () => {
    renderPane({ accepted: '400', rejected: '0', held: '0' });

    expect(screen.getByText(t.short('100'))).toBeInTheDocument();
  });

  it('넘기면 얼마나 넘겼는지 말한다 — 0으로 깎아 감추지 않는다', () => {
    renderPane({ accepted: '600', rejected: '0', held: '0' });

    expect(screen.getByText(t.over('100'))).toBeInTheDocument();
  });

  it('소수 합이 부동소수 오차로 어긋나지 않는다', () => {
    renderPane({ accepted: '0.1', rejected: '0.2', held: '0' }, null, 0.3);

    expect(screen.getByText(t.matched)).toBeInTheDocument();
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

    expect(screen.queryByText(t.matched)).not.toBeInTheDocument();
  });

  it('셀 수 없으면 합계·잔여도 숫자로 내지 않는다 — 0으로 읽은 합은 그 숫자가 거짓이다', () => {
    renderPane({ accepted: 'abc', rejected: '500', held: '' });

    expect(screen.getAllByText(messages.iqcInspection.queue.emptyValue)).toHaveLength(2);
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

  it('저장하면 결과를 알린다 — 눌렀는데 아무 일도 없어 보이지 않게', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, { isSaved: true });

    expect(screen.getByText(t.saved)).toBeInTheDocument();
  });

  it('서버가 칸을 짚어 주면 그 칸에 낸다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, null, 500, {
      fieldErrors: { acceptedQty: '합격수량이 검사수량을 넘습니다.' },
    });

    expect(screen.getByText('합격수량이 검사수량을 넘습니다.')).toBeInTheDocument();
  });

  it('확정된 회차에는 저장 자리를 만들지 않는다 — 눌러도 아무 일이 없는 컨트롤을 두지 않는다', () => {
    renderPane(EMPTY_QUANTITY_DRAFT, toInspectionResultRound(confirmedRound));

    expect(screen.queryByRole('button', { name: t.save })).not.toBeInTheDocument();
  });
});
