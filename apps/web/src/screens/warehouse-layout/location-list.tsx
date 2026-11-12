import { Chip, EmptyState, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, type ReactNode } from 'react';

import { BoardTable, BoardTablePickButton } from '../../patterns/board-table';
import {
  buildLocationRows,
  locationShownName,
  parentLocationIds,
  type LocationTreeRow,
} from '../../patterns/location-tree';
import {
  LocationTreeCell,
  LocationTreeHeader,
  levelNameOf,
} from '../../patterns/location-tree-cell';
import { OneLine } from '../../patterns/po-board';
import type { LocationView } from './types';

const t = messages.warehouseLayout;

export interface LocationListProps {
  locations: LocationView[];
  /** 그 위치의 표식이 도면에 있는가 — 「도면」 열의 찍음/아직. */
  isPlaced: (locationId: number) => boolean;
  selectedLocationId: number | null;
  onPick: (locationId: number) => void;
  /** 펼친 위치들. 펼침은 쓰는 쪽이 가진다 — 조회 화면과 편집 창이 따로 가진다(R-10). */
  expandedIds: ReadonlySet<number>;
  onExpandedChange: (ids: ReadonlySet<number>) => void;
  /** 목록이 비었을 때 설 안내. 주지 않으면 「위치가 없습니다」. */
  empty?: ReactNode;
}

/**
 * W-CO-08 위치 계층 표 — 코드 · 이름 · 구분 · 도면(찍음/아직).
 *
 * ⭐ **조회 화면과 편집 창이 같은 부품을 쓴다**(피처 006 R-10). 칸은 창고·Location 의 Location 목록과 같은 계층이다(사용자
 * 지시 2026-10-30). 코드 칸에 펼치기 단추가 있어 칸을 통째로 고르는 단추로 감쌀 수 없다 — 고르는 단추는 코드 글자만
 * 감싼다(`BoardTablePickButton`).
 */
export const LocationList = ({
  locations,
  isPlaced,
  selectedLocationId,
  onPick,
  expandedIds,
  onExpandedChange,
  empty,
}: LocationListProps) => {
  const treeRows = useMemo(
    () => buildLocationRows(locations, expandedIds),
    [locations, expandedIds],
  );

  const toggleExpand = (locationId: number): void => {
    const next = new Set(expandedIds);
    if (next.has(locationId)) {
      next.delete(locationId);
    } else {
      next.add(locationId);
    }
    onExpandedChange(next);
  };

  const columns: Column<LocationTreeRow>[] = [
    {
      key: 'code',
      header: (
        <LocationTreeHeader
          rows={treeRows}
          expandedIds={expandedIds}
          onCollapseAll={() => {
            onExpandedChange(new Set());
          }}
          onExpandAll={() => {
            onExpandedChange(parentLocationIds(locations));
          }}
        >
          {t.locations.code}
        </LocationTreeHeader>
      ),
      width: '280px',
      render: (row) => (
        <LocationTreeCell
          row={row}
          expanded={expandedIds.has(row.location.locationId)}
          onToggle={toggleExpand}
        >
          <BoardTablePickButton
            id={String(row.location.locationId)}
            label={row.location.locationCode}
            current={selectedLocationId === row.location.locationId}
          >
            {row.location.locationCode}
          </BoardTablePickButton>
        </LocationTreeCell>
      ),
    },
    {
      key: 'name',
      header: t.locations.name,
      render: (row) => <OneLine text={locationShownName(row.location)} />,
    },
    {
      key: 'level',
      header: t.locations.level,
      /* 서버가 만든 위치는 역할 이름(창고 전체 · 적치 대기) — Location 목록의 「구분」과 같다. */
      align: 'center',
      width: '88px',
      render: (row) => levelNameOf(row.location) ?? messages.common.reference.empty,
    },
    {
      key: 'placed',
      header: t.locations.placed,
      align: 'center',
      width: '80px',
      render: (row) =>
        isPlaced(row.location.locationId) ? (
          <Chip size="sm" status="success">
            {t.locations.onMap}
          </Chip>
        ) : (
          <Chip size="sm">{t.locations.notOnMap}</Chip>
        ),
    },
  ];

  return (
    <BoardTable
      label={t.panes.locations}
      className="location-tree-table"
      columns={columns}
      rows={treeRows}
      getRowId={(row) => String(row.location.locationId)}
      widthKey="omf-mes:warehouse-layout:location-tree-widths"
      minWidth="540px"
      pick={{
        label: (row) => row.location.locationCode,
        currentId: selectedLocationId === null ? null : String(selectedLocationId),
        onPick: (row) => {
          onPick(row.location.locationId);
        },
      }}
      empty={empty ?? <EmptyState size="sm" live title={t.locations.emptyTitle} />}
    />
  );
};
