import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inboundReceiptLine, inboundReceiptLineFixtures } from './fixtures';
import { buildIrLineColumns, IrLineTable, type IrLineTableProps } from './ir-line-table';
import type { ItemNameLookup, ReferenceSource, ReferenceState } from './lookups';
import type { IrLineView } from './types';

const t = messages.goodsReceipt;

/** 이 표의 최소 폭(공용 `.wide-table` 58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

/** px 로 지정한 폭만 센다 — 비율 폭(품목·자재 LOT)은 표 폭에 따라 달라 합에 넣지 않는다. */
const toPx = (width: string | undefined): number =>
  width === undefined || !width.endsWith('px') ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<IrLineView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const source = (entries: ReferenceSource['entries'] = []): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
});

/**
 * 품목만 목록 참조가 아니다 — 번호를 표기 상태로 바로 옮기는 풀이를 세운다.
 * 적지 않은 번호는 「아직 답이 오지 않음」이다(요청이 줄마다 따로 나간다).
 */
const itemNames = (
  states: Record<number, ReferenceState>,
  overrides: Partial<ItemNameLookup> = {},
): ItemNameLookup => ({
  of: (itemId) => states[itemId] ?? { kind: 'loading' },
  isError: false,
  refetch: () => undefined,
  ...overrides,
});

const itemSource = itemNames({
  9301: { kind: 'named', label: 'SAMPLE-ITEM-01 · 합성 품목 가' },
});
const uomSource = source([{ value: '9501', label: 'SAMPLE-EA · 합성 단위 개', isActive: true }]);
const lotSource = source([
  { value: '9601', label: 'LOT-2026-900010', isActive: true },
  { value: '9602', label: 'LOT-2026-900011', isActive: true },
]);

const columns = (): Column<IrLineView>[] =>
  buildIrLineColumns({
    itemNames: itemSource,
    uomLookup: uomSource,
    lotLookup: lotSource,
    reasonIdPrefix: 'reason',
  });

const renderTable = (overrides: Partial<IrLineTableProps> = {}) => {
  const onSelect = vi.fn<(inboundReceiptLineId: number) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <IrLineTable
      rows={inboundReceiptLineFixtures}
      isLoading={false}
      itemNames={itemSource}
      uomLookup={uomSource}
      lotLookup={lotSource}
      selectedLineId={null}
      onSelect={onSelect}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onSelect, onRetryReferences, user: userEvent.setup() };
};

