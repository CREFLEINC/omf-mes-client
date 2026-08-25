import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  IconButton,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import type { LookupSource } from '../../patterns/lookup-display';
import { type CodeOption, defaultGroupFilters, groupTypeLabel, lookupLabel } from './code-options';
import type { GroupTreeRow } from './group-tree';
import { SelectField } from './select-field';
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
  plants: LookupSource<LookupEntry>;
  expandedIds: ReadonlySet<number>;
  onToggleExpand: (equipmentGroupId: number) => void;
  selectedGroupId: number | null;
  onSelect: (equipmentGroupId: number) => void;
  /** 빈 상태에서 등록으로 이끄는 주 액션 */
  onAddGroup: () => void;
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

/**
 * 「조회」를 눌러야 나가는 조건. **체크칸은 여기 없다** — 바꾸는 즉시 나간다.
 * 한 벌을 나눠 가지면 두 축이 서로를 되돌린다(client#316 · client#314).
 */
interface GroupDraftFilters {
  q: string;
  plantId: string;
}

const groupDraftOf = (filters: GroupFilters): GroupDraftFilters => ({
  q: filters.q,
  plantId: filters.plantId,
});

export const GroupListPane = ({
  rows,
  isLoading,
  appliedFilters,
  onApplyFilters,
  plantOptions,
  plants,
  expandedIds,
  onToggleExpand,
  selectedGroupId,
  onSelect,
  onAddGroup,
  loadError,
}: GroupListPaneProps) => {
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  // 편집 중인 값은 draft에만 있고 조건 칩에는 미러하지 않는다.
  const [draft, setDraft] = useState<GroupDraftFilters>(groupDraftOf(appliedFilters));
  const { q: appliedQ, plantId: appliedPlantId } = appliedFilters;

  /* 밖에서 조건이 되돌려지면(초기화·칩 제거) 초안도 그것을 따라간다. */
  useEffect(() => {
    setDraft({ q: appliedQ, plantId: appliedPlantId });
  }, [appliedQ, appliedPlantId]);

  /** 초안을 지금 적용된 조건 «위에» 얹는다 — 즉시 적용된 체크칸을 건드리지 않는다. */
  const applyDraft = (overrides: Partial<GroupDraftFilters> = {}): void => {
    onApplyFilters({ ...appliedFilters, ...draft, ...overrides });
  };

  /* ⛔ 초안을 손으로 거둔다 — 효과는 «적용된 값이 달라졌을 때»만 돈다(client#316). */
  const resetAll = (): void => {
    setDraft(groupDraftOf(defaultGroupFilters));
    onApplyFilters(defaultGroupFilters);
  };

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
      key: 'groupTypeCode',
      header: t.fields.groupType,
      render: (row) => groupTypeLabel(row.group.groupTypeCode),
    },
    {
      key: 'plantId',
      header: t.fields.plant,
      render: (row) => lookupLabel(plants, String(row.group.plantId)),
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
        <Button variant="outlined" onClick={resetAll}>
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
      action={<Button onClick={onAddGroup}>{t.actions.addGroup}</Button>}
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
          onSearch={(value) => applyDraft({ q: value })}
        />
        {/* 같은 화면 안에서 라벨 붙은 선택칸을 두 가지로 만들지 않는다 — 부품 하나가 그 규약을 갖는다. */}
        <SelectField
          label={t.fields.plant}
          options={[{ value: '', label: t.filters.plantAll }, ...plantOptions]}
          value={draft.plantId}
          onChange={(value) => setDraft((prev) => ({ ...prev, plantId: value }))}
        />
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
        <Button className="field-cell-unlabeled" onClick={() => applyDraft()}>
          {messages.common.search}
        </Button>
        <Button className="field-cell-unlabeled" variant="outlined" onClick={resetAll}>
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
            {t.filters.chipPlant(lookupLabel(plants, appliedFilters.plantId))}
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
