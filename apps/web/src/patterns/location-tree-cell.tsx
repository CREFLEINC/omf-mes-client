import { Icon, IconButton } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { LocationLevelCode } from './location-level';
import type { LocationTreeRow } from './location-tree';
import { isPutawayStaging, isSystemLocation, SYSTEM_LOCATION_ROLE } from './system-location';

type Location = components['schemas']['Location'];

/*
 * 위치 계층 칸 — 창고·Location 의 Location 목록과 창고 배치도의 위치 목록이 같은 칸을 쓴다(사용자 지시 2026-10-30).
 * DS 에 Tree 가 없어 표 + 들여쓰기 + 펼치기 단추로 계층을 만든다. 단계 이름 · 펼치기 문구는 위치 문구 묶음의 것이다.
 */
const t = messages.warehouseLocation;

/** 들여쓰기 한 단계의 픽셀 폭. depth에 곱해 쓴다. */
const INDENT_PX = 20;

/**
 * 단계마다 다른 모양 · 색의 아이콘(사용자 지시 2026-10-29) — 줄마다 어느 단계인지 한눈에 갈리게. 서버가 만든 자리는
 * 단계가 구역이어도 따로 둔다(창고 전체 · 적치 대기). 목록과 수정 창이 같은 아이콘을 쓴다.
 */
const LEVEL_ICONS: Record<LocationLevelCode, string> = {
  ZONE: 'grid_view',
  RACK: 'shelves',
  LEVEL: 'layers',
  CELL: 'crop_square',
};

type LevelSubject = Pick<Location, 'locationLevelCode' | 'systemRoleCode'>;

export const levelIconOf = (location: LevelSubject): { name: string; tone: string } => {
  if (isPutawayStaging(location)) return { name: 'move_to_inbox', tone: 'system' };
  if (isSystemLocation(location)) return { name: 'warehouse', tone: 'system' };
  const level = location.locationLevelCode;
  return level === null || level === undefined
    ? { name: 'place', tone: 'none' }
    : { name: LEVEL_ICONS[level], tone: level.toLowerCase() };
};

/** 단계 이름 — 서버가 만든 자리는 그 역할 이름(창고 전체 · 적치 대기). */
export const levelNameOf = (location: LevelSubject): string | null => {
  if (location.systemRoleCode === SYSTEM_LOCATION_ROLE.putawayStaging) {
    return t.values.systemRoles.PUTAWAY_STAGING;
  }
  if (location.systemRoleCode === SYSTEM_LOCATION_ROLE.warehouseWhole) {
    return t.values.systemRoles.WAREHOUSE_WHOLE;
  }
  const level = location.locationLevelCode;
  return level === null || level === undefined ? null : t.values.locationLevels[level];
};

export interface LocationTreeHeaderProps {
  rows: readonly LocationTreeRow[];
  expandedIds: ReadonlySet<number>;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  /** 열 제목(위치 코드). */
  children: ReactNode;
}

/**
 * 코드 열 머리 — 펼치기 단추 자리에 전체 접기 · 펼치기(사용자 지시 2026-10-29). 하나라도 펼쳐 있으면 접기, 다 접혀
 * 있으면 펼치기. 행의 펼치기 단추와 세로로 맞는다(`.location-tree-table`).
 */
export const LocationTreeHeader = ({
  rows,
  expandedIds,
  onCollapseAll,
  onExpandAll,
  children,
}: LocationTreeHeaderProps) => {
  const anyExpanded = rows.some(
    (row) => row.hasChildren && expandedIds.has(row.location.locationId),
  );
  const label = anyExpanded ? t.locationTable.collapseAll : t.locationTable.expandAll;

  return (
    <span className="tree-toggle-header">
      <IconButton
        size="sm"
        icon={anyExpanded ? 'unfold_less' : 'unfold_more'}
        aria-label={label}
        title={label}
        disabled={!rows.some((row) => row.hasChildren)}
        onClick={anyExpanded ? onCollapseAll : onExpandAll}
      />
      {children}
    </span>
  );
};

export interface LocationTreeCellProps {
  row: LocationTreeRow;
  expanded: boolean;
  onToggle: (locationId: number) => void;
  /** 코드 자리 — 화면마다 다르다(수정 창을 여는 단추 · 고르는 단추). */
  children: ReactNode;
}

/** 코드 칸 — 깊이만큼 들여 쓰고, 하위가 있으면 펼치기 단추, 그다음 단계 아이콘과 코드. */
export const LocationTreeCell = ({ row, expanded, onToggle, children }: LocationTreeCellProps) => {
  const icon = levelIconOf(row.location);

  return (
    <div
      className="tree-toggle"
      data-depth={row.depth}
      // depth는 데이터에서 오는 값이라 클래스로 미리 정의할 수 없다.
      style={{ paddingLeft: `${String(row.depth * INDENT_PX)}px` }}
    >
      {row.hasChildren ? (
        <IconButton
          size="sm"
          icon={expanded ? 'expand_more' : 'chevron_right'}
          aria-label={expanded ? t.locationTable.collapse : t.locationTable.expand}
          aria-expanded={expanded}
          onClick={() => {
            onToggle(row.location.locationId);
          }}
        />
      ) : (
        <span aria-hidden="true" className="location-tree-spacer" />
      )}
      <Icon
        name={icon.name}
        size={18}
        className={`location-level-icon is-${icon.tone}`}
        aria-hidden="true"
      />
      {children}
    </div>
  );
};
