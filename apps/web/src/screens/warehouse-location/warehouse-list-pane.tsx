import { Button, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { BoardTable } from '../../patterns/board-table';
import { type LookupSource, lookupDisplayLabel } from '../../patterns/lookup-display';
import { OneLine } from '../../patterns/po-board';
import { codeLabel, defaultWarehouseFilters } from './code-options';
import type { LookupEntry, Warehouse, WarehouseFilters } from './types';

export interface WarehouseListPaneProps {
  items: Warehouse[];
  isLoading: boolean;
  /** 적용된 조건 — 빈 상태가 「맞는 창고 없음」인지 「등록된 창고 없음」인지 가른다 */
  appliedFilters: WarehouseFilters;
  /** 빈 상태의 초기화 */
  onApplyFilters: (next: WarehouseFilters) => void;
  selectedWarehouseId: number | null;
  onSelect: (warehouseId: number) => void;
  /** 빈 상태에서 등록으로 이끄는 주 액션 */
  onAddWarehouse: () => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 창고가 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
  warehouseTypeOptions: { value: string; label: string }[];
  /** 공장 이름 풀이용 원본 — 공장 열은 선택지가 아니라 전체에서 이름을 찾는다 */
  plants: LookupSource<LookupEntry>;
}

const t = messages.warehouseLocation;

const hasAnyFilter = (filters: WarehouseFilters): boolean =>
  filters.q !== '' ||
  filters.plantId !== '' ||
  filters.warehouseTypeCode !== '' ||
  filters.includeInactive;

/**
 * 창고 목록 — 입고 관리 짜임의 표(`BoardTable`, 사용자 지시 2026-10-29). 줄 어디를 눌러도 그 창고를 고른다.
 * 폭 없는 열은 창고명 하나, 나머지는 폭 지정 · minWidth = 고정 폭 합 + 160px.
 */
export const WarehouseListPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  selectedWarehouseId,
  onSelect,
  onAddWarehouse,
  loadError,
  warehouseTypeOptions,
  plants,
}: WarehouseListPaneProps) => {
  const columns: Column<Warehouse>[] = [
    { key: 'warehouseCode', header: t.fields.warehouseCode, width: '140px' },
    {
      key: 'warehouseName',
      header: t.fields.warehouseName,
      render: (row) => <OneLine text={row.warehouseName} />,
    },
    {
      key: 'plantId',
      /* 사업부가 아니라 공장이다 — 같은 사업부 안에서 창고가 공장으로 갈린다(P-109). */
      header: t.fields.plant,
      width: '140px',
      render: (row) => <OneLine text={lookupDisplayLabel(plants, row.plantId)} />,
    },
    {
      key: 'warehouseTypeCode',
      header: t.fields.warehouseType,
      width: '110px',
      render: (row) => codeLabel(row.warehouseTypeCode, warehouseTypeOptions),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      align: 'center',
      width: '90px',
      /* 상태는 기존 칩으로 — 사용 중 success · 미사용 idle(W-CO 단말 공정 매핑과 같은 규칙). */
      render: (row) => (
        <Chip size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.values.active : t.values.inactive}
        </Chip>
      ),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.warehouseNoMatchTitle}
      action={
        <Button variant="outlined" onClick={() => onApplyFilters(defaultWarehouseFilters)}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.warehouseNoneTitle}
      action={<Button onClick={onAddWarehouse}>{t.actions.addWarehouse}</Button>}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  if (loadError !== null && loadError !== undefined) return loadError;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.warehouses}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  return (
    <BoardTable
      label={t.panes.list}
      columns={columns}
      rows={items}
      getRowId={(row) => String(row.warehouseId)}
      widthKey="omf-mes:warehouse-location:list-widths"
      minWidth="640px"
      pick={{
        columnKey: 'warehouseCode',
        label: (row) => row.warehouseCode,
        currentId: selectedWarehouseId === null ? null : String(selectedWarehouseId),
        onPick: (row) => onSelect(row.warehouseId),
      }}
      empty={emptySlot}
    />
  );
};
