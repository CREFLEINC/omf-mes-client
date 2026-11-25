import {
  Button,
  Chip,
  type Column,
  EmptyState,
  Icon,
  IconButton,
  Radio,
  RadioGroup,
  SearchInput,
  SkeletonText,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';
import { Link } from 'react-router';

import { BoardTable } from '../../patterns/board-table';
import { locationShownName, type LocationTreeRow } from '../../patterns/location-tree';
import {
  LocationTreeCell,
  LocationTreeHeader,
  levelNameOf,
} from '../../patterns/location-tree-cell';
import { OneLine } from '../../patterns/po-board';
import { AliasInlineEdit } from './alias-inline-edit';
import type { LocationViewMode } from './leaf-rows';
import type { Location } from './types';

export interface LocationPaneProps {
  /** 표 위 한 줄 위치 수 — 「전체 6 · 구역 1 · 랙 1 · 층 1 · 셀 1」. 아직 못 셌으면 null. */
  countText?: string | null;
  /** buildLocationRows의 결과 */
  rows: LocationTreeRow[];
  isLoading: boolean;
  expandedIds: ReadonlySet<number>;
  onToggleExpand: (locationId: number) => void;
  /** 전체 접기(구역만 남는다) · 전체 펼치기(사용자 지시 2026-10-29). */
  onCollapseAll: () => void;
  onExpandAll: () => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** 서버 조회에 전달할 검색어 */
  filterText: string;
  onFilterTextChange: (value: string) => void;
  canAddRoot: boolean;
  addRootDisabledReason: string;
  /** 구역 하나를 골랐을 때만 — 그 구역 밑에 랙을 층 · 셀과 함께 단다. */
  canAddChild: boolean;
  onAddChild: () => void;
  /** 고른 위치(랙이면 그 밑의 셀까지)에 낼 라벨이 있을 때만. */
  canPrintLabels: boolean;
  isPrintingLabels: boolean;
  onPrintLabels: () => void;
  onEdit: (location: Location) => void;
  actionBanner: ReactNode;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 Location이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
  /** 별칭 칸 연필(#267 FR-007) — 위치 수정 권한(W-06-07)이 있을 때만. 서버가 만든 자리도 별칭은 고친다. */
  canEditAlias?: boolean;
  /** [일괄 생성](#267 FR-001) — 위치 쓰기 권한(W-06-07)이 있을 때만 단추를 둔다. 누를 수 있는지는 구역 추가와 같다. */
  canBulkCreate?: boolean;
  onBulkCreate?: () => void;
  /** 보기 — 전체 계층(기본) · 적치 위치만(랙 아래 말단). */
  viewMode?: LocationViewMode;
  onViewModeChange?: (mode: LocationViewMode) => void;
  /**
   * 「배치도」 열 — 배치도 수정 창으로 가는 주소, 둘 수 없는 줄(층 · 셀)이나 권한이 없으면 null(사용자 지시 2026-11-24).
   * 주지 않으면 열이 없다.
   */
  layoutHrefOf?: (location: Location) => string | null;
  /** 적치 위치만 보기에서 상위 경로(랙부터). */
  parentPathOf?: (location: Location) => string;
}

const t = messages.warehouseLocation;

/**
 * 선택(약 48) + 코드 212 + 별칭 적어도 240 + 구분 84 + 배치도 64 + 사용 상태 88 — 상세 창 폭(약 745px)에 가로 스크롤 없이
 * 들어가게 줄였다(사용자 지시 2026-11-24). 별칭 240 은 줄이지 않는다(IME 커서 결함, 아래 별칭 칸 폭 시험).
 */
export const LOCATION_TABLE_MIN_WIDTH = '736px';

/** 코드 칸에 코드 대신 보일 별칭 — 비었거나 코드와 같으면 코드를 그대로 보인다. */
const aliasOf = (location: Location): string => {
  const alias = location.aliasName?.trim() ?? '';

  return alias === location.locationCode ? '' : alias;
};

export const LocationPane = ({
  countText = null,
  rows,
  isLoading,
  expandedIds,
  onToggleExpand,
  onCollapseAll,
  onExpandAll,
  selectedIds,
  onSelectionChange,
  filterText,
  onFilterTextChange,
  canAddRoot,
  addRootDisabledReason,
  canAddChild,
  onAddChild,
  canPrintLabels,
  isPrintingLabels,
  onPrintLabels,
  onEdit,
  actionBanner,
  loadError,
  canEditAlias = false,
  canBulkCreate = false,
  onBulkCreate,
  viewMode = 'tree',
  onViewModeChange,
  parentPathOf,
  layoutHrefOf,
}: LocationPaneProps) => {
  const addRootNoteId = useId();
  const viewLabelId = useId();
  const viewName = useId();
  const isLeafView = viewMode === 'leaf';
  /** 별칭을 고치는 줄 — 한 번에 하나. */
  const [aliasEditingId, setAliasEditingId] = useState<number | null>(null);

  /** 계층 칸 · 머리는 창고 배치도와 같은 부품이다(`patterns/location-tree-cell`). */
  const columns: Column<LocationTreeRow>[] = [
    {
      key: 'locationCode',
      /* 전체 접기 · 펼치기는 머리의 펼치기 단추 자리에(사용자 지시 2026-10-29) — 행의 펼치기 단추와 한 줄로 선다. */
      header: (
        <LocationTreeHeader
          rows={rows}
          expandedIds={expandedIds}
          onCollapseAll={onCollapseAll}
          onExpandAll={onExpandAll}
        >
          {t.fields.locationCode}
        </LocationTreeHeader>
      ),
      /* 별칭 칸에 자리를 내준다(#267) — 행은 별칭이 있으면 별칭을 보여 코드보다 짧다. 넘치면 말줄임. */
      width: '212px',
      /*
       * 위치 코드만 머리·값 왼쪽(사용자 결정 2026-09-18 · omf-all-around#17) — 가운데로 두면 행마다 따로
       * 가운데에 놓여 깊이 들여쓰기가 상쇄돼 상하위가 읽히지 않았다. 별칭·사용 상태는 가운데.
       */
      render: (row) => (
        <LocationTreeCell
          row={row}
          expanded={expandedIds.has(row.location.locationId)}
          onToggle={onToggleExpand}
        >
          <button type="button" className="link-cell" onClick={() => onEdit(row.location)}>
            {/*
             * 별칭이 있으면 코드 대신 별칭을 보인다(사용자 지시 2026-11-19 — 현장은 코드보다 별칭을 알아본다).
             * 코드는 수정 창 머리에 있다.
             */}
            {aliasOf(row.location) === '' ? row.location.locationCode : aliasOf(row.location)}
          </button>
          {/*
           * 「지정 품목만 받기」를 켠 위치만 — 코드 뒤 작은 자물쇠(사용자 지시 2026-10-29 · 피처 009 시안 결정). 지정 품목이
           * 있다는 것(hasItemRestriction)은 안내라 자물쇠를 달지 않는다 — PDA 적치로 지정이 늘어 「막힌 위치」로 잘못 읽힌다.
           */}
          {row.location.itemRestricted && (
            <span
              className="location-restricted-icon"
              role="img"
              aria-label={t.itemsSection.restricted}
              title={t.itemsSection.restricted}
            >
              <Icon name="lock" size={16} aria-hidden="true" />
            </span>
          )}
        </LocationTreeCell>
      ),
    },
    /* 적치 위치만 보기 — 「1층」 같은 별칭은 랙마다 되풀이되므로 어느 랙의 것인지 함께 보인다. */
    ...(isLeafView && parentPathOf !== undefined
      ? [
          {
            key: 'parentPath',
            header: t.view.parentPath,
            width: '200px',
            render: (row: LocationTreeRow) => <OneLine text={parentPathOf(row.location)} />,
          },
        ]
      : []),
    {
      /* 별칭이 이름이다(사용자 지시 2026-10-29) — 없으면 저장된 위치명. 열 폭 저장 키는 그대로 둔다. */
      key: 'locationName',
      header: t.fields.aliasName,
      render: (row) =>
        aliasEditingId === row.location.locationId ? (
          <AliasInlineEdit location={row.location} onClose={() => setAliasEditingId(null)} />
        ) : (
          <div className="location-alias-cell">
            <OneLine text={locationShownName(row.location)} />
            {canEditAlias && (
              <IconButton
                size="sm"
                icon="edit"
                aria-label={t.aliasEdit.edit(row.location.locationCode)}
                onClick={() => setAliasEditingId(row.location.locationId)}
              />
            )}
          </div>
        ),
    },
    {
      key: 'locationLevel',
      header: t.fields.locationLevel,
      /*
       * 단계는 서버가 상위를 보고 정한다(P-154) — 화면은 읽기만 한다. 넷보다 깊던 옛 위치는 비어 온다. 서버가 만든
       * 위치는 단계가 구역이어도 역할 이름(적치 대기 · 창고 전체)으로 — 수정 창 머리와 같은 이름.
       */
      align: 'center',
      width: '84px',
      render: (row) => levelNameOf(row.location) ?? messages.common.reference.empty,
    },
    ...(layoutHrefOf === undefined
      ? []
      : [
          {
            key: 'layout',
            header: t.layoutLink.header,
            align: 'center' as const,
            width: '64px',
            render: (row: LocationTreeRow) => {
              const href = layoutHrefOf(row.location);
              return href === null ? (
                <span className="location-layout-none">{messages.common.reference.empty}</span>
              ) : (
                /* 아이콘만 — 배치도 수정 창을 그 위치로 바로 연다. 이름은 접근명 · 말풍선으로. */
                <Link
                  to={href}
                  className="location-layout-link"
                  aria-label={t.layoutLink.label(row.location.locationCode)}
                  title={t.layoutLink.label(row.location.locationCode)}
                >
                  <Icon name="open_in_new" size={18} aria-hidden="true" />
                </Link>
              );
            },
          },
        ]),
    {
      key: 'isActive',
      header: t.fields.isActive,
      /* 창고 목록과 같은 상태 칩(omf-all-around#17). */
      align: 'center',
      width: '88px',
      render: (row) => (
        <Chip size="sm" status={row.location.isActive ? 'success' : 'idle'}>
          {row.location.isActive ? t.values.active : t.values.inactive}
        </Chip>
      ),
    },
  ];

  const emptySlot = isLeafView ? (
    /* 랙 아래 층 · 셀이 아직 없다 — 전체 계층에서 랙에 층 · 셀을 만든다. */
    <EmptyState size="sm" live title={t.view.emptyLeaf} />
  ) : filterText === '' ? (
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
      /*
       * 입고 관리 짜임의 표(사용자 지시 2026-10-29). 폭 없는 열은 별칭 하나 — 남는 폭을 맡는다. 최소 폭은 별칭 칸이
       * 「A열 1번 랙」+ 연필, 고치는 동안 입력칸이 쓸 만한 폭(약 240px)으로 남도록 잡는다. 칸이 좁으면 표가 옆으로 넘어간다.
       * 별칭 칸이 몇 px 로 눌리면 입력칸 폭이 0 에 가까워져 브라우저가 IME 확정 글자마다 커서를 맨 앞에 둔다(#267 실동작).
       */
      <BoardTable
        label={t.sections.location}
        className="location-tree-table warehouse-location-location-table"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.location.locationId)}
        /* v2 — 열 폭을 줄였다(2026-11-24). 예전에 끌어 둔 폭(코드 330 등)이 새 기본값을 덮지 않게 열쇠를 바꾼다. */
        widthKey="omf-mes:warehouse-location:location-widths:v2"
        minWidth={LOCATION_TABLE_MIN_WIDTH}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        empty={emptySlot}
      />
    );
  };

  return (
    <section aria-label={t.sections.location}>
      {actionBanner}
      {/*
       * 검색 · 보기(왼쪽)와 [Location 추가](오른쪽 끝) 한 줄. 검색은 칸 제목 없이 접근명만(사용자 지시 2026-10-29).
       * 고른 행에 하는 일(랙 추가 · 라벨 출력)은 아래 선택 막대에 둔다. 추가의 비활성 사유는 계층을 못 불렀을 때만 단추 밑에.
       */}
      <div className="filter-bar warehouse-location-location-toolbar">
        {/* 검색칸 바탕은 품목 · BOM 조회와 같은 공용 규칙(사용자 지시 2026-11-24) — 보기 단추는 칠하지 않게 검색칸만 감싼다. */}
        <div className="filter-field-surface warehouse-location-search">
          <SearchInput
            aria-label={t.filters.locationSearchLabel}
            placeholder={t.filters.locationSearchPlaceholder}
            value={filterText}
            onChange={(event) => onFilterTextChange(event.target.value)}
            onClear={() => onFilterTextChange('')}
            clearLabel={messages.common.clear}
          />
        </div>
        {onViewModeChange !== undefined && (
          <div className="warehouse-location-view" role="group" aria-labelledby={viewLabelId}>
            <span className="field-label" id={viewLabelId}>
              {t.view.label}
            </span>
            <RadioGroup
              name={viewName}
              orientation="horizontal"
              value={viewMode}
              aria-labelledby={viewLabelId}
              onChange={(value) => onViewModeChange(value === 'leaf' ? 'leaf' : 'tree')}
            >
              <Radio value="tree">{t.view.tree}</Radio>
              <Radio value="leaf">{t.view.leaf}</Radio>
            </RadioGroup>
          </div>
        )}
        {canBulkCreate && (
          <div className="warehouse-location-location-create">
            {/* 위치를 만드는 단추는 이것 하나(사용자 지시 2026-11-24) — 구역부터 셀까지, 기존 구역에 랙도 이 창에서. */}
            <Button
              leadingIcon={<Icon name="library_add" size={18} />}
              disabled={!canAddRoot}
              aria-describedby={canAddRoot ? undefined : addRootNoteId}
              onClick={onBulkCreate}
            >
              {t.bulkCreate.open}
            </Button>
            {!canAddRoot && (
              <span id={addRootNoteId} className="field-note warehouse-location-inline-note">
                {addRootDisabledReason}
              </span>
            )}
          </div>
        )}
      </div>

      {/*
       * 선택 막대(안 2, 사용자 결정 2026-11-24) — 고른 행이 있을 때만 표 위에, 그 행에 할 수 있는 일만. 고르지 않으면
       * 그 자리에 위치 수 줄이 있다. 흐린 단추를 늘 세워 두지 않는다.
       */}
      {selectedIds.length > 0 ? (
        <div className="location-selection-bar" role="toolbar" aria-label={t.selection.label}>
          <span className="location-selection-count">{t.selection.count(selectedIds.length)}</span>
          {canAddChild && (
            <Button size="sm" leadingIcon={<Icon name="add" size={18} />} onClick={onAddChild}>
              {t.actions.addRack}
            </Button>
          )}
          {(canPrintLabels || isPrintingLabels) && (
            <Button
              size="sm"
              variant="outlined"
              leadingIcon={<Icon name="print" size={18} />}
              disabled={isPrintingLabels}
              loading={isPrintingLabels}
              onClick={onPrintLabels}
            >
              {t.actions.printLabels}
            </Button>
          )}
          <Button size="sm" variant="text" onClick={() => onSelectionChange([])}>
            {t.selection.clear}
          </Button>
        </div>
      ) : (
        countText !== null && (
          <p className="warehouse-location-count" aria-label={t.warehouseInfo.countLabel}>
            {countText}
          </p>
        )
      )}
      {listSlot()}
    </section>
  );
};
