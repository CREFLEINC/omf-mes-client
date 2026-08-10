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
  truncated: false,
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

  /*
   * **R-3** — 사유가 서로 다른 두 줄이 한 표에 있는 것이 이 화면의 **정상 경로**다.
   * 막힌 줄이 하나뿐인 표에서는 상수 `id`도 정답과 구분되지 않아, 연결이 어긋나 있어도
   * 드러나지 않는다. 어긋나면 수량 0인 줄이 스크린리더에서 **「자재 LOT이 없다」**로 읽혀,
   * `line-select.ts`가 판정 **순서**까지 정해 막으려 한 바로 그 오해가 되살아난다.
   */
  it('막힌 줄이 둘이면 각 버튼이 자기 줄의 사유를 가리킨다', () => {
    renderTable({
      rows: [
        inboundReceiptLine({ inboundReceiptLineId: 9403, lineNo: 1, lotId: null }),
        inboundReceiptLine({ inboundReceiptLineId: 9404, lineNo: 2, receivedQty: 0 }),
      ],
    });

    expect(screen.getByRole('button', { name: t.actions.selectLine(1) })).toHaveAccessibleDescription(
      t.reasons.lineNoLot,
    );
    expect(screen.getByRole('button', { name: t.actions.selectLine(2) })).toHaveAccessibleDescription(
      t.reasons.lineQtyNotPositive,
    );
  });

  /* 사유 `id`가 줄마다 달라야 한다 — 같으면 HTML도 어긋나고 연결도 뒤섞인다. */
  it('막힌 줄마다 사유 id가 다르다', () => {
    renderTable({
      rows: [
        inboundReceiptLine({ inboundReceiptLineId: 9403, lineNo: 1, lotId: null }),
        inboundReceiptLine({ inboundReceiptLineId: 9404, lineNo: 2, receivedQty: 0 }),
      ],
    });

    const ids = [1, 2].map((lineNo) =>
      screen.getByRole('button', { name: t.actions.selectLine(lineNo) }).getAttribute('aria-describedby'),
    );

    expect(ids[0]).not.toBeNull();
    expect(new Set(ids).size).toBe(2);
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

describe('IrLineTable — 참조 잘림', () => {
  /*
   * **R-1** — 잘린 목록으로 이름을 풀면 그 뒤의 정상 값이 「알 수 없음」으로 찍히는데,
   * 이 화면은 그 문구를 「값이 잘못됐다는 신호」로 정의해 두었다. 밝히지 않으면 사용자가
   * 정상 값을 잘못된 값으로 읽는다. **자재 LOT은 다섯 중 유일한 거래 기록이라 가장 잘리기 쉽다.**
   */
  it.each([
    ['자재 LOT', { lotLookup: { ...lotSource, truncated: true } }],
    ['품목', { itemLookup: { ...itemSource, truncated: true } }],
    ['단위', { uomLookup: { ...uomSource, truncated: true } }],
    ['공장', { plantLookup: { ...plantSource, truncated: true } }],
  ])('%s 목록이 잘리면 그 사실을 밝힌다', (_label, overrides) => {
    renderTable(overrides);

    expect(screen.getByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
  });

  /* 짝 방향 — 잘리지 않으면 내지 않는다. 늘 뜨는 안내는 읽히지 않는다. */
  it('잘리지 않으면 안내를 내지 않는다', () => {
    renderTable();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.lineReferencesTruncated)).not.toBeInTheDocument();
  });

  /* 잘림과 실패는 사용자가 할 조치가 다르다 — 잘림에는 「다시 시도」가 붙지 않는다. */
  it('잘림 안내에는 다시 시도를 붙이지 않는다', () => {
    renderTable({ lotLookup: { ...lotSource, truncated: true } });

    expect(screen.getByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* 둘이 함께 참인 순간이 실제로 있다 — 잘린 목록을 받은 뒤 다시 부르기가 실패한 경우다. */
  it('잘림과 실패가 함께 참이면 둘 다 낸다', () => {
    renderTable({ lotLookup: { ...lotSource, truncated: true, isError: true } });

    expect(screen.getByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();
  });
});
