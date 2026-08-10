import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { purchaseOrder, purchaseOrderLineFixtures } from './fixtures';
import { createDrafts, setDraftQty, type LineDrafts } from './line-draft';
import type { ReferenceSource } from './lookups';
import { toSplitLines, type SplitLineView } from './split-calc';
import {
  buildSplitLineColumns,
  SplitLineTable,
  type SplitLineTableProps,
} from './split-line-table';

const t = messages.overReceiptSplit;

/** `.wide-table`이 표에 주는 최소 폭(58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<SplitLineView>[]): number =>
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

/* 9302(품목)는 일부러 빼 둔다 — 「목록에 없음」 갈래를 실제 값으로 만든다. */
const ITEMS = source([[9301, 'SAMPLE-ITEM-01 · 합성 품목 가']]);
const UOMS = source([[9501, 'SAMPLE-EA · 합성 단위 개']]);
const PLANTS = source([[9201, 'SAMPLE-PLT-01 · 합성 공장 가']]);

const columnsWith = (
  itemLookup: ReferenceSource = ITEMS,
  uomLookup: ReferenceSource = UOMS,
): Column<SplitLineView>[] =>
  buildSplitLineColumns({ itemLookup, uomLookup, onChangeQty: () => undefined });

const rowsWith = (texts: Record<number, string> = {}): SplitLineView[] =>
  toSplitLines(
    purchaseOrderLineFixtures,
    Object.entries(texts).reduce<LineDrafts>(
      (drafts, [lineId, text]) => setDraftQty(drafts, Number(lineId), text),
      createDrafts(purchaseOrderLineFixtures),
    ),
  );

const renderTable = (overrides: Partial<SplitLineTableProps> = {}) => {
  const onChangeQty = vi.fn<(purchaseOrderLineId: number, text: string) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <SplitLineTable
      purchaseOrder={purchaseOrder()}
      supplierName="SAMPLE-SUP-01 · 합성 공급사 가"
      rows={rowsWith()}
      isLoading={false}
      plantLookup={PLANTS}
      itemLookup={ITEMS}
      uomLookup={UOMS}
      onChangeQty={onChangeQty}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onChangeQty, onRetryReferences, user: userEvent.setup() };
};

const table = (): HTMLElement => screen.getByRole('table');

const qtyInput = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.arrivedQtyLabel(lineNo));

describe('buildSplitLineColumns — 열 구성과 폭', () => {
  it('열이 여섯이다 — 수량 넷을 짝지어 담는다', () => {
    expect(columnsWith().map((column) => column.key)).toEqual([
      'lineNo',
      'item',
      'ordered',
      'remaining',
      'arrivedQty',
      'split',
    ]);
  });

  /* **M41** — 흡수 열이 둘이 되면 남는 폭이 나뉘어 「코드 · 이름」이 낱말 단위로 쪼개진다. */
  it('폭을 지정하지 않은 흡수 열이 정확히 하나다', () => {
    expect(columnsWith().filter((column) => column.width === undefined).map((c) => c.key)).toEqual([
      'item',
    ]);
  });

  /*
   * 흡수 열의 예산까지 세어야 뜻이 있다 — 근거는 `po-table.test.tsx`의 같은 자리에 있다.
   * `지정합 + 예산 ≤ 928`과 `928 − 지정합 ≥ 예산`은 같은 부등식이라 하나만 적는다.
   */
  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    expect(specifiedWidthOf(columnsWith()) + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(
      WIDE_TABLE_MIN_PX,
    );
  });
});

