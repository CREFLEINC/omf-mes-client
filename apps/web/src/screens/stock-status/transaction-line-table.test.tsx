import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { transactionLineFixtures } from './fixtures';
import type { ReferenceSource } from './lookups';
import {
  buildLineColumns,
  TransactionLineTable,
  type TransactionLineTableProps,
} from './transaction-line-table';
import type { TransactionLineView } from './types';

const t = messages.stockStatus;

/** `.wide-table`이 표에 주는 최소 폭(58rem). **바닥이지 천장이 아니다.** */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const source = (values: [number, string][], overrides: Partial<ReferenceSource> = {}) =>
  ({
    entries: values.map(([id, label]) => ({ value: String(id), label, isActive: true })),
    isError: false,
    isLoading: false,
    ...overrides,
  }) satisfies ReferenceSource;

const ITEMS = source([[9301, 'SAMPLE-ITEM-01 · 합성 품목 가']]);
const LOTS = source([[9401, 'SAMPLE-LOT-0001']]);
const WAREHOUSES = source([
  [9101, 'SAMPLE-WH-01 · 합성 자재창고 가'],
  [9102, 'SAMPLE-WH-02 · 합성 자재창고 나'],
]);
/* 9299(다른 창고의 위치)는 일부러 뺀다 — 이 화면은 고른 창고의 위치만 받는다. */
const LOCATIONS = source([[9201, 'SAMPLE-LOC-01 · 합성 위치 가']]);
const UOMS = source([[9501, 'SAMPLE-EA']]);

const LOOKUPS = {
  itemLookup: ITEMS,
  lotLookup: LOTS,
  warehouseLookup: WAREHOUSES,
  locationLookup: LOCATIONS,
  uomLookup: UOMS,
};

/** 조건 줄에서 고른 창고. 위치 이름을 풀 수 있는 범위다. */
const SCOPE_WAREHOUSE_ID = 9101;

const columns = (): Column<TransactionLineView>[] =>
  buildLineColumns({ scopeWarehouseId: SCOPE_WAREHOUSE_ID, ...LOOKUPS });

const renderTable = (overrides: Partial<TransactionLineTableProps> = {}) => {
  const onRetryReferences = vi.fn<() => void>();

  render(
    <TransactionLineTable
      lines={transactionLineFixtures().lines}
      scopeWarehouseId={SCOPE_WAREHOUSE_ID}
      onRetryReferences={onRetryReferences}
      {...LOOKUPS}
      {...overrides}
    />,
  );

  return { onRetryReferences, user: userEvent.setup() };
};

const table = (): HTMLElement => screen.getByRole('table');

const headerNames = (): string[] =>
  within(table())
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent ?? '');

const rowCells = (index: number): string[] =>
  within(within(table()).getAllByRole('row')[index + 1] ?? table())
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');

describe('TransactionLineTable — 열 구성', () => {
  /* **수량이 여기서만 나온다** — 헤더 목록에는 수량 열이 없다(C56·C58). */
  it('품목·LOT·수량·단위와 이동 전후를 낸다', () => {
    renderTable();

    expect(headerNames()).toEqual([
      t.history.lines.item,
      t.history.lines.lot,
      t.history.lines.qty,
      t.history.lines.uom,
      t.history.lines.fromWarehouse,
      t.history.lines.fromLocation,
      t.history.lines.toWarehouse,
      t.history.lines.toLocation,
    ]);
  });

  it('축 열이 200px 이상이고 모든 열이 폭을 지정한다', () => {
    const all = columns();

    expect(toPx(all.find((column) => column.key === 'item')?.width)).toBeGreaterThanOrEqual(
      CODE_NAME_COLUMN_PX,
    );
    expect(all.every((column) => column.width !== undefined)).toBe(true);
  });

  it('열 폭 합이 wide-table 하한 이상이다', () => {
    const total = columns().reduce((sum, column) => sum + toPx(column.width), 0);

    expect(total).toBeGreaterThanOrEqual(WIDE_TABLE_MIN_PX);
  });
});

