import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inboundReceipt, inboundReceiptLine, inboundReceiptLineFixtures } from './fixtures';
import { buildIrLineColumns, IrLineTable, type IrLineTableProps } from './ir-line-table';
import type { ReferenceSource } from './lookups';
import type { IrLineView } from './types';

const t = messages.goodsReceipt;

/** `.wide-table`이 표에 주는 최소 폭(58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<IrLineView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const source = (entries: ReferenceSource['entries'] = []): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
});

const itemSource = source([
  { value: '9301', label: 'SAMPLE-ITEM-01 · 합성 품목 가', isActive: true },
]);
const uomSource = source([{ value: '9501', label: 'SAMPLE-EA · 합성 단위 개', isActive: true }]);
const lotSource = source([
  { value: '9601', label: 'LOT-2026-900010', isActive: true },
  { value: '9602', label: 'LOT-2026-900011', isActive: true },
]);
const plantSource = source([
  { value: '9201', label: 'SAMPLE-PLT-01 · 합성 공장 가', isActive: true },
]);

const columns = (): Column<IrLineView>[] =>
  buildIrLineColumns({
    selectedLineId: null,
    itemLookup: itemSource,
    uomLookup: uomSource,
    lotLookup: lotSource,
    reasonIdPrefix: 'reason',
    onToggleSelect: () => undefined,
  });

const renderTable = (overrides: Partial<IrLineTableProps> = {}) => {
  const onToggleSelect = vi.fn<(inboundReceiptLineId: number) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <IrLineTable
      inboundReceipt={inboundReceipt()}
      supplierName="SAMPLE-SUP-01 · 합성 공급사 가"
      rows={inboundReceiptLineFixtures}
      isLoading={false}
      plantLookup={plantSource}
      itemLookup={itemSource}
      uomLookup={uomSource}
      lotLookup={lotSource}
      selectedLineId={null}
      selectedLine={null}
      onToggleSelect={onToggleSelect}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onToggleSelect, onRetryReferences, user: userEvent.setup() };
};

describe('buildIrLineColumns — 열 구성과 폭', () => {
  it('열이 여섯이고 단위 열이 따로 없다', () => {
    expect(columns().map((column) => column.key)).toEqual([
      'lineNo',
      'item',
      'receivedQty',
      'lot',
      'expiryDate',
      'select',
    ]);
  });

  /* **M42** — 흡수 열이 둘이 되거나 사라지면 표가 짓눌리거나 늘 가로로 넘친다. */
  it('폭을 지정하지 않은 흡수 열이 정확히 하나다', () => {
    const absorbing = columns().filter((column) => column.width === undefined);

    expect(absorbing).toHaveLength(1);
    expect(absorbing[0]?.key).toBe('item');
  });

  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    const specified = specifiedWidthOf(columns());

    expect(specified).toBe(624);
    expect(specified + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(WIDE_TABLE_MIN_PX);
    expect(WIDE_TABLE_MIN_PX - specified).toBeGreaterThanOrEqual(CODE_NAME_COLUMN_PX);
  });
});

describe('IrLineTable — 고른 전표의 제목줄', () => {
  it('목록 응답에 없는 값(공장)까지 제목줄에서 보인다', () => {
    renderTable();

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(within(summary).getByText('IR-2026-900001')).toBeInTheDocument();
    expect(within(summary).getByText('SAMPLE-PLT-01 · 합성 공장 가')).toBeInTheDocument();
    expect(within(summary).getByText('2026-08-06 09:12')).toBeInTheDocument();
  });

  it('거래명세서번호가 없으면 빈 값 표기를 낸다', () => {
    renderTable({ inboundReceipt: inboundReceipt({ deliveryNoteNo: null }) });

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(within(summary).getByText(t.values.empty)).toBeInTheDocument();
  });
});

