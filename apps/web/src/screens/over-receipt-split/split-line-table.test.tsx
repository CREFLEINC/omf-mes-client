import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LABEL_9301, purchaseOrder, purchaseOrderLineFixtures } from './fixtures';
import {
  createDrafts,
  setDraftLot,
  setDraftQty,
  type LineDrafts,
  type LotDraft,
} from './line-draft';
import type { ItemDetail, ItemNameLookup, ReferenceSource, ReferenceState } from './lookups';
import { toSplitLines, type SplitLineView } from './split-calc';
import {
  buildSplitLineColumns,
  SplitLineTable,
  toLineTableRows,
  type LineTableRow,
  type SplitLineTableProps,
} from './split-line-table';

const t = messages.overReceiptSplit;

/** `.ors-lines table { min-width: 62rem }` — 흡수 열(품목명)이 접히지 않는 하한이다. */
const TABLE_MIN_PX = 992;
const ITEM_NAME_COLUMN_PX = 160;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<LineTableRow>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const source = (
  values: [number, string][],
  overrides: Partial<ReferenceSource> = {},
): ReferenceSource => ({
  entries: values.map(([id, label]) => ({ value: String(id), label, isActive: true })),
  isError: false,
  isLoading: false,
  ...overrides,
});

const itemNames = (
  states: Record<number, ReferenceState>,
  details: Record<number, ItemDetail> = {},
  overrides: Partial<ItemNameLookup> = {},
): ItemNameLookup => ({
  of: (itemId) => states[itemId] ?? { kind: 'loading' },
  detail: (itemId) => details[itemId] ?? null,
  isError: false,
  refetch: () => undefined,
  ...overrides,
});

const ITEM_9301: ItemDetail = {
  itemCode: 'SAMPLE-ITEM-01',
  itemName: '합성 품목 가',
  inspectionRequired: true,
};
const ITEMS = itemNames(
  { 9301: { kind: 'named', label: 'SAMPLE-ITEM-01 · 합성 품목 가' }, 9302: { kind: 'loading' } },
  { 9301: ITEM_9301 },
);
const UOMS = source([[9501, 'SAMPLE-EA · 합성 단위 개']]);
const PLANTS = source([[9201, 'SAMPLE-PLT-01 · 합성 공장 가']]);
const LOT_REASONS = [
  { value: 'NO_LABEL', label: '라벨 없음' },
  { value: 'OTHER', label: '기타' },
];

const columnsWith = (names: ItemNameLookup = ITEMS): Column<LineTableRow>[] =>
  buildSplitLineColumns({
    itemNames: names,
    uomLookup: UOMS,
    lotReasonOptions: LOT_REASONS,
    isLocked: false,
    onChangeQty: () => undefined,
    onChangeLot: () => undefined,
  });

const draftsWith = (
  texts: Record<number, string> = {},
  lots: Record<number, Partial<LotDraft>> = {},
): LineDrafts =>
  Object.entries(lots).reduce<LineDrafts>(
    (acc, [lineId, patch]) => setDraftLot(acc, Number(lineId), patch),
    Object.entries(texts).reduce<LineDrafts>(
      (acc, [lineId, text]) => setDraftQty(acc, Number(lineId), text),
      createDrafts(purchaseOrderLineFixtures),
    ),
  );

const rowsWith = (
  texts: Record<number, string> = {},
  lots: Record<number, Partial<LotDraft>> = {},
): SplitLineView[] =>
  toSplitLines(purchaseOrderLineFixtures, draftsWith(texts, lots), (itemId) =>
    itemId === 9301 ? 'SAMPLE-ITEM-01' : null,
  );

const renderTable = (overrides: Partial<SplitLineTableProps> = {}) => {
  const onChangeQty = vi.fn<(purchaseOrderLineId: number, text: string) => void>();
  const onChangeLot = vi.fn<(purchaseOrderLineId: number, patch: Partial<LotDraft>) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <SplitLineTable
      purchaseOrder={purchaseOrder()}
      supplierName="SAMPLE-SUP-01 · 합성 공급사 가"
      rows={rowsWith()}
      isLoading={false}
      plantLookup={PLANTS}
      itemNames={ITEMS}
      uomLookup={UOMS}
      lotReasonOptions={LOT_REASONS}
      isLocked={false}
      onChangeQty={onChangeQty}
      onChangeLot={onChangeLot}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onChangeQty, onChangeLot, onRetryReferences, user: userEvent.setup() };
};

const table = (): HTMLElement => screen.getByRole('table');

const bodyRows = (): HTMLElement[] => within(table()).getAllByRole('row').slice(1);

const cellsOf = (row: HTMLElement): string[] =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');

const qtyInput = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.arrivedQtyLabel(lineNo));

