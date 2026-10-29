import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  Icon,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
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

/** 빈 상태의 둥근 바탕 아이콘 — 검사 기준 탭과 같다(#208). */
const emptyIcon = (name: string) => (
  <span className="inspection-standard-empty-icon">
    <Icon name={name} size={20} />
  </span>
);

/**
 * 조회 카드 + 좌 페인 — 코드를 대분류별로 묶어 보이고 조건으로 좁히는 자리.
 * 조회 카드는 검사 기준 탭처럼 목록·상세 위 한 줄로 선다(#208) — 화면이 두 칸 격자의 첫 줄 전체로 펼친다.
 */
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
  const { q: appliedQ, includeInactive: appliedIncludeInactive } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedIncludeInactive]);

  const groupLabel = (groupKey: string): string => {
    if (groupKey === ORPHAN_GROUP_KEY) return t.groupHeaderOrphan;

    const head = byId.get(Number(groupKey));
    return head === undefined ? groupKey : t.values.groupHeader(head.code, head.name);
  };

  /* 목록 표는 모든 열을 가운데 정렬한다 — 검사 기준 탭과 같다(#208). */
  const columns: Column<HierarchyCode>[] = [
    {
      key: 'code',
      align: 'center',
      header: adapter.labels.code,
      width: '120px',
      /*
       * 코드는 링크 모양 없이 본문 글자 — 줄 아무 곳이나 눌러 고른다(검사 기준 탭과 같다 · #208).
       * 단추는 남긴다: 키보드·화면 낭독기가 줄을 고르는 길이고, 고른 줄 표시(`aria-current`)가 여기 실린다.
       */
      render: (row) => (
        <button
          type="button"
          className="defect-cause-open"
          title={row.code}
          aria-current={row.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.id)}
        >
          {row.code}
        </button>
      ),
    },
    {
      key: 'name',
      align: 'center',
      header: adapter.labels.name,
      /* 폭을 정하지 않는다 — 남는 폭을 명칭 열이 맡는다(검사 기준 탭과 같다 · #208). */
      render: (row) => <span title={row.name}>{row.name}</span>,
    },
    {
      key: 'isActive',
      align: 'center',
      header: t.fields.isActive,
      width: '88px',
      /* 사용/미사용을 글자 + 색으로 가른다(#208). */
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.values.active : t.values.inactive}
        </Chip>
      ),
    },
  ];

  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다 — 검사 기준 탭 목록과 같다(#208). 두 탭은 열이 같아 함께 쓴다. */
  const ordered = useColumnOrder('omf-mes:defect-cause-code:columns:list:order', columns);
  const resizable = useColumnWidths('omf-mes:defect-cause-code:columns:list', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      icon={emptyIcon('search')}
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
      icon={emptyIcon('assignment')}
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
      /*
       * 둥근 테두리 표 상자 — 검사 기준 탭과 같다(#208).
       * 줄 아무 곳이나 눌러도 고른다 — 눌린 줄의 코드 단추로 넘긴다. 대분류 머리 줄에는 단추가 없어 그대로다.
       */
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-table-box defect-cause-rows"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.defect-cause-open')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={rows}
          getRowId={(row) => String(row.id)}
          // 행 순서 재배치(reorderable)는 쓰지 않는다 — groupBy와 병용하면 조용히 무시된다.
          groupBy={(row) => groupKeyOf(row, byId)}
          renderGroupHeader={(groupKey) => groupLabel(groupKey)}
          empty={emptySlot}
        />
      </div>
    );
  };

  const hasChips = appliedFilters.q !== '' || appliedFilters.includeInactive;

  return (
    <>
      {/*
       * 조회 카드 — 검사 기준 탭처럼 한 줄: 검색 · 미사용 포함 → 조회 · 초기화 → 구분선 → 대분류 추가 · 상세 추가(#208).
       * 결과가 없어도 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다.
       */}
      <section className="pane defect-cause-search" role="search">
        <div className="filter-bar">
          <SearchInput
            label={adapter.labels.searchLabel}
            placeholder={adapter.labels.searchPlaceholder}
            value={draft.q}
            onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
            onSearch={(value) => onApplyFilters({ ...draft, q: value })}
            clearLabel={messages.common.clear}
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
            <Button variant="filled" onClick={() => onApplyFilters(draft)}>
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_CODE_FILTERS)}>
              {messages.common.reset}
            </Button>
            <span className="inspection-standard-filter-divider" aria-hidden />
            <Button
              variant="filled"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={onAddCategory}
            >
              {t.actions.addCategory}
            </Button>
            {/*
             * 비활성 사유는 줄 높이를 늘리지 않게 글로는 감추고 마우스를 올리면 보인다(검사 기준 탭과 같다 · #208).
             * 화면 낭독기에는 aria-describedby로 잇는다 — 비활성 컨트롤은 포커스를 받지 못한다(배치 규범 4).
             */}
            <span
              className="defect-cause-reason"
              title={canAddChild ? undefined : t.actionReasons.addChildNeedsCategory}
            >
              <Button
                variant="outlined"
                leadingIcon={<Icon name="add" size={18} />}
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
            </span>
          </div>
        </div>

        {/* 적용된 조건 칩 — 있을 때만 줄을 세운다(빈 줄 여백을 남기지 않는다 · #208). */}
        {hasChips && (
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
        )}
      </section>

      <section
        className="pane defect-cause-list-pane"
        aria-label={t.panes.list(adapter.labels.tab)}
      >
        <h2 className="pane-title">{t.panes.list(adapter.labels.tab)}</h2>
        {listSlot()}
      </section>
    </>
  );
};