describe('TransactionLineTable — 값 표기', () => {
  /* 서버가 준 수량을 그대로 그린다 — 부호를 바꾸거나 절댓값을 취하지 않는다. */
  it('수량과 단위를 그대로 낸다', () => {
    renderTable();

    expect(rowCells(0)).toContain('120');
    expect(rowCells(0)).toContain('SAMPLE-EA');
  });

  /*
   * **입고 라인에는 출발지가 없는 것이 정상이다** — 대시로 둔다. 어느 쪽이 비었는지가
   * 곧 거래의 방향이라, 빈칸으로 두면 자료가 빠진 것인지 방향인지 구분되지 않는다.
   */
  it('한쪽만 있는 이동은 다른 쪽을 대시로 낸다', () => {
    renderTable();

    const receipt = rowCells(0);

    expect(receipt).toContain('SAMPLE-WH-01 · 합성 자재창고 가');
    expect(receipt.filter((cell) => cell === t.values.empty)).toHaveLength(2);
  });

  /*
   * **`null`이 확정된 뜻을 갖는 자리다**(계획 결정 10) — LOT을 관리하지 않는 품목의 라인은
   * 비는 것이 정상이라 「(LOT 무관)」이다. 「알 수 없음」으로 두면 *값이 잘못됐다*는 뜻이 된다.
   */
  it('LOT이 없는 라인은 「(LOT 무관)」이고 「알 수 없음」이 아니다', () => {
    renderTable();

    /* 선행 단언 — LOT이 있는 줄은 이름으로 보인다(둘을 함께 봐야 표기가 갈렸음이 드러난다). */
    expect(rowCells(0)).toContain('SAMPLE-LOT-0001');
    expect(rowCells(1)).toContain(t.values.noLot);
    expect(within(table()).queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  /*
   * **다른 창고의 위치는 「알 수 없음」이 아니다**(#47). 이 화면은 조건 줄에서 고른 창고의
   * 위치 목록만 받으므로 다른 창고의 위치는 **이름을 모를 뿐 값이 잘못된 것이 아니다.**
   */
  it('다른 창고의 위치는 그 사실을 적고 「알 수 없음」으로 두지 않는다', () => {
    renderTable();

    const transfer = rowCells(2);

    /* 선행 단언 — 같은 창고의 위치는 이름으로 풀린다. */
    expect(transfer).toContain('SAMPLE-LOC-01 · 합성 위치 가');
    expect(transfer).toContain(t.history.lines.otherWarehouseLocation);
    expect(transfer).not.toContain(t.values.unknown);
  });

  /* 밝히지 않으면 「(다른 창고의 위치)」가 자료 누락으로 읽힌다. */
  it('위치 이름의 범위를 밝힌다', () => {
    renderTable();

    expect(screen.getByText(t.history.lines.scopeNote)).toBeInTheDocument();
  });

  /* 같은 창고인데 목록에 없는 위치는 「알 수 없음」이 맞다 — 값이 잘못됐다는 뜻이다. */
  it('고른 창고의 위치인데 목록에 없으면 「알 수 없음」이다', () => {
    renderTable({
      lines: [
        {
          inventoryTransactionLineId: 9954,
          lineNo: 1,
          itemId: 9301,
          lotId: 9401,
          qty: 5,
          uomId: 9501,
          fromWarehouseId: null,
          fromLocationId: null,
          toWarehouseId: SCOPE_WAREHOUSE_ID,
          toLocationId: 9299,
        },
      ],
    });

    expect(within(table()).getByText(t.values.unknown)).toBeInTheDocument();
    expect(
      within(table()).queryByText(t.history.lines.otherWarehouseLocation),
    ).not.toBeInTheDocument();
  });

  /* **표 어디에도 내부 번호가 렌더되지 않는다**(#44). 픽스처는 9000대를 쓰고 수량은 세 자리다. */
  it('내부 번호를 화면에 내지 않는다', () => {
    renderTable();

    const body = table().textContent ?? '';

    for (const id of ['9301', '9401', '9101', '9201', '9501', '9951']) {
      expect(body).not.toContain(id);
    }
  });
});

describe('TransactionLineTable — 빈 상태와 참조 실패', () => {
  /*
   * **빈 상태를 만드는 자리는 하나다** — 표를 늘 그리고 `empty` 슬롯이 0건을 맡는다.
   * 바깥에서 먼저 가르면 그 슬롯이 도달 불가한 죽은 가지가 된다.
   */
  it('라인이 없으면 표의 빈 상태가 그것을 말한다', () => {
    renderTable({ lines: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.history.lines.emptyTitle)).toBeInTheDocument();
  });

  /* **문구가 적은 대상과 다시 부르는 대상이 같아야 한다**(계획 결정 9). */
  it('이름을 못 불러오면 안내와 다시 시도를 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      locationLookup: source([], { isError: true }),
    });

    expect(screen.getByText(t.history.lines.referencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  /* 짝 방향 — 다 왔으면 안내도 버튼도 내지 않는다. */
  it('이름이 다 오면 안내를 내지 않는다', () => {
    renderTable();

    expect(screen.queryByText(t.history.lines.referencesFailed)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* 다섯 중 어느 하나가 실패해도 같은 안내가 나온다 — 하나만 보고 있으면 나머지가 샌다. */
  it('다섯 참조 어느 하나가 실패해도 안내를 낸다', () => {
    for (const key of [
      'itemLookup',
      'lotLookup',
      'warehouseLookup',
      'locationLookup',
      'uomLookup',
    ] as const) {
      const { unmount } = render(
        <TransactionLineTable
          lines={transactionLineFixtures().lines}
          scopeWarehouseId={SCOPE_WAREHOUSE_ID}
          onRetryReferences={() => undefined}
          {...LOOKUPS}
          {...{ [key]: source([], { isError: true }) }}
        />,
      );

      expect(screen.getByText(t.history.lines.referencesFailed)).toBeInTheDocument();
      unmount();
    }
  });
});