describe('buildSplitLineColumns — 열 구성과 폭', () => {
  it('수량은 열마다 따로 선다', () => {
    expect(columnsWith().map((column) => column.key)).toEqual([
      'lineNo',
      'itemCode',
      'itemName',
      'ordered',
      'received',
      'remaining',
      'arrivedQty',
      'uom',
      'normal',
      'excess',
    ]);
  });

  /* 흡수 열이 둘이 되면 남는 폭이 나뉘어 긴 이름이 낱말 단위로 쪼개진다. */
  it('폭을 지정하지 않은 흡수 열이 정확히 하나다', () => {
    expect(
      columnsWith()
        .filter((column) => column.width === undefined)
        .map((c) => c.key),
    ).toEqual(['itemName']);
  });

  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    expect(specifiedWidthOf(columnsWith()) + ITEM_NAME_COLUMN_PX).toBeLessThanOrEqual(TABLE_MIN_PX);
  });
});

describe('toLineTableRows — LOT 줄은 수량을 넣은 뒤에만 선다', () => {
  it('수량이 없으면 발주 라인 줄만 있다', () => {
    expect(toLineTableRows(rowsWith()).map((row) => row.kind)).toEqual(['line', 'line', 'line']);
  });

  /* 줄 하나에 LOT 하나다(서버 장부 P-100) — 초과 몫이 있어도 LOT 줄은 하나다. */
  it('수량을 넣은 줄 아래에 LOT 줄이 하나씩 선다 — 초과 몫이 있어도 하나다', () => {
    const rows = toLineTableRows(rowsWith({ 9401: '66', 9403: '2' }));

    expect(rows.map((row) => row.kind)).toEqual(['line', 'lot', 'line', 'line', 'lot']);
  });
});

describe('SplitLineTable — 발주 라인의 수치', () => {
  it('발주 · 기입하 · 잔량 (+허용) 이 열마다 보인다', () => {
    renderTable();

    expect(cellsOf(bodyRows()[0] as HTMLElement).slice(3, 6)).toEqual(['100', '40', '60 (+5)']);
  });

  /*
   * 누적 입하가 발주를 넘긴 줄이다 — 잔량을 음수로 그리면 사용자가 뜻을 알 수 없다. 괄호 안은 **남은 허용치**다 —
   * 허용 5 중 2 를 이미 받았으니 3 이다(서버 한도 `발주 + 허용 − 누적`과 같다).
   */
  it('누적 입하가 발주를 넘긴 줄의 잔량은 0, 허용은 남은 몫만 보인다', () => {
    renderTable();

    expect(cellsOf(bodyRows()[2] as HTMLElement).slice(3, 6)).toEqual(['30', '32', '0 (+3)']);
  });

  it('천 단위를 구분한다', () => {
    renderTable({
      rows: toSplitLines(
        [{ ...purchaseOrderLineFixtures[0], orderedQty: 5000 } as never],
        createDrafts(purchaseOrderLineFixtures),
      ),
    });

    expect(cellsOf(bodyRows()[0] as HTMLElement)[3]).toBe('5,000');
  });

  it('품목은 코드와 이름 열로 나뉘고, 상세가 아직이면 코드 자리에 사정을 낸다', () => {
    renderTable();

    const first = cellsOf(bodyRows()[0] as HTMLElement);
    expect(first[1]).toBe('SAMPLE-ITEM-01');
    expect(first[2]).toContain('합성 품목 가');
    expect(cellsOf(bodyRows()[1] as HTMLElement)[1]).toBe(t.values.referenceLoading);
    expect(within(table()).queryByText('9302')).not.toBeInTheDocument();
  });

  /* 수입검사 대상은 서버가 품목 기준정보로 정한다 — 표식만 보인다. */
  it('수입검사 대상 품목에 IQC 표식이 붙는다', () => {
    renderTable();

    expect(within(bodyRows()[0] as HTMLElement).getByText(t.lineTable.iqc)).toBeInTheDocument();
    expect(
      within(bodyRows()[1] as HTMLElement).queryByText(t.lineTable.iqc),
    ).not.toBeInTheDocument();
  });

  it('단위는 제 열에 선다', () => {
    renderTable();

    expect(cellsOf(bodyRows()[0] as HTMLElement)[7]).toBe('SAMPLE-EA · 합성 단위 개');
  });
});

