import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inboundReceiptNoLineFixtures, inboundReceiptResponse, sourceLineView } from './fixtures';
import type { ReferenceSource } from './lookups';
import { SourceReceiptPane, type SourceReceiptPaneProps } from './source-receipt-pane';
import { toSourceReceiptView } from './types';

const t = messages.poRegister;

/**
 * 넘어온 초과분 구획 — **읽기 전용 표시와 대상 선택만 하는 자리**다.
 *
 * 화면 시험이 닿지 않는 표시 경로를 여기서 잰다 — 라인 0행의 빈 상태, 2행 이상일 때의 승계 안내,
 * 참조 실패의 복구 수단이 **다섯 중 어느 하나만 실패해도** 서는지.
 */

const named = (value: string, label: string): ReferenceSource => ({
  entries: [{ value, label, isActive: true }],
  isError: false,
  isLoading: false,
});

const failed: ReferenceSource = { entries: [], isError: true, isLoading: false };

/**
 * 두 줄. 둘째 줄의 품목은 **참조 목록에 없다**(픽스처와 같은 뜻) —
 * 「목록에 없음」 갈래가 실제 값으로 렌더되는지 함께 재려는 값이다.
 */
const TWO_LINES = [
  sourceLineView(),
  sourceLineView({ inboundReceiptLineId: 9112, lineNo: 2, itemId: 9502, receivedQty: 4 }),
];

const baseProps = (overrides: Partial<SourceReceiptPaneProps> = {}): SourceReceiptPaneProps => ({
  receipt: toSourceReceiptView(inboundReceiptResponse()),
  lines: TWO_LINES,
  chosenLineId: null,
  supplierLookup: named('9301', 'SAMPLE-SUP-01 · 합성 공급사 가'),
  businessUnitLookup: named('9201', 'SAMPLE-BU-01 · 합성 사업부 가'),
  plantLookup: named('9401', 'SAMPLE-PLT-01 · 합성 공장 가'),
  itemLookup: named('9501', 'SAMPLE-ITEM-01 · 합성 품목 가'),
  uomLookup: named('9601', 'SAMPLE-EA · 합성 단위 개'),
  onChoose: vi.fn(),
  onRetryReferences: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<SourceReceiptPaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<SourceReceiptPane {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

const lineRows = (): HTMLElement[] =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('SourceReceiptPane — 읽기 전용 표시', () => {
  it('입하번호·이름·상태를 보이고 값을 고칠 칸을 두지 않는다', () => {
    renderPane();

    expect(screen.getByText('SAMPLE-IR-9101')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-SUP-01 · 합성 공급사 가')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-PLT-01 · 합성 공장 가')).toBeInTheDocument();
    /* 서버가 준 상태 코드를 그대로 보인다(공유계약 G-2). */
    expect(screen.getByText('SAMPLE_IR_STATUS_A')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('이름이 아직 오지 않으면 번호를 대신 내지 않는다', () => {
    renderPane({
      supplierLookup: { entries: [], isError: false, isLoading: true },
    });

    expect(screen.getByText(t.values.referenceLoading)).toBeInTheDocument();
    expect(screen.queryByText('9301')).not.toBeInTheDocument();
  });
});

describe('SourceReceiptPane — 대상 선택', () => {
  it('두 줄 이상이면 줄마다 고르는 버튼과 승계 안내가 선다', () => {
    renderPane();

    expect(screen.getByText(t.source.inheritNote)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.source.chooseRow(1) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.source.chooseRow(2) })).toBeInTheDocument();
    expect(screen.queryByText(t.source.singleLineNote)).not.toBeInTheDocument();
  });

  it('고른 줄은 버튼 대신 표식을 갖는다 — 다시 누를 뜻이 없다', () => {
    renderPane({ chosenLineId: 9111 });

    expect(within(lineRows()[0] as HTMLElement).getByText(t.source.chosen)).toBeInTheDocument();
    expect(
      within(lineRows()[1] as HTMLElement).getByRole('button', { name: t.source.chooseRow(2) }),
    ).toBeInTheDocument();
  });

  it('한 줄뿐이면 고르는 버튼 없이 확정 사실을 말한다', () => {
    renderPane({ lines: [sourceLineView()] });

    expect(screen.getByText(t.source.singleLineNote)).toBeInTheDocument();
    expect(screen.getByText(t.source.chosen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.source.chooseRow(1) })).not.toBeInTheDocument();
  });

  it('고른 줄의 번호를 그대로 올린다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.source.chooseRow(2) }));

    expect(props.onChoose).toHaveBeenCalledWith(9112);
  });
});

/**
 * **라인 0행 갈래**(리뷰 R-1이 가리킨 자리).
 *
 * 이 구획이 그 빈 상태를 일부러 만들었으므로 갈래는 도달 가능하다 — 문구가 서는지 재지 않으면
 * 그 갈래에서 화면이 무엇을 말하는지 아무도 모른다.
 */
describe('SourceReceiptPane — 라인이 0행일 때', () => {
  it('승계할 줄이 없다는 사실과 다음 조치를 함께 말한다', () => {
    renderPane({ lines: inboundReceiptNoLineFixtures });

    expect(screen.getByText(t.empty.noSourceLinesTitle)).toBeInTheDocument();
    expect(screen.getByText(t.empty.noSourceLinesDescription)).toBeInTheDocument();
    /* 고를 것이 없으므로 고르기 안내를 내지 않는다. */
    expect(screen.queryByText(t.source.inheritNote)).not.toBeInTheDocument();
    expect(screen.queryByText(t.source.singleLineNote)).not.toBeInTheDocument();
  });
});

/**
 * **참조 실패의 복구 수단**(리뷰 R-2).
 *
 * 안내 문구가 다섯을 말하므로 **다섯 중 어느 하나만 실패해도** 복구 버튼이 서야 한다.
 * 사업부는 이 구획에 이름이 보이지 않아 가장 빠뜨리기 쉬운 자리다 — 그래서 다섯을 각각 잰다.
 */
describe('SourceReceiptPane — 참조 실패', () => {
  it.each([
    ['supplierLookup' as const],
    ['businessUnitLookup' as const],
    ['plantLookup' as const],
    ['itemLookup' as const],
    ['uomLookup' as const],
  ])('%s 하나만 실패해도 복구 수단이 선다', (key) => {
    renderPane({ [key]: failed });

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('다섯이 모두 정상이면 복구 수단을 내지 않는다', () => {
    renderPane();

    // 짝 방향 — 이름은 실제로 풀린다(아무것도 안 그려도 통과하지 않게 한다).
    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    /* 목록에 없는 값은 「알 수 없음」이다 — 실패와 갈리고 번호를 대신 내지 않는다. */
    expect(screen.getByText(t.values.unknown)).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.referencesFailed)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('복구를 누르면 다섯을 함께 되살리라고 올린다', async () => {
    const { props, user } = renderPane({ businessUnitLookup: failed });

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(props.onRetryReferences).toHaveBeenCalledTimes(1);
  });
});
