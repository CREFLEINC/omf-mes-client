import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { WAREHOUSE_TYPE_OPTIONS, warehouseTypeLabel } from './code-options';
import { defaultWarehouseFilters } from './fixtures';
import type { Warehouse, WarehouseFilters } from './types';

export interface WarehouseListPaneProps {
  items: Warehouse[];
  isLoading: boolean;
  /** 적용된(URL에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: WarehouseFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출 */
  onApplyFilters: (next: WarehouseFilters) => void;
  selectedWarehouseId: number | null;
  onSelect: (warehouseId: number) => void;
}

const t = messages.warehouseLocation;

const hasAnyFilter = (filters: WarehouseFilters): boolean =>
  filters.q !== '' || filters.warehouseTypeCode !== '' || filters.includeInactive;

export const WarehouseListPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  selectedWarehouseId,
  onSelect,
}: WarehouseListPaneProps) => {
  const typeSelectId = useId();

  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  // 편집 중인 값은 draft에만 있고 조건 칩에는 미러하지 않는다.
  const [draft, setDraft] = useState<WarehouseFilters>(appliedFilters);
  useEffect(() => {
    setDraft(appliedFilters);
  }, [appliedFilters]);

  const applyDraft = () => onApplyFilters(draft);

  const columns: Column<Warehouse>[] = [
    {
      key: 'warehouseCode',
      header: t.fields.code,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.warehouseId === selectedWarehouseId ? 'true' : undefined}
          onClick={() => onSelect(row.warehouseId)}
        >
          {row.warehouseCode}
        </button>
      ),
    },
    { key: 'warehouseName', header: t.fields.name },
    {
      key: 'warehouseTypeCode',
      header: t.fields.warehouseType,
      render: (row) => warehouseTypeLabel(row.warehouseTypeCode),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      render: (row) => (row.isActive ? t.values.active : t.values.inactive),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.warehouseNoMatchTitle}
      description={t.empty.warehouseNoMatchDescription}
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
      description={t.empty.warehouseNoneDescription}
    />
  );

  return (
    <section className="pane" aria-label={t.title}>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />
        <div>
          <label className="field-label" htmlFor={typeSelectId}>
            {t.fields.warehouseType}
          </label>
          <Select
            id={typeSelectId}
            options={[{ value: '', label: t.filters.typeAll }, ...WAREHOUSE_TYPE_OPTIONS]}
            value={draft.warehouseTypeCode}
            onChange={(value) => setDraft((prev) => ({ ...prev, warehouseTypeCode: value }))}
          />
        </div>
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <Checkbox
          checked={appliedFilters.includeInactive}
          onChange={(event) =>
            onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
          }
        >
          {messages.common.includeInactive}
        </Checkbox>
        <Button onClick={applyDraft}>{messages.common.search}</Button>
        <Button variant="outlined" onClick={() => onApplyFilters(defaultWarehouseFilters)}>
          {messages.common.reset}
        </Button>
      </div>

      <div className="filter-bar">
        {appliedFilters.q !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveKeyword}
            onRemove={() => onApplyFilters({ ...appliedFilters, q: '' })}
          >
            {t.filters.chipKeyword(appliedFilters.q)}
          </Chip>
        )}
        {appliedFilters.warehouseTypeCode !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveType}
            onRemove={() => onApplyFilters({ ...appliedFilters, warehouseTypeCode: '' })}
          >
            {t.filters.chipType(warehouseTypeLabel(appliedFilters.warehouseTypeCode))}
          </Chip>
        )}
        {appliedFilters.includeInactive && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveIncludeInactive}
            onRemove={() => onApplyFilters({ ...appliedFilters, includeInactive: false })}
          >
            {messages.common.includeInactive}
          </Chip>
        )}
      </div>

      {isLoading ? (
        <div role="status" aria-label={t.loading.warehouses}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <Table
          density="compact"
          columns={columns}
          rows={items}
          getRowId={(row) => String(row.warehouseId)}
          empty={emptySlot}
        />
      )}
    </section>
  );
};
