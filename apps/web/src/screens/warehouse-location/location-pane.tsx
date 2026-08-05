import {
  Button,
  type Column,
  EmptyState,
  IconButton,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { LocationTreeRow } from './location-tree';
import type { Location } from './types';

export interface LocationPaneProps {
  /** buildLocationRows의 결과 */
  rows: LocationTreeRow[];
  isLoading: boolean;
  expandedIds: ReadonlySet<number>;
  onToggleExpand: (locationId: number) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** 이미 받아 둔 목록을 클라이언트에서 거른다 */
  filterText: string;
  onFilterTextChange: (value: string) => void;
  onAddRoot: () => void;
  /** 선택이 정확히 1건일 때만 활성 */
  onAddChild: () => void;
  onEdit: (location: Location) => void;
}

const t = messages.warehouseLocation;

/** 들여쓰기 한 단계의 픽셀 폭. depth에 곱해 쓴다. */
const INDENT_PX = 20;

const matchesFilter = (row: LocationTreeRow, filterText: string): boolean => {
  if (filterText === '') return true;
  const needle = filterText.toLowerCase();
  return (
    row.location.locationCode.toLowerCase().includes(needle) ||
    row.location.locationName.toLowerCase().includes(needle)
  );
};

export const LocationPane = ({
  rows,
  isLoading,
  expandedIds,
  onToggleExpand,
  selectedIds,
  onSelectionChange,
  filterText,
  onFilterTextChange,
  onAddRoot,
  onAddChild,
  onEdit,
}: LocationPaneProps) => {
  const addChildNoteId = useId();
  const labelNoteId = useId();

  const canAddChild = selectedIds.length === 1;
  const visibleRows = rows.filter((row) => matchesFilter(row, filterText));

  /**
   * DS에 Tree 컴포넌트가 없어 Table + 들여쓰기 + 접기 버튼의 조합으로 계층을 만든다.
   * 이 조합은 화면 슬라이스가 소유한다 — 조합물은 디자인 시스템으로 올리지 않는다.
   */
  const columns: Column<LocationTreeRow>[] = [
    {
      key: 'locationCode',
      header: t.fields.locationCode,
      render: (row) => {
        const isExpanded = expandedIds.has(row.location.locationId);

        return (
          <div
            className="tree-toggle"
            data-depth={row.depth}
            // depth는 데이터에서 오는 값이라 클래스로 미리 정의할 수 없다.
            style={{ paddingLeft: `${row.depth * INDENT_PX}px` }}
          >
            {row.hasChildren ? (
              <IconButton
                size="sm"
                icon={isExpanded ? 'expand_more' : 'chevron_right'}
                aria-label={isExpanded ? t.locationTable.collapse : t.locationTable.expand}
                onClick={() => onToggleExpand(row.location.locationId)}
              />
            ) : (
              <span aria-hidden="true" style={{ display: 'inline-block', width: '32px' }} />
            )}
            <button type="button" className="link-cell" onClick={() => onEdit(row.location)}>
              {row.location.locationCode}
            </button>
          </div>
        );
      },
    },
    { key: 'locationName', header: t.fields.locationName, render: (row) => row.location.locationName },
    {
      key: 'isActive',
      header: t.fields.isActive,
      render: (row) => (row.location.isActive ? t.values.active : t.values.inactive),
    },
  ];

  const emptySlot =
    filterText === '' ? (
      <EmptyState
        size="sm"
        live
        title={t.empty.locationNoneTitle}
        description={t.empty.locationNoneDescription}
      />
    ) : (
      <EmptyState
        size="sm"
        live
        title={t.empty.locationNoMatchTitle}
        description={t.empty.locationNoMatchDescription}
      />
    );

  return (
    <section aria-label={t.tabs.location}>
      <div className="filter-bar">
        <SearchInput
          label={t.filters.locationSearchLabel}
          placeholder={t.filters.locationSearchPlaceholder}
          value={filterText}
          onChange={(event) => onFilterTextChange(event.target.value)}
          onClear={() => onFilterTextChange('')}
        />
        <Button variant="outlined" onClick={onAddRoot}>
          {t.actions.addRootLocation}
        </Button>
        <div>
          <Button
            variant="outlined"
            disabled={!canAddChild}
            aria-describedby={canAddChild ? undefined : addChildNoteId}
            onClick={onAddChild}
          >
            {t.actions.addChildLocation}
          </Button>
          {!canAddChild && (
            <span id={addChildNoteId} className="field-note">
              {t.actionReasons.addChildNeedsSingleSelection}
            </span>
          )}
        </div>
        {/* 서버 렌더링 API가 없다 — 기능을 지어내지 않고 사유를 보이는 텍스트로 낸다. */}
        <div>
          <Button variant="outlined" disabled aria-describedby={labelNoteId}>
            {t.actions.generateLabel}
          </Button>
          <span id={labelNoteId} className="field-note">
            {t.actionReasons.generateLabelUnavailable}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div role="status" aria-label={t.loading.locations}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <Table
          density="compact"
          columns={columns}
          rows={visibleRows}
          getRowId={(row) => String(row.location.locationId)}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          empty={emptySlot}
        />
      )}
    </section>
  );
};