describe('SplitLineTable — 발주 라인의 네 수치', () => {
  it('발주·기입하와 잔량·허용이 라인마다 보인다', () => {
    renderTable();

    expect(within(table()).getByText(t.lineTable.orderedPair(100, 40))).toBeInTheDocument();
    expect(within(table()).getByText(t.lineTable.remainingPair(60, 5))).toBeInTheDocument();
  });

  /* 누적 입하가 발주를 넘긴 줄이다 — 잔량을 음수로 그리면 사용자가 뜻을 알 수 없다. */
  it('누적 입하가 발주를 넘긴 줄의 잔량은 0으로 보인다', () => {
    renderTable();

    expect(within(table()).getByText(t.lineTable.orderedPair(30, 45))).toBeInTheDocument();
    expect(within(table()).getByText(t.lineTable.remainingPair(0, 5))).toBeInTheDocument();
  });

  it('품목을 이름으로 풀고 목록에 없으면 번호 대신 문구를 낸다', () => {
    renderTable();

    expect(within(table()).getAllByText('SAMPLE-ITEM-01 · 합성 품목 가')).toHaveLength(2);
    expect(within(table()).getByText(t.values.unknown)).toBeInTheDocument();
    expect(within(table()).queryByText('9302')).not.toBeInTheDocument();
  });

  /* 단위 열을 따로 두지 않는다 — 수량을 치는 자리에 붙는다. */
  it('단위는 수량 입력칸의 안내로 붙는다', () => {
    renderTable();

    expect(
      screen.getAllByText(t.lineTable.uomNote('SAMPLE-EA · 합성 단위 개')).length,
    ).toBeGreaterThan(0);
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

  /*
   * 표 안이라 보이는 라벨을 둘 자리가 없다(배치 규범 3의 이탈 조건).
   * **접근 이름에 내부 번호를 넣지 않는다** — 그것이 화면 밖으로 새는 또 하나의 경로다.
   */
  it('입력칸의 접근 이름에 내부 번호가 없다', () => {
    renderTable();

    expect(qtyInput(1).getAttribute('aria-label') ?? '').not.toContain('9401');
  });
});

describe('SplitLineTable — 정량과 초과', () => {
  /* 한도(잔량 60 + 허용 5)와 꼭 같은 도착은 전부 정량분이다. */
  it('한도와 같은 수량은 전부 정량분으로 보인다', () => {
    renderTable({ rows: rowsWith({ 9401: '65' }) });

    expect(within(table()).getByText(t.lineTable.splitPair(65, 0))).toBeInTheDocument();
  });

  it('한도를 넘으면 넘은 몫만 초과분으로 보인다', () => {
    renderTable({ rows: rowsWith({ 9401: '66' }) });

    expect(within(table()).getByText(t.lineTable.splitPair(65, 1))).toBeInTheDocument();
  });

  /* 잔량도 허용치도 없는 줄이다 — 도착한 전부가 초과분이다. */
  it('받을 것이 남지 않은 줄은 전부 초과분으로 보인다', () => {
    renderTable({ rows: rowsWith({ 9402: '12' }) });

    expect(within(table()).getByText(t.lineTable.splitPair(0, 12))).toBeInTheDocument();
  });

  it('수량을 넣지 않은 줄은 가를 것이 없다고 낸다', () => {
    renderTable();

    expect(within(table()).getAllByText(t.values.notSplit)).toHaveLength(3);
  });

  /* **M17의 부품 몫** — 잘못 친 값은 계산에서 빠지고 그 자리에 사유가 붙는다. */
  it('잘못 친 수량은 사유가 붙고 갈리지 않는다', () => {
    renderTable({ rows: rowsWith({ 9401: '0' }) });

    expect(screen.getByText(t.errors.qtyNotPositive)).toBeInTheDocument();
    expect(within(table()).getAllByText(t.values.notSplit)).toHaveLength(3);
  });

  /* 파생값이라는 사실을 밝히지 않으면 서버가 정한 값으로 읽혀 사용자가 수량을 다시 보지 않는다. */
  it('정량·초과가 화면이 만든 값임을 밝힌다', () => {
    renderTable();

    expect(screen.getByText(t.notes.splitDerived)).toBeInTheDocument();
    expect(screen.getByText(t.notes.arrivedQtyOptional)).toBeInTheDocument();
  });
});

describe('SplitLineTable — 고른 발주의 제목줄', () => {
  it('목록 표에 없는 공장까지 제목줄에서 보인다', () => {
    renderTable();

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(within(summary).getByText('PO-2026-900001')).toBeInTheDocument();
    expect(within(summary).getByText('SAMPLE-SUP-01 · 합성 공급사 가')).toBeInTheDocument();
    expect(within(summary).getByText('SAMPLE-PLT-01 · 합성 공장 가')).toBeInTheDocument();
  });

  it('제목줄에 내부 번호가 없다', () => {
    renderTable();

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(summary.textContent ?? '').not.toContain('9001');
    expect(summary.textContent ?? '').not.toContain('9201');
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

  /* 문구가 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다. */
  it('셋 중 하나만 실패해도 안내와 복구 수단을 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      uomLookup: source([], { isError: true }),
    });

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('참조가 정상이면 복구 수단을 내지 않는다', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
