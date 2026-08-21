import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  IconButton,
  SearchInput,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { type CodeOption, defaultGroupFilters, lookupLabel } from './code-options';
import type { GroupTreeRow } from './group-tree';
import type { GroupFilters, LookupEntry } from './types';

export interface GroupListPaneProps {
  /** buildGroupRows의 결과 */
  rows: GroupTreeRow[];
  isLoading: boolean;
  /** 적용된(URL에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: GroupFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출 */
  onApplyFilters: (next: GroupFilters) => void;
  /** 공장 선택지. 미사용 공장은 지금 고른 값일 때만 남는다 */
  plantOptions: CodeOption[];
  /** 공장 이름 풀이용 원본 — 선택지가 좁혀져 있어도 조건 칩은 전체에서 이름을 찾는다 */
  plantEntries: LookupEntry[];
  expandedIds: ReadonlySet<number>;
  onToggleExpand: (equipmentGroupId: number) => void;
  selectedGroupId: number | null;
  onSelect: (equipmentGroupId: number) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 설비 그룹이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

const t = messages.equipmentMaster;

/** 들여쓰기 한 단계의 픽셀 폭. depth에 곱해 쓴다. */
const INDENT_PX = 20;

const hasAnyFilter = (filters: GroupFilters): boolean =>
  filters.q !== '' || filters.plantId !== '' || filters.includeInactive;

export const GroupListPane = ({
  rows,
  isLoading,
  appliedFilters,
  onApplyFilters,
  plantOptions,
  plantEntries,
  expandedIds,
  onToggleExpand,
  selectedGroupId,
  onSelect,
  loadError,
}: GroupListPaneProps) => {
  const plantSelectId = useId();

  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  // 편집 중인 값은 draft에만 있고 조건 칩에는 미러하지 않는다.
  const [draft, setDraft] = useState<GroupFilters>(appliedFilters);
  const {
    q: appliedQ,
    plantId: appliedPlantId,
    includeInactive: appliedIncludeInactive,
  } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, plantId: appliedPlantId, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedPlantId, appliedIncludeInactive]);

  const applyDraft = () => onApplyFilters(draft);

  /**
   * DS에 Tree 컴포넌트가 없어 Table + 들여쓰기 + 접기 버튼의 조합으로 계층을 만든다.
   * 이 조합은 화면 슬라이스가 소유한다 — 조합물은 디자인 시스템으로 올리지 않는다.
   */
  const columns: Column<GroupTreeRow>[] = [
    {
      key: 'groupCode',
      header: t.fields.groupCode,
      render: (row) => {
        const isExpanded = expandedIds.has(row.group.equipmentGroupId);

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
                aria-label={isExpanded ? t.groupTable.collapse : t.groupTable.expand}
                onClick={() => onToggleExpand(row.group.equipmentGroupId)}
              />
            ) : (
              <span aria-hidden="true" style={{ display: 'inline-block', width: '32px' }} />
            )}
            <button
              type="button"
              className="link-cell"
              aria-current={row.group.equipmentGroupId === selectedGroupId ? 'true' : undefined}
              onClick={() => onSelect(row.group.equipmentGroupId)}
            >
              {row.group.groupCode}
            </button>
          </div>
        );
      },
    },
    { key: 'groupName', header: t.fields.groupName, render: (row) => row.group.groupName },
    {
      key: 'plantId',
      header: t.fields.plant,
      render: (row) => lookupLabel(plantEntries, String(row.group.plantId)),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      render: (row) => (row.group.isActive ? t.values.active : t.values.inactive),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.groupNoMatchTitle}
      description={t.empty.groupNoMatchDescription}
      action={
        <Button variant="outlined" onClick={() => onApplyFilters(defaultGroupFilters)}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.groupNoneTitle}
      description={t.empty.groupNoneDescription}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.groups}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.group.equipmentGroupId)}
        empty={emptySlot}
      />
    );
  };

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
        <div className="field-cell">
          <label className="field-label" htmlFor={plantSelectId}>
            {t.fields.plant}
          </label>
          <Select
            id={plantSelectId}
            options={[{ value: '', label: t.filters.plantAll }, ...plantOptions]}
            value={draft.plantId}
            onChange={(value) => setDraft((prev) => ({ ...prev, plantId: value }))}
          />
        </div>
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
            }
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>
        <Button className="field-cell-unlabeled" onClick={applyDraft}>
          {messages.common.search}
        </Button>
        <Button
          className="field-cell-unlabeled"
          variant="outlined"
          onClick={() => onApplyFilters(defaultGroupFilters)}
        >
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
        {appliedFilters.plantId !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemovePlant}
            onRemove={() => onApplyFilters({ ...appliedFilters, plantId: '' })}
          >
            {t.filters.chipPlant(lookupLabel(plantEntries, appliedFilters.plantId))}
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

      {listSlot()}
    </section>
  );
};
