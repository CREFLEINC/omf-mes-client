import type { Column, SortState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LookupSource } from '../../patterns/lookup-display';
import {
  availableRatioOf,
  BalanceTable,
  buildBalanceColumns,
  type BalanceTableProps,
} from './balance-table';
import { balance, itemViewFixtures, lotViewFixtures } from './fixtures';
import type { BalanceView } from './types';

const t = messages.productStockStatus;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const widthOf = (columns: Column<BalanceView>[], key: string): number =>
  toPx(columns.find((column) => column.key === key)?.width);

const source = (
  values: [number, string][],
  overrides: Partial<LookupSource> = {},
): LookupSource => ({
  entries: values.map(([id, label]) => ({ value: String(id), label, isActive: true })),
  isError: false,
  isLoading: false,
  ...overrides,
});

const ITEMS = source([[9301, 'SAMPLE-ITEM-01 · 합성 품목 가']]);
const LOTS = source([
  [9401, 'SAMPLE-LOT-0001'],
  [9402, 'SAMPLE-LOT-0002'],
]);
const LOCATIONS = source([[9201, 'SAMPLE-LOC-01 · 합성 위치 가']]);

const LOOKUPS = { itemLookup: ITEMS, lotLookup: LOTS, locationLookup: LOCATIONS };

describe('availableRatioOf', () => {
  it('보유가 양수면 백분율을 낸다', () => {
    expect(availableRatioOf(balance({ onHandQty: 100, availableQty: 60 }))).toBe(60);
  });

  it('보유가 0 이하면 계산하지 않는다', () => {
    expect(availableRatioOf(balance({ onHandQty: 0, availableQty: 0 }))).toBeNull();
    expect(availableRatioOf(balance({ onHandQty: -4, availableQty: -4 }))).toBeNull();
  });

  it('0~100 범위로 가둔다', () => {
    expect(availableRatioOf(balance({ onHandQty: 10, availableQty: 15 }))).toBe(100);
  });
});

describe('buildBalanceColumns', () => {
  const deps = { ...LOOKUPS, selectedLotId: null, onToggleSelect: vi.fn() };

  it('모든 열이 폭을 지정한다', () => {
    for (const view of ['item', 'lot', 'location'] as const) {
      const columns = buildBalanceColumns({ ...deps, view });

      for (const column of columns) {
        expect(column.width, `${view}/${column.key}`).toBeDefined();
      }
    }
  });

  it('보기마다 축 열이 다르다', () => {
    expect(buildBalanceColumns({ ...deps, view: 'item' }).map((c) => c.key)).toContain('itemCode');
    expect(buildBalanceColumns({ ...deps, view: 'lot' }).map((c) => c.key)).toEqual(
      expect.arrayContaining(['itemCode', 'lotNo']),
    );
    expect(buildBalanceColumns({ ...deps, view: 'location' }).map((c) => c.key)).toEqual(
      expect.arrayContaining(['locationCode', 'itemCode']),
    );
  });

  it('상세 열은 LOT별 보기에만 있다', () => {
    expect(buildBalanceColumns({ ...deps, view: 'item' }).some((c) => c.key === 'select')).toBe(
      false,
    );
    expect(buildBalanceColumns({ ...deps, view: 'lot' }).some((c) => c.key === 'select')).toBe(
      true,
    );
  });

  it('정렬 가능 열은 availableQty 하나뿐이다', () => {
    const columns = buildBalanceColumns({ ...deps, view: 'item' });
    const sortable = columns.filter((c) => c.sortable === true).map((c) => c.key);

    expect(sortable).toEqual(['availableQty']);
  });
});

const renderTable = (overrides: Partial<BalanceTableProps> = {}) => {
  const onSortChange = vi.fn<(next: SortState | null) => void>();
  const onFirstPage = vi.fn<() => void>();
  const onRetryReferences = vi.fn<() => void>();
  const onToggleSelect = vi.fn<(lotId: number) => void>();

  render(
    <BalanceTable
      view="item"
      rows={itemViewFixtures}
      isLoading={false}
      hasQuery
      isBeyondLast={false}
      sortKey={null}
      selectedLotId={null}
      onSortChange={onSortChange}
      onFirstPage={onFirstPage}
      onToggleSelect={onToggleSelect}
      onRetryReferences={onRetryReferences}
      referencesFailed={false}
      {...LOOKUPS}
      {...overrides}
    />,
  );

  return { onSortChange, onFirstPage, onRetryReferences, onToggleSelect, user: userEvent.setup() };
};

describe('BalanceTable', () => {
  it('조회 전에는 안내를 낸다', () => {
    renderTable({ hasQuery: false, rows: [] });

    expect(screen.getByText(t.empty.notQueriedTitle)).toBeInTheDocument();
  });

  it('결과가 없으면 안내를 낸다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  it('참조 목록에 없는 품목은 알 수 없음으로 낸다', () => {
    renderTable({ rows: [balance({ itemId: 9999 })] });

    expect(screen.getByText(messages.common.reference.unknown)).toBeInTheDocument();
  });

  it('보유가 음수면 음수 보유 표식을 낸다', () => {
    renderTable({ rows: [balance({ onHandQty: -5, availableQty: -5 })] });

    expect(screen.getByText(t.values.negativeOnHand)).toBeInTheDocument();
  });

  it('보류 LOT 수가 있으면 표식을 낸다', () => {
    renderTable({ rows: [balance({ heldLotCount: 3 })] });

    expect(screen.getByText(t.values.heldLotCount(3))).toBeInTheDocument();
  });

  it('LOT별 보기에서 상세를 고르면 콜백이 불린다', async () => {
    const { onToggleSelect, user } = renderTable({ view: 'lot', rows: lotViewFixtures });

    /* 접근 이름에 LOT 이름을 넣는다 — 「상세」가 줄마다 되풀이되면 어느 줄인지 알 수 없다. */
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SAMPLE-LOT-0001') }));

    expect(onToggleSelect).toHaveBeenCalledWith(9401);
  });

  it('그룹 헤더는 이름으로 묶은 뒤 첫 줄에서 이름을 푼다', () => {
    renderTable({ view: 'lot', rows: lotViewFixtures });

    expect(
      screen.getByText(t.groupHeader.item('SAMPLE-ITEM-01 · 합성 품목 가')),
    ).toBeInTheDocument();
  });

  it('참조 실패를 밝히고 다시 시도를 낸다', async () => {
    const { onRetryReferences, user } = renderTable({ referencesFailed: true });

    expect(screen.getByText(t.reasons.listReferencesFailed)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalled();
  });
});
