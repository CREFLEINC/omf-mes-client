import {
  Button,
  Chip,
  type Column,
  EmptyState,
  IconButton,
  SearchInput,
  SkeletonText,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
import type { LocationTreeRow } from './location-tree';
import { locationShownName } from './mappers';
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
  /** 구역 하나를 골랐을 때만 — 그 구역 밑에 랙을 단다. */
  canAddChild: boolean;
  onAddChild: () => void;
  /** 랙 하나를 골랐을 때만 — 그 랙의 층 · 셀을 짠다. */
  canConfigureRack: boolean;
  onConfigureRack: () => void;
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
  onAddChild,
  canConfigureRack,
  onConfigureRack,
  onEdit,
  onGenerateLabels,
  isGeneratingLabels,
  actionBanner,
  loadError,
}: LocationPaneProps) => {
  const addRootNoteId = useId();
  const labelNoteId = useId();

  /**
   * DS에 Tree 컴포넌트가 없어 Table + 들여쓰기 + 접기 버튼의 조합으로 계층을 만든다.
   * 이 조합은 화면 슬라이스가 소유한다 — 조합물은 디자인 시스템으로 올리지 않는다.
   */
  const columns: Column<LocationTreeRow>[] = [
    {
      key: 'locationCode',
      header: t.fields.locationCode,
      width: '260px',
      /*
       * 위치 코드만 머리·값 왼쪽(사용자 결정 2026-09-18 · omf-all-around#17) — 가운데로 두면 행마다 따로
       * 가운데에 놓여 깊이 들여쓰기가 상쇄돼 상하위가 읽히지 않았다. 별칭·사용 상태는 가운데.
       */
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
      /* 별칭이 이름이다(사용자 지시 2026-10-29) — 없으면 저장된 위치명. 열 폭 저장 키는 그대로 둔다. */
      key: 'locationName',
      header: t.fields.aliasName,
      render: (row) => <OneLine text={locationShownName(row.location)} />,
    },
    {
      key: 'locationLevel',
      header: t.fields.locationLevel,
      /* 단계는 서버가 상위를 보고 정한다(P-154) — 화면은 읽기만 한다. 넷보다 깊던 옛 위치는 비어 온다. */
      align: 'center',
      width: '72px',
      render: (row) => {
        const code = row.location.locationLevelCode;
        return code === null || code === undefined
          ? messages.common.reference.empty
          : t.values.locationLevels[code];
      },
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      /* 창고 목록과 같은 상태 칩(omf-all-around#17). */
      align: 'center',
      width: '90px',
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
      /* 입고 관리 짜임의 표(사용자 지시 2026-10-29). 폭 없는 열은 별칭 하나. */
      <BoardTable
        label={t.tabs.location}
        className="warehouse-location-location-table"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.location.locationId)}
        widthKey="omf-mes:warehouse-location:location-widths"
        minWidth="560px"
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
      {/*
       * 역할별로 묶는다(omf-all-around#17) — 검색(왼쪽) · 등록(오른쪽 끝) · 선택한 Location 작업(구분선 아래).
       * 구역 추가의 비활성 사유만 묶음 바로 아래 도움말로 붙인다. 하위 추가는 사유 없이 비활성만 둔다
       * (사용자 지시 2026-09-18) — 활성 조건은 그대로다.
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
              {t.actions.addZone}
            </Button>
            <Button variant="outlined" disabled={!canAddChild} onClick={onAddChild}>
              {t.actions.addRack}
            </Button>
            <Button variant="outlined" disabled={!canConfigureRack} onClick={onConfigureRack}>
              {t.actions.configureRack}
            </Button>
          </div>
          {!canAddRoot && (
            <span id={addRootNoteId} className="field-note warehouse-location-inline-note">
              {addRootDisabledReason}
            </span>
          )}
        </div>
      </div>

      {/* 선택한 Location 대상 작업 — 도움말은 줄 왼쪽 끝, 단추는 오른쪽 끝(사용자 지시 2026-09-18). */}
      <div className="warehouse-location-location-selection">
        {selectedIds.length === 0 && (
          <span id={labelNoteId} className="field-note warehouse-location-inline-note">
            {t.actionReasons.generateLabelNeedsSelection}
          </span>
        )}
        <Button
          variant="outlined"
          disabled={selectedIds.length === 0 || isGeneratingLabels}
          loading={isGeneratingLabels}
          aria-describedby={selectedIds.length === 0 ? labelNoteId : undefined}
          onClick={onGenerateLabels}
        >
          {t.actions.generateLabel}
        </Button>
      </div>

      {listSlot()}
    </section>
  );
};