describe('IrLineTable — 라인 표', () => {
  it('품목·수량·단위·자재 LOT·유효기한이 보인다', () => {
    renderTable({ rows: [inboundReceiptLine()] });

    const table = screen.getByRole('table');

    expect(within(table).getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(
      within(table).getByText(t.lineTable.receivedQtyPair(100, 'SAMPLE-EA · 합성 단위 개')),
    ).toBeInTheDocument();
    expect(within(table).getByText('LOT-2026-900010')).toBeInTheDocument();
    expect(within(table).getByText('2027-08-06')).toBeInTheDocument();
  });

  /*
   * **M12** — 계약이 입고 라인의 `lotId`를 필수로 두는데 이 줄에는 값이 없다.
   * 판정을 없애면 보낼 수 없는 줄을 고를 수 있게 된다.
   */
  it('자재 LOT이 없는 줄은 고를 수 없고 사유가 버튼에 이어진다', () => {
    renderTable({ rows: [inboundReceiptLine({ lotId: null })] });

    const button = screen.getByRole('button', { name: t.actions.selectLine(1) });
    const reason = screen.getByText(t.reasons.lineNoLot);

    expect(button).toBeDisabled();
    /* 사유는 감추지 않고 항상 보이는 DOM 텍스트로 두고 `aria-describedby`로 잇는다(규범 4-1). */
    expect(button.getAttribute('aria-describedby')).toBe(reason.getAttribute('id'));
  });

  /* **M13** — 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. */
  it('입하 수량이 0인 줄은 고를 수 없고 다른 사유가 붙는다', () => {
    renderTable({ rows: [inboundReceiptLine({ receivedQty: 0 })] });

    expect(screen.getByRole('button', { name: t.actions.selectLine(1) })).toBeDisabled();
    expect(screen.getByText(t.reasons.lineQtyNotPositive)).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.lineNoLot)).not.toBeInTheDocument();
  });

  /*
   * **`lotId`가 없는 것을 「알 수 없음」으로 내지 않는다.** 없는 것은 사실이고
   * 「알 수 없음」은 *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다.
   */
  it('자재 LOT이 없는 칸은 알 수 없음이 아니라 빈 값 표기다', () => {
    renderTable({ rows: [inboundReceiptLine({ lotId: null })] });

    const table = screen.getByRole('table');

    expect(within(table).getByText(t.values.empty)).toBeInTheDocument();
    expect(within(table).queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  /* 목록에 없는 LOT 번호는 「알 수 없음」이 맞다 — 값은 있는데 이름을 못 찾은 것이다. */
  it('참조 목록에 없는 자재 LOT은 알 수 없음이다', () => {
    renderTable({ rows: [inboundReceiptLine({ lotId: 9603 })] });

    const table = screen.getByRole('table');

    expect(within(table).getByText(t.values.unknown)).toBeInTheDocument();
    expect(table.textContent ?? '').not.toContain('9603');
  });

  it('고를 수 있는 줄을 누르면 그 줄을 알린다', async () => {
    const { onToggleSelect, user } = renderTable();

    await user.click(screen.getByRole('button', { name: t.actions.selectLine(1) }));

    expect(onToggleSelect).toHaveBeenCalledWith(9401);
  });

  it('고른 줄의 버튼은 해제로 바뀐다', () => {
    renderTable({ selectedLineId: 9401 });

    expect(
      screen.getByRole('button', { name: t.actions.deselectLine(1) }),
    ).toBeInTheDocument();
  });

  /* 한 줄만 고른다는 사실을 밝히지 않으면 앞 선택이 풀리는 것이 고장으로 읽힌다. */
  it('한 줄만 고를 수 있다는 안내가 있다', () => {
    renderTable();

    expect(screen.getByText(t.notes.singleLineSelect)).toBeInTheDocument();
  });

  it('라인이 없으면 빈 상태를 낸다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  it('불러오는 중에는 골격을 내고 표를 그리지 않는다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.lines })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('IrLineTable — 고른 라인의 제목줄', () => {
  /* 고르지 않았으면 제목줄 자체가 없다 — 닿을 수 없는 가지를 만들지 않는다. */
  it('고르지 않았으면 그리지 않는다', () => {
    renderTable();

    expect(screen.queryByRole('group', { name: t.lineSummary.label })).not.toBeInTheDocument();
  });

  /* 수입검사 대상과 상태는 **열이 아니라 여기서만** 보인다(계획 §5.5). */
  it('고른 줄의 수입검사 대상과 상태가 보인다', () => {
    renderTable({ selectedLineId: 9401, selectedLine: inboundReceiptLine() });

    const summary = screen.getByRole('group', { name: t.lineSummary.label });

    expect(within(summary).getByText(t.lineSummary.inspectionYes)).toBeInTheDocument();
    expect(within(summary).getByText('SAMPLE_IR_LINE_STATUS_A')).toBeInTheDocument();
  });

  it('수입검사 대상이 아니면 그 사실을 낸다', () => {
    renderTable({
      selectedLineId: 9402,
      selectedLine: inboundReceiptLine({ inspectionRequired: false }),
    });

    const summary = screen.getByRole('group', { name: t.lineSummary.label });

    expect(within(summary).getByText(t.lineSummary.inspectionNo)).toBeInTheDocument();
  });

  it('고른 줄에도 내부 번호를 내지 않는다', () => {
    renderTable({ selectedLineId: 9401, selectedLine: inboundReceiptLine() });

    const summary = screen.getByRole('group', { name: t.lineSummary.label });

    // 짝 방향 — 줄번호와 이름은 보인다.
    expect(within(summary).getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(summary.textContent ?? '').not.toContain('9401');
    expect(summary.textContent ?? '').not.toContain('9301');
  });
});

describe('IrLineTable — 참조 실패', () => {
  it.each([
    ['품목', { itemLookup: { ...itemSource, isError: true } }],
    ['단위', { uomLookup: { ...uomSource, isError: true } }],
    ['자재 LOT', { lotLookup: { ...lotSource, isError: true } }],
    ['공장', { plantLookup: { ...plantSource, isError: true } }],
  ])('%s 참조가 실패하면 안내와 다시 시도를 낸다', async (_label, overrides) => {
    const { onRetryReferences, user } = renderTable(overrides);

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('참조가 정상이면 다시 시도를 내지 않는다', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
