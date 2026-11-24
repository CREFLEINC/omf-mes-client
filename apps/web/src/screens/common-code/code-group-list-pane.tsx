import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  Icon,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { hasChangedFilters } from '../../patterns/filter-more';
import {
  FIT_PLACEHOLDER_CLASS,
  useFitPlaceholderWidth,
} from '../../patterns/fit-placeholder-width';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav, type PageNavMeta } from '../../patterns/page-nav';
import { hasAnyFilter, LIST_PAGE_SIZES, type ListPageSize } from './filters';
import type { PageView } from './pagination';
import type { CodeGroup, CodeGroupFilters } from './types';

const t = messages.commonCode;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_CODE_GROUP_FILTERS: CodeGroupFilters = { q: '', includeInactive: false };

export interface CodeGroupListPaneProps {
  codeGroups: CodeGroup[];
  isLoading: boolean;
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: CodeGroupFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: CodeGroupFilters) => void;
  pageView: PageView;
  /** 서버가 준 쪽 정보. 받기 전 · 실패면 `null` — 셀 것이 없으면 쪽 이동을 그리지 않는다. */
  pageMeta: PageNavMeta | null;
  onChangePage: (page: number) => void;
  /** 쪽 크기(10 · 20 · 50) — 바꾸면 첫 쪽으로 간다(단말 관리와 같다 · omf-all-around#358). */
  onChangePageSize: (size: ListPageSize) => void;
  selectedCodeGroupId: number | null;
  onSelect: (codeGroupId: number) => void;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddCodeGroup: () => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 코드그룹이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
  /**
   * 조회 조건 · 목록을 화면이 따로 세울 때(통일 배치 · #350) 두 조각을 받아 배치한다.
   * 없으면 한 구획 안에 조건 줄 · 목록을 차례로 둔다 — 화면은 늘 넘기고, 목록 부품만 따로 그리는 부품 시험이 빈 채로 쓴다.
   */
  layout?: (parts: { filter: ReactNode; list: ReactNode }) => ReactNode;
}

/**
 * 좌 페인 — 코드그룹을 찾아 고르는 자리.
 *
 * **열은 둘뿐이다**(그룹코드·그룹명). 「사용 여부」를 열로 두지 않고 이름 뒤 접미로 붙인다 —
 * 좁은 좌 페인에서 열 하나를 더 두면 이름 열이 짓눌린다(결정 11).
 *
 * **정렬 가능한 열을 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없어
 * 화면이 정렬하면 지금 쪽 안에서만 도는 정렬이 되어 사용자를 속인다.
 */
