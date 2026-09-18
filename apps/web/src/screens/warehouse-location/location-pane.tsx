import {
  Button,
  Chip,
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
  /** 두 등록 단추가 같은 이유로 막혔으면(관리 수준이 창고) 사유 칩을 하나만 두고 둘 다 그것을 가리킨다. */
  const childSharesRootReason = !canAddRoot && addChildDisabledReason === addRootDisabledReason;

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
      /*
       * 창고 목록과 같은 상태 칩, 가운데 정렬(omf-all-around#17). 위치코드 열은 계층 들여쓰기가
       * 뜻을 가지므로 왼쪽에 둔다 — 가운데로 모으면 상하위 관계가 읽히지 않는다.
       */
      align: 'center',
      render: (row) => (
        <Chip size="sm" status={row.location.isActive ? 'success' : 'idle'}>
          {row.location.isActive ? t.values.active : t.values.inactive}
        </Chip>
      ),
    },
  ];

  const emptySlot =
    filterText === '' ? (
      <EmptyState
        size="sm"
        live
        title={t.empty.locationNoneTitle}
        /* 등록할 수 없는 창고에서 「추가해 주세요」라고 하지 않는다 — 단추 옆 사유와 같은 문장을 쓴다. */
        description={canAddRoot ? t.empty.locationNoneDescription : addRootDisabledReason}
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
      <div className="warehouse-location-location-table">
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
      </div>
    );
  };

  return (
    <section aria-label={t.tabs.location}>
      {actionBanner}
      {/*
       * 역할별로 묶는다(omf-all-around#17) — 검색(왼쪽) · 등록(오른쪽 끝) · 선택한 Location 작업(구분선 아래).
       * 비활성 사유는 해당 단추 묶음 바로 아래 도움말로 붙인다. 두 등록 단추의 사유가 같으면 한 번만 보인다.
       */}
      <div className="filter-bar warehouse-location-location-toolbar">
        <SearchInput
          label={t.filters.locationSearchLabel}
          placeholder={t.filters.locationSearchPlaceholder}
          value={filterText}
          onChange={(event) => onFilterTextChange(event.target.value)}
          onClear={() => onFilterTextChange('')}
          clearLabel={messages.common.clear}
        />
        <div className="field-cell-unlabeled warehouse-location-location-create">
          <div className="filter-actions">
            <Button
              variant="outlined"
              disabled={!canAddRoot}
              aria-describedby={canAddRoot ? undefined : addRootNoteId}
              onClick={onAddRoot}
            >
              {t.actions.addRootLocation}
            </Button>
            <Button
              variant="outlined"
              disabled={!canAddChild}
              aria-describedby={
                canAddChild ? undefined : childSharesRootReason ? addRootNoteId : addChildNoteId
              }
              onClick={onAddChild}
            >
              {t.actions.addChildLocation}
            </Button>
          </div>
          {!canAddRoot && (
            <span id={addRootNoteId} className="field-note warehouse-location-inline-note">
              {addRootDisabledReason}
            </span>
          )}
          {!canAddChild && !childSharesRootReason && (
            <span id={addChildNoteId} className="field-note warehouse-location-inline-note">
              {addChildDisabledReason}
            </span>
          )}
        </div>
      </div>

      <div className="warehouse-location-location-selection">
        <Button
          variant="outlined"
          disabled={selectedIds.length === 0 || isGeneratingLabels}
          loading={isGeneratingLabels}
          aria-describedby={selectedIds.length === 0 ? labelNoteId : undefined}
          onClick={onGenerateLabels}
        >
          {t.actions.generateLabel}
        </Button>
        {selectedIds.length === 0 && (
          <span id={labelNoteId} className="field-note warehouse-location-inline-note">
            {t.actionReasons.generateLabelNeedsSelection}
          </span>
        )}
      </div>

      {listSlot()}
    </section>
  );
};
