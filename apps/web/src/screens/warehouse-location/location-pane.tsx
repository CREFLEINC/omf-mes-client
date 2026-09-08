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
import { type ReactNode, useId } from 'react';

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
  /** 서버 조회에 전달할 검색어 */
  filterText: string;
  onFilterTextChange: (value: string) => void;
  canAddRoot: boolean;
  addRootDisabledReason: string;
  onAddRoot: () => void;
  canAddChild: boolean;
  addChildDisabledReason: string;
  onAddChild: () => void;
  onEdit: (location: Location) => void;
  onGenerateLabels: () => void;
  isGeneratingLabels: boolean;
  actionBanner: ReactNode;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 Location이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

const t = messages.warehouseLocation;

/** 들여쓰기 한 단계의 픽셀 폭. depth에 곱해 쓴다. */
const INDENT_PX = 20;

export const LocationPane = ({
  rows,
  isLoading,
  expandedIds,
  onToggleExpand,
  selectedIds,
  onSelectionChange,
  filterText,
  onFilterTextChange,
  canAddRoot,
  addRootDisabledReason,
  onAddRoot,
  canAddChild,
  addChildDisabledReason,
  onAddChild,
  onEdit,
  onGenerateLabels,
  isGeneratingLabels,
  actionBanner,
  loadError,
}: LocationPaneProps) => {
  const addRootNoteId = useId();
  const addChildNoteId = useId();
  const labelNoteId = useId();

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
    {
      key: 'locationName',
      header: t.fields.locationName,
      render: (row) => row.location.locationName,
    },
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

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.locations}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.location.locationId)}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        empty={emptySlot}
      />
    );
  };

  return (
    <section aria-label={t.tabs.location}>
      {actionBanner}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.locationSearchLabel}
          placeholder={t.filters.locationSearchPlaceholder}
          value={filterText}
          onChange={(event) => onFilterTextChange(event.target.value)}
          onClear={() => onFilterTextChange('')}
        />
        <div className="field-cell field-cell-unlabeled">
          <Button
            variant="outlined"
            disabled={!canAddRoot}
            aria-describedby={canAddRoot ? undefined : addRootNoteId}
            onClick={onAddRoot}
          >
            {t.actions.addRootLocation}
          </Button>
          {!canAddRoot && (
            <span id={addRootNoteId} className="field-note">
              {addRootDisabledReason}
            </span>
          )}
        </div>
        <div className="field-cell field-cell-unlabeled">
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
              {addChildDisabledReason}
            </span>
          )}
        </div>
        <Button
          className="field-cell-unlabeled"
          variant="outlined"
          disabled={selectedIds.length === 0 || isGeneratingLabels}
          loading={isGeneratingLabels}
          aria-describedby={selectedIds.length === 0 ? labelNoteId : undefined}
          onClick={onGenerateLabels}
        >
          {t.actions.generateLabel}
        </Button>
        {selectedIds.length === 0 && (
          <span id={labelNoteId} className="field-note field-cell-unlabeled">
            {t.actionReasons.generateLabelNeedsSelection}
          </span>
        )}
      </div>

      {listSlot()}
    </section>
  );
};