describe('buildIrLineColumns — 열 구성과 폭', () => {
  /* C-1 — 끝 열 [선택]이 없다. 행 전체를 눌러 고른다. */
  it('열이 다섯이고 선택 열과 단위 열이 따로 없다', () => {
    expect(columns().map((column) => column.key)).toEqual([
      'lineNo',
      'item',
      'receivedQty',
      'lot',
      'expiryDate',
    ]);
  });

  it('품목·자재 LOT만 비율 폭이고 나머지는 px 폭이다', () => {
    const ratio = columns().filter((column) => column.width?.endsWith('%'));

    expect(ratio.map((column) => [column.key, column.width])).toEqual([
      ['item', '28%'],
      ['lot', '35%'],
    ]);
    expect(
      columns()
        .filter((column) => !column.width?.endsWith('%'))
        .every((column) => column.width?.endsWith('px')),
    ).toBe(true);
  });

  /* 표 하한에서도 품목이 「코드 · 이름」을 담을 폭을 받는다. */
  it('px 폭 합과 두 비율 열을 더해도 표 하한 안이다', () => {
    const specified = specifiedWidthOf(columns());

    expect(specified).toBe(340);
    expect(WIDE_TABLE_MIN_PX * 0.28).toBeGreaterThanOrEqual(CODE_NAME_COLUMN_PX);
    expect(specified + WIDE_TABLE_MIN_PX * 0.63).toBeLessThanOrEqual(WIDE_TABLE_MIN_PX);
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
  it('자재 LOT이 없는 줄은 고를 수 없고 사유가 행에 이어진다', () => {
    renderTable({ rows: [inboundReceiptLine({ lotId: null })] });

    const row = screen.getByRole('row', { name: t.lineTable.rowLabel(1) });
    const reason = screen.getByText(t.reasons.lineNoLot);

    expect(row).toHaveAttribute('aria-disabled', 'true');
    /* 사유는 감추지 않고 항상 보이는 DOM 텍스트로 두고 `aria-describedby`로 잇는다(규범 4). */
    expect(row.getAttribute('aria-describedby')).toBe(reason.getAttribute('id'));
  });

  /*
   * **R-3** — 사유가 서로 다른 두 줄이 한 표에 있는 것이 이 화면의 **정상 경로**다.
   * 막힌 줄이 하나뿐인 표에서는 상수 `id`도 정답과 구분되지 않아, 연결이 어긋나 있어도
   * 드러나지 않는다. 어긋나면 수량 0인 줄이 스크린리더에서 **「자재 LOT이 없다」**로 읽혀,
   * `line-select.ts`가 판정 **순서**까지 정해 막으려 한 바로 그 오해가 되살아난다.
   */
  it('막힌 줄이 둘이면 각 행이 자기 줄의 사유를 가리킨다', () => {
    renderTable({
      rows: [
        inboundReceiptLine({ inboundReceiptLineId: 9403, lineNo: 1, lotId: null }),
        inboundReceiptLine({ inboundReceiptLineId: 9404, lineNo: 2, receivedQty: 0 }),
      ],
    });

    expect(screen.getByRole('row', { name: t.lineTable.rowLabel(1) })).toHaveAccessibleDescription(
      t.reasons.lineNoLot,
    );
    expect(screen.getByRole('row', { name: t.lineTable.rowLabel(2) })).toHaveAccessibleDescription(
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
      screen
        .getByRole('row', { name: t.lineTable.rowLabel(lineNo) })
        .getAttribute('aria-describedby'),
    );

    expect(ids[0]).not.toBeNull();
    expect(new Set(ids).size).toBe(2);
  });

  /* **M13** — 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. */
  it('입하 수량이 0인 줄은 고를 수 없고 다른 사유가 붙는다', () => {
    renderTable({ rows: [inboundReceiptLine({ receivedQty: 0 })] });

    expect(screen.getByRole('row', { name: t.lineTable.rowLabel(1) })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
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

    /* `—` 대신 「자재 LOT이 생성되지 않았습니다.」만 둔다(사용자 지시). */
    expect(within(table).getByText(t.reasons.lineNoLot)).toBeInTheDocument();
    expect(within(table).queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  /* 목록에 없는 LOT 번호는 「알 수 없음」이 맞다 — 값은 있는데 이름을 못 찾은 것이다. */
  it('참조 목록에 없는 자재 LOT은 알 수 없음이다', () => {
    renderTable({ rows: [inboundReceiptLine({ lotId: 9603 })] });

    const table = screen.getByRole('table');

    expect(within(table).getByText(t.values.unknown)).toBeInTheDocument();
    expect(table.textContent ?? '').not.toContain('9603');
  });

  /* C-1 — 행 어디를 눌러도 그 줄을 고른다. */
  it('고를 수 있는 줄을 누르면 그 줄을 알린다', async () => {
    const { onSelect, user } = renderTable();

    await user.click(screen.getByRole('row', { name: t.lineTable.rowLabel(1) }));

    expect(onSelect).toHaveBeenCalledWith(9401);
  });

  it('고를 수 없는 줄은 눌러도 알리지 않는다', async () => {
    const { onSelect, user } = renderTable();

    await user.click(screen.getByRole('row', { name: t.lineTable.rowLabel(3) }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  /* C-1 — 고른 행은 배경과 왼쪽 막대로 표시한다(`aria-selected`). */
  it('고른 줄은 선택 표시가 붙는다', () => {
    renderTable({ selectedLineId: 9401 });

    expect(screen.getByRole('row', { name: t.lineTable.rowLabel(1) })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('row', { name: t.lineTable.rowLabel(2) })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('표 안에 버튼이 없다', () => {
    renderTable();

    expect(within(screen.getByRole('table')).queryAllByRole('button')).toHaveLength(0);
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

describe('IrLineTable — 참조 실패', () => {
  it.each([
    ['품목', { itemNames: itemNames({}, { isError: true }) }],
    ['단위', { uomLookup: { ...uomSource, isError: true } }],
    ['자재 LOT', { lotLookup: { ...lotSource, isError: true } }],
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
    ['단위', { uomLookup: { ...uomSource, truncated: true } }],
  ])('%s 목록이 잘리면 그 사실을 밝힌다', (_label, overrides) => {
    renderTable(overrides);

    expect(screen.getByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
  });

  /**
   * **잘림 안내의 짝 방향** — 잘린 것은 「고를 수 없는 값이 생겼다」이지 「받은 이름을 믿을 수
   * 없다」가 아니다. 「잘렸으니 확신할 수 없다 → 알 수 없음」이라는 그럴듯한 오판이 실제로
   * 닿을 수 있는 거리에 있는데(잘림 여부가 이름을 푸는 함수와 같은 층에 있다), 그 오판은
   * 이 화면이 막으려는 #47 그 자체다 — 정상 값에 *값이 잘못됐다*는 표를 붙이는 것.
   */
  it('잘려도 목록에 있는 이름은 이름으로 낸다', () => {
    renderTable({ lotLookup: { ...lotSource, truncated: true } });

    expect(screen.getByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
    expect(screen.getAllByText('LOT-2026-900010').length).toBeGreaterThan(0);
  });

  /*
   * **품목은 잘림 축이 없다** — 번호마다 따로 물어 받은 쪽에 없다는 일 자체가 서지 않는다.
   * 목록으로 풀던 때 그 쪽 밖의 품목이 전부 「알 수 없음」으로 섰던 것이 이 화면의 결함이었다.
   */
  it('품목 이름은 줄마다 따로 오고 늦은 줄에도 번호를 내지 않는다', () => {
    renderTable({
      itemNames: itemNames({ 9301: { kind: 'named', label: 'SAMPLE-ITEM-01 · 합성 품목 가' } }),
    });

    expect(screen.getAllByText('SAMPLE-ITEM-01 · 합성 품목 가').length).toBeGreaterThan(0);
    expect(screen.queryByText(t.reasons.lineReferencesTruncated)).not.toBeInTheDocument();
    expect(screen.getByRole('table').textContent ?? '').not.toContain('9301');
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