describe('SplitLineTable — 표 안의 도착 수량 입력칸', () => {
  it('줄마다 입력칸이 하나씩 있고 접근 이름이 줄번호로 갈린다', () => {
    renderTable();

    expect(qtyInput(1)).toBeInTheDocument();
    expect(qtyInput(2)).toBeInTheDocument();
    expect(qtyInput(3)).toBeInTheDocument();
  });

  it('치면 그 줄의 발주 라인 번호와 친 글자를 넘긴다', async () => {
    const { onChangeQty, user } = renderTable();

    await user.type(qtyInput(1), '6');

    expect(onChangeQty).toHaveBeenCalledWith(9401, '6');
  });

  it('초안에 든 값이 입력칸에 그대로 보인다', () => {
    renderTable({ rows: rowsWith({ 9401: '66' }) });

    expect(qtyInput(1)).toHaveValue(66);
  });

  it('입력칸의 접근 이름에 내부 번호가 없다', () => {
    renderTable();

    expect(qtyInput(1).getAttribute('aria-label') ?? '').not.toContain('9401');
  });

  it('보내는 중에는 입력칸이 잠긴다', () => {
    renderTable({ isLocked: true });

    expect(qtyInput(1)).toBeDisabled();
  });

  it('자릿수 경고를 입력칸 아래에 낸다', () => {
    renderTable({ rows: rowsWith({ 9401: '250' }) });

    expect(screen.getByText(t.warnings.qtyFarOverOrdered('2.5'))).toBeInTheDocument();
  });
});

describe('SplitLineTable — 발주 반영과 초과분', () => {
  const splitCells = (row: HTMLElement): string[] => cellsOf(row).slice(8, 10);

  it('두 몫의 머리글이 「발주 반영」·「초과분」이다', () => {
    renderTable();

    const headers = within(table())
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent ?? '');

    expect(headers.slice(8, 10)).toEqual([t.lineTable.normal, t.lineTable.excess]);
  });

  /* 한도(잔량 60 + 허용 5)와 꼭 같은 도착은 전부 P/O 에 넣는다. */
  it('한도와 같은 수량은 전부 발주 반영으로 보인다', () => {
    renderTable({ rows: rowsWith({ 9401: '65' }) });

    expect(splitCells(bodyRows()[0] as HTMLElement)).toEqual(['65', '0']);
  });

  it('한도를 넘으면 넘은 몫만 초과분으로 보이고 눈에 띄게 표시된다', () => {
    renderTable({ rows: rowsWith({ 9401: '66' }) });

    const line = bodyRows()[0] as HTMLElement;
    expect(splitCells(line)).toEqual(['65', '1']);
    expect(line.querySelector('[data-excess="true"]')).not.toBeNull();
  });

  /*
   * 잔량도 허용치도 없는 줄이다 — 넣은 수량이 전부 초과 몫이라 서버가 받지 않는다. 몫은 그대로 보이고
   * 수량 칸에 사유가 붙는다.
   */
  it('다 받은 줄에 수량을 넣으면 전부 초과분으로 보이고 수량 칸에 사유가 붙는다', () => {
    renderTable({ rows: rowsWith({ 9402: '12' }) });

    const line = bodyRows().find((row) => cellsOf(row)[0] === '2') as HTMLElement;
    expect(splitCells(line)).toEqual(['0', '12']);
    expect(within(line).getByText(t.errors.qtyNoRoom)).toBeInTheDocument();
  });

  it('수량을 넣지 않은 줄은 가를 것이 없다고 낸다', () => {
    renderTable();

    expect(within(table()).getAllByText(t.values.notSplit)).toHaveLength(6);
  });

  it('잘못 친 수량은 사유가 붙고 갈리지 않는다', () => {
    renderTable({ rows: rowsWith({ 9401: '0' }) });

    expect(screen.getByText(t.errors.qtyNotPositive)).toBeInTheDocument();
    expect(within(table()).getAllByText(t.values.notSplit)).toHaveLength(6);
  });
});

