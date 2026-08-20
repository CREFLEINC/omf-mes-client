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
) => {
  const onChange = vi.fn();

  renderWithProviders(
    <ResultFormPane round={round} inspectedQty={inspectedQty} draft={draft} onChange={onChange} />,
  );

  return onChange;
};

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
    const onChange = renderPane();

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

  it('수량이 아닌 값을 조용히 무시하지 않는다', () => {
    renderPane({ ...EMPTY_QUANTITY_DRAFT, accepted: '-1' });

    expect(screen.getByText(t.quantityInvalid)).toBeInTheDocument();
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 잘못된 칸을 0으로 읽고 세면 화면이 오류와 「일치합니다」를
   * 동시에 내고, 그중 하나가 거짓이다.
   */
  it('한 칸이 수량이 아니면 일치한다고 말하지 않는다 — 셀 수 없는 것을 셌다고 하지 않는다', () => {
    renderPane({ accepted: 'abc', rejected: '500', held: '' });

    expect(screen.getByText(t.quantityInvalid)).toBeInTheDocument();
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

  it('저장 단추를 두지 않는다 — 검사자를 채울 수 없어 아직 쓸 수 없다', () => {
    renderPane();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