export const CodeGroupListPane = ({
  codeGroups,
  isLoading,
  appliedFilters,
  onApplyFilters,
  pageView,
  pageMeta,
  onChangePage,
  onChangePageSize,
  selectedCodeGroupId,
  onSelect,
  isCreating,
  onAddCodeGroup,
  loadError,
  layout,
}: CodeGroupListPaneProps) => {
  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<CodeGroupFilters>(appliedFilters);
  const searchRef = useFitPlaceholderWidth(t.filters.codeGroupSearchPlaceholder);
  const { q: appliedQ, includeInactive: appliedIncludeInactive } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedIncludeInactive]);

  /* 머리글과 칸은 가운데 — 단말 관리 목록과 같다(omf-all-around#358). */
  const baseColumns: Column<CodeGroup>[] = [
    {
      key: 'groupCode',
      align: 'center',
      header: t.codeGroup.fields.groupCode,
      width: '160px',
      render: (row) => (
        <button
          type="button"
          className="users-roles-row-pick"
          aria-current={row.codeGroupId === selectedCodeGroupId ? 'true' : undefined}
          onClick={() => onSelect(row.codeGroupId)}
        >
          {row.groupCode}
        </button>
      ),
    },
    {
      key: 'groupName',
      align: 'center',
      header: t.codeGroup.fields.groupName,
      render: (row) =>
        row.isActive ? row.groupName : `${row.groupName}${t.values.inactiveSuffix}`,
    },
  ];
  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(단말 관리 목록과 같다 · omf-all-around#358). */
  const ordered = useColumnOrder('omf-mes:common-code:columns:code-groups:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:common-code:columns:code-groups', ordered);
  const fit = useFitColumns(resizable.columns);

  /**
   * 빈 상태는 세 갈래다 — **셋을 뭉치면 사실과 다른 안내가 된다.**
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생기며
   *   「등록된 것이 없다」로 내면 거짓말이 된다 — 돌아갈 길(첫 쪽으로)을 함께 준다.
   * ② 조건이 걸린 0건: 조건을 줄이면 나올 수 있다.
   * ③ 조건 없는 0건: 정말로 아무것도 없다.
   *
   * ①을 먼저 본다. 범위 밖은 `total > 0`일 때만 참이라 ②·③과 겹치지 않는다.
   */
  const emptySlot = ((): ReactNode => {
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="last_page" size={20} />
            </span>
          }
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={() => onChangePage(1)}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    if (hasAnyFilter(appliedFilters)) {
      return (
        <EmptyState
          size="sm"
          live
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="search_off" size={20} />
            </span>
          }
          title={t.codeGroup.empty.noMatchTitle}
          description={t.codeGroup.empty.noMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_CODE_GROUP_FILTERS)}>
              {messages.common.reset}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        icon={
          <span className="inspection-standard-empty-icon">
            <Icon name="folder_open" size={20} />
          </span>
        }
        title={t.codeGroup.empty.noneTitle}
        description={t.codeGroup.empty.noneDescription}
      />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.codeGroups}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      /* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 단추로 넘긴다(단말 관리와 같다). */
      <div
        ref={fit.ref}
        className="users-roles-list inspection-queue-table"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.users-roles-row-pick')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={codeGroups}
          getRowId={(row) => String(row.codeGroupId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  /* 조건 칸이 모두 줄에 보여 칩을 따로 두지 않는다(C-6). 「초기화」는 바뀐 것이 있을 때만 보인다. */
  const isChanged = hasChangedFilters(EMPTY_CODE_GROUP_FILTERS, draft, appliedFilters);

  const filter = (
    <>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar common-code-filter">
        <SearchInput
          containerClassName={FIT_PLACEHOLDER_CLASS}
          label={t.filters.codeGroupSearchLabel}
          placeholder={t.filters.codeGroupSearchPlaceholder}
          ref={searchRef}
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
         * 갈라지면 남은 버튼이 무엇에 딸린 것인지 읽히지 않는다.
         */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          {isChanged && (
            <Button
              variant="outlined"
              onClick={() => {
                setDraft(EMPTY_CODE_GROUP_FILTERS);
                onApplyFilters(EMPTY_CODE_GROUP_FILTERS);
              }}
            >
              {messages.common.reset}
            </Button>
          )}
          <span className="inspection-standard-filter-divider" aria-hidden />
          <Button
            leadingIcon={<Icon name="add" size={18} />}
            disabled={isCreating}
            onClick={onAddCodeGroup}
          >
            {t.actions.addCodeGroup}
          </Button>
        </div>
      </div>
    </>
  );

  const list = (
    <>
      <div className="users-roles-list-body">{listSlot()}</div>
      {pageMeta !== null && (loadError === null || loadError === undefined) && (
        <PageNav<ListPageSize>
          meta={pageMeta}
          sizes={LIST_PAGE_SIZES}
          buttonSize="md"
          onChangePage={onChangePage}
          onChangeSize={onChangePageSize}
        />
      )}
    </>
  );

  if (layout !== undefined) return layout({ filter, list });

  return (
    <section className="pane" aria-label={t.panes.codeGroup}>
      {filter}
      {list}
    </section>
  );
};