describe('SplitLineTable — LOT 줄', () => {
  const lotInput = (lineNo: number): HTMLElement =>
    screen.getByLabelText(t.lineTable.lotNoLabel(lineNo));
  const missingBox = (lineNo: number): HTMLElement =>
    screen.getByLabelText(t.lineTable.lotMissingLabel(lineNo));

  /* 초과 몫이 있어도 LOT 은 하나다 — 「초과분 LOT」 줄이 따로 서지 않는다. */
  it('수량을 넣은 줄 아래에 공급사 LOT 줄 하나가 선다', () => {
    renderTable({ rows: rowsWith({ 9401: '66' }) });

    const rows = bodyRows();
    expect(rows).toHaveLength(4);
    expect(cellsOf(rows[1] as HTMLElement)[1]).toBe(t.lineTable.lotHead);
    expect(screen.getAllByLabelText(t.lineTable.lotNoLabel(1))).toHaveLength(1);
  });

  it('LOT 줄의 수량 칸은 비어 있다 — 몫은 발주 라인 줄이 말한다', () => {
    renderTable({ rows: rowsWith({ 9401: '66' }) });

    expect(cellsOf(bodyRows()[1] as HTMLElement).slice(8, 10)).toEqual(['', '']);
  });

  it('번호를 치면 그 줄로 올린다', async () => {
    const { onChangeLot, user } = renderTable({ rows: rowsWith({ 9401: '66' }) });

    await user.type(lotInput(1), 'L');

    expect(onChangeLot).toHaveBeenCalledWith(9401, { lotNo: 'L' });
  });

  it('「라벨 없음」을 켜면 올리고, 끄면 사유도 함께 비운다', async () => {
    const { onChangeLot, user } = renderTable({
      rows: rowsWith({ 9401: '10' }, { 9401: { labelMissing: true, reasonCode: 'OTHER' } }),
    });

    await user.click(missingBox(1));

    expect(onChangeLot).toHaveBeenCalledWith(9401, { labelMissing: false, reasonCode: '' });
  });

  it('라벨 없음이고 번호가 없을 때만 대체 사유 칸이 선다', () => {
    renderTable({ rows: rowsWith({ 9401: '10' }, { 9401: { labelMissing: true } }) });

    expect(
      screen.getByRole('combobox', { name: t.lineTable.lotReasonLabel(1) }),
    ).toBeInTheDocument();
  });

  it('번호를 받아 적었으면 사유 칸이 없다', () => {
    renderTable({
      rows: rowsWith({ 9401: '10' }, { 9401: { labelMissing: true, lotNo: 'DN-7' } }),
    });

    expect(
      screen.queryByRole('combobox', { name: t.lineTable.lotReasonLabel(1) }),
    ).not.toBeInTheDocument();
  });

  it('LOT 사유가 그 칸 아래에 붙는다', () => {
    renderTable({ rows: rowsWith({ 9401: '10' }) });

    expect(screen.getByText(t.errors.lotRequired)).toBeInTheDocument();
  });

  /* 수량을 치는 순간 LOT 칸이 붉어지면 아직 넣지도 않은 칸이 잘못된 것처럼 보인다. */
  it('등록을 누르기 전에는 LOT 사유를 붙이지 않는다', () => {
    renderTable({ rows: rowsWith({ 9401: '10' }), showLotErrors: false });

    expect(screen.queryByText(t.errors.lotRequired)).not.toBeInTheDocument();
    expect(lotInput(1)).toBeInTheDocument();
  });

  /* 「-OVER」 파생 번호도 「라벨 없음으로」 단추도 없다 — 초과 몫은 같은 LOT 이다. */
  it('초과 몫이 있어도 파생 번호나 「라벨 없음으로」 단추가 없다', () => {
    renderTable({ rows: rowsWith({ 9401: '66' }, { 9401: { lotNo: LABEL_9301 } }) });

    expect(lotInput(1)).toHaveValue(LABEL_9301);
    expect(screen.queryByDisplayValue(`${LABEL_9301}-OVER`)).not.toBeInTheDocument();
    expect(within(table()).queryAllByRole('button')).toHaveLength(0);
  });

  it('초안의 번호가 칸에 그대로 보인다', () => {
    renderTable({ rows: rowsWith({ 9401: '10' }, { 9401: { lotNo: LABEL_9301 } }) });

    expect(lotInput(1)).toHaveValue(LABEL_9301);
  });
});

describe('SplitLineTable — 고른 발주의 머리', () => {
  it('목록 표에 없는 공장까지 머리에서 보인다', () => {
    renderTable();

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(within(summary).getByText('PO-2026-900001')).toBeInTheDocument();
    expect(within(summary).getByText('SAMPLE-SUP-01 · 합성 공급사 가')).toBeInTheDocument();
    expect(within(summary).getByText('SAMPLE-PLT-01 · 합성 공장 가')).toBeInTheDocument();
  });

  it('머리에 내부 번호가 없다', () => {
    renderTable();

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(summary.textContent ?? '').not.toContain('9001');
    expect(summary.textContent ?? '').not.toContain('9201');
  });

  it('표 위 도구 자리를 그대로 그린다', () => {
    renderTable({ toolbar: <button type="button">합성 도구</button> });

    expect(screen.getByRole('button', { name: '합성 도구' })).toBeInTheDocument();
  });
});

describe('SplitLineTable — 라인이 없거나 참조가 실패한 경우', () => {
  it('라인이 하나도 없으면 그 사실을 밝힌다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  it('불러오는 중에는 빈 상태 문구를 내지 않는다', () => {
    renderTable({ rows: [], isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.lines })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noLinesTitle)).not.toBeInTheDocument();
  });

  it('셋 중 하나만 실패해도 안내와 복구 수단을 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      uomLookup: source([], { isError: true }),
    });

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('품목 이름 하나가 실패해도 안내와 복구 수단을 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      itemNames: itemNames({ 9301: { kind: 'failed' } }, {}, { isError: true }),
    });

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();
    expect(within(table()).getAllByText(t.values.referenceFailed).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('참조가 정상이면 복구 수단을 내지 않는다', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
