import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import type { CodeAdapter } from './adapters';
import { DEFAULT_CODE_FILTERS } from './code-options';
import { ORPHAN_GROUP_KEY, groupKeyOf } from './hierarchy';
import type { CodeFilters, HierarchyCode } from './types';

const t = messages.defectCauseCode;

export interface CodeListPaneProps {
  /** 탭이 무엇인지는 어댑터만 안다 — 이 부품은 라벨과 화면 표현만 다룬다. */
  adapter: CodeAdapter;
  /** 표시 순서로 이미 정렬된 행. 디자인 시스템 `Table`의 그룹 순서가 이 배열 순서로 정해진다. */
  rows: HierarchyCode[];
  /** 그룹 판정에 쓰는 색인. 상위가 여기 없으면 그 행은 고아 그룹으로 간다. */
  byId: ReadonlyMap<number, HierarchyCode>;
  isLoading: boolean;
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: CodeFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출 */
  onApplyFilters: (next: CodeFilters) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAddCategory: () => void;
  onAddChild: () => void;
  /** 「상세 추가」를 쓸 수 있는가 — 대분류를 하나 골랐는가 */
  canAddChild: boolean;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 코드가 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

const hasAnyFilter = (filters: CodeFilters): boolean => filters.q !== '' || filters.includeInactive;

/** 좌 페인 — 코드를 대분류별로 묶어 보이고 조건으로 좁히는 자리. */
export const CodeListPane = ({
  adapter,
  rows,
  byId,
  isLoading,
  appliedFilters,
  onApplyFilters,
  selectedId,
  onSelect,
  onAddCategory,
  onAddChild,
  canAddChild,
  loadError,
}: CodeListPaneProps) => {
  const addChildNoteId = useId();

  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  // 편집 중인 값은 draft에만 있고 조건 칩에는 미러하지 않는다.
  const [draft, setDraft] = useState<CodeFilters>(appliedFilters);
  useEffect(() => {
    setDraft(appliedFilters);
  }, [appliedFilters]);

  const groupLabel = (groupKey: string): string => {
    if (groupKey === ORPHAN_GROUP_KEY) return t.groupHeaderOrphan;

    const head = byId.get(Number(groupKey));
    return head === undefined ? groupKey : t.values.groupHeader(head.code, head.name);
  };

  const columns: Column<HierarchyCode>[] = [
    {
      key: 'code',
      header: adapter.labels.code,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.id)}
        >
          {row.code}
        </button>
      ),
    },
    { key: 'name', header: adapter.labels.name },
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
      title={t.empty.codeNoMatchTitle}
      description={t.empty.codeNoMatchDescription}
      action={
        <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_CODE_FILTERS)}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.codeNoneTitle}
      description={t.empty.codeNoneDescription}
      action={<Button onClick={onAddCategory}>{t.actions.addCategory}</Button>}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.codes}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        // 행 순서 재배치(reorderable)는 쓰지 않는다 — groupBy와 병용하면 조용히 무시된다.
        groupBy={(row) => groupKeyOf(row, byId)}
        renderGroupHeader={(groupKey) => groupLabel(groupKey)}
        empty={emptySlot}
      />
    );
  };

  return (
    <section className="pane" aria-label={adapter.labels.tab}>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={adapter.labels.searchLabel}
          placeholder={adapter.labels.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
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
        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 라벨 층은 묶음이 한 번만 갖는다 — 버튼마다 붙이면 두 번 적용된다.
         */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_CODE_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
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

      <div className="filter-bar">
        <Button onClick={onAddCategory}>{t.actions.addCategory}</Button>
        {/*
         * 배치 규범 4 — 비활성 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고
         * aria-describedby로 잇는다. 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는
         * 키보드·스크린리더 사용자가 닿을 수 없다.
         */}
        <div className="field-cell">
          <Button
            variant="outlined"
            disabled={!canAddChild}
            aria-describedby={canAddChild ? undefined : addChildNoteId}
            onClick={onAddChild}
          >
            {t.actions.addChild}
          </Button>
          {!canAddChild && (
            <span id={addChildNoteId} className="field-note">
              {t.actionReasons.addChildNeedsCategory}
            </span>
          )}
        </div>
      </div>

      {listSlot()}
    </section>
  );
};
