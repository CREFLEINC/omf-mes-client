import { EmptyState, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { describeReference, toReference, type ReferenceSource } from '../stock-status/lookups';
import type { LocationStockRow } from './location-stock';

const t = messages.warehouseLayout;

export interface StockTableProps {
  /** 표 이름 — 「〈위치 코드〉 재고」. 머리 글과 같다. */
  label: string;
  rows: LocationStockRow[];
  /** 단위 목록 — 재고 현황(W-01-07)과 같은 풀이(`useUomOptions`). */
  uomLookup: ReferenceSource;
  /** 품질 상태 코드 → 이름. */
  qualityStatusName: (code: string) => string;
}

/**
 * 고른 위치(와 하위 위치)의 재고 표(피처 006 FR-013 · R-8) — 위치 · 품목(코드 · 이름) · LOT · 현재고(수량 · 단위) · 품질 상태.
 *
 * ⭐ **줄을 더하지 않는다.** 같은 품목 · LOT 이 여러 셀에 있으면 셀마다 한 줄이고, 위치 칸이 어느 셀로 가야 하는지 알린다.
 * ⭐ **수량 · 단위는 재고 현황과 같게 보인다** — 수량은 받은 값 그대로, 단위는 같은 풀이(`stock-status/lookups`). 같은 값이
 * 두 화면에서 다르게 읽히지 않게(SC-007).
 */
export const StockTable = ({ label, rows, uomLookup, qualityStatusName }: StockTableProps) => {
  const columns: Column<LocationStockRow>[] = [
    {
      key: 'location',
      header: t.stock.location,
      width: '9.5rem',
      render: (row) => row.locationCode,
    },
    {
      key: 'item',
      header: t.stock.item,
      render: (row) => (
        <div className="layout-stock-item">
          <span>{row.itemCode}</span>
          <span className="field-note">{row.itemName}</span>
        </div>
      ),
    },
    {
      key: 'lot',
      header: t.stock.lot,
      width: '10rem',
      render: (row) => row.lotNo ?? messages.common.reference.empty,
    },
    {
      key: 'onHand',
      header: t.stock.onHand,
      align: 'end',
      width: '7rem',
      render: (row) =>
        `${String(row.onHandQty)} ${describeReference(toReference(uomLookup, row.uomId))}`,
    },
    {
      key: 'quality',
      header: t.stock.qualityStatus,
      width: '7rem',
      render: (row) =>
        row.qualityStatusCode === null
          ? messages.common.reference.empty
          : qualityStatusName(row.qualityStatusCode),
    },
  ];

  return (
    <Table
      aria-label={label}
      className="layout-stock-table"
      density="compact"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.key}
      empty={<EmptyState size="sm" title={t.stock.empty} />}
    />
  );
};
