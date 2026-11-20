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
import { type ReactNode, useEffect, useState } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav, type PageNavMeta } from '../../patterns/page-nav';

import { clearRoleFilter, hasAnyRoleFilter, type ListPageSize, toRoleFilterChips } from './filters';
import type { PageView } from './pagination';
import type { Role, RoleFilters } from './types';

const t = messages.usersRoles;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_ROLE_FILTERS: RoleFilters = { q: '', includeInactive: false };

export interface RoleFilterBarProps {
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: RoleFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: RoleFilters) => void;
  /** 등록 팝업이 이미 열려 있으면 참. 같은 창을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddRole: () => void;
}

/**
 * 위 조회 카드 — 사용자 관리 탭의 조회 묶음과 같은 자리 · 모양(사용자 지시 2026-11-20 · #333).
 * 역할 검색 · 미사용 포함 · [조회][초기화] … [+ 역할 추가](오른쪽 끝, 앞에 구분선) 를 한 줄에.
 *
 * **조건이 둘뿐이다.** 계약의 역할 목록 쿼리에 부서도 상태도 없다.
 */
export const RoleFilterBar = ({
  appliedFilters,
  onApplyFilters,
  isCreating,
  onAddRole,
}: RoleFilterBarProps) => {
  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<RoleFilters>(appliedFilters);
  const { q: appliedQ, includeInactive: appliedIncludeInactive } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedIncludeInactive]);

  const chips = toRoleFilterChips(appliedFilters);

  return (
    <>
      <div className="filter-bar users-roles-filter-row">
        <SearchInput
          containerClassName="users-roles-search-input users-roles-role-search-input"
          label={t.filters.roleSearchLabel}
          placeholder={t.filters.roleSearchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
          clearLabel={messages.common.clear}
        />

        {/* 해제 축이라 누르는 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
            }
          >
            {t.filters.roleIncludeInactive}
          </Checkbox>
        </div>

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1). */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_ROLE_FILTERS)}>
            {t.filters.roleReset}
          </Button>
        </div>

        <Button
          variant="filled"
          className="users-roles-add-user"
          leadingIcon={<Icon name="add" size={18} />}
          disabled={isCreating}
          onClick={onAddRole}
        >
          {t.actions.addRole}
        </Button>
      </div>

      {/* 걸린 조건이 없으면 빈 줄이 여백만 차지한다 — 칩이 있을 때만 줄을 둔다. */}
      {chips.length > 0 && (
        <div className="filter-bar users-roles-chip-row">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              variant="status"
              removeLabel={chip.removeLabel}
              onRemove={() => onApplyFilters(clearRoleFilter(appliedFilters, chip.key))}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};

export interface RoleListPaneProps {
  roles: Role[];
  isLoading: boolean;
  /** 적용된 조건 — 빈 상태 문구를 가른다 */
  appliedFilters: RoleFilters;
  onApplyFilters: (next: RoleFilters) => void;
  pageView: PageView;
  /** 서버가 준 쪽 정보. 받기 전에는 null — 총계를 지어내지 않는다 */
  pageMeta: PageNavMeta | null;
  onChangePage: (page: number) => void;
  /** 건수 선택(10 · 20 · 50) — 바꾸면 첫 쪽으로 간다 */
  pageSizes?: readonly ListPageSize[];
  onChangePageSize?: (size: ListPageSize) => void;
  selectedRoleId: number | null;
  onSelect: (roleId: number) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 역할이 없습니다」로 보이면 사실과 다른 안내가 되고,
   * 계약이 정한 **권한 없음의 「진입 차단 + 배너」**도 이 자리로 온다.
   */
  loadError: ReactNode;
}

/**
 * 좌 칸 — 역할을 찾아 고르는 자리. 사용자 목록과 같은 모양이다(사용자 지시 2026-11-20 · #333):
 * 머리·칸 가운데 정렬, 열 폭·순서 조절, 줄 아무 곳이나 눌러 고르고 다시 누르면 풀린다, 아래 건수 · 쪽 이동.
 *
 * **열은 셋이다**(역할 코드·역할명·상태). 상태 열이 사용 여부를 낸다 — 계약이 역할에 준 필드가 `isActive` 하나뿐이다.
 *
 * **정렬 가능한 열도 선택 열도 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없고
 * 일괄로 할 쓰기가 없다 — 눌러도 아무 일이 없는 칸이 된다.
 */
export const RoleListPane = ({
  roles,
  isLoading,
  appliedFilters,
  onApplyFilters,
  pageView,
  pageMeta,
  onChangePage,
  pageSizes,
  onChangePageSize,
  selectedRoleId,
  onSelect,
  loadError,
}: RoleListPaneProps) => {
  const baseColumns: Column<Role>[] = [
    {
      key: 'roleCode',
      align: 'center',
      header: t.role.fields.roleCode,
      width: '176px',
      /* 링크처럼 보이지 않는다 — 줄 아무 곳이나 눌러 고른다. 이 단추는 키보드·화면 낭독기의 자리다. */
      render: (row) => (
        <button
          type="button"
          className="users-roles-row-pick"
          aria-current={row.roleId === selectedRoleId ? 'true' : undefined}
          onClick={() => onSelect(row.roleId)}
        >
          {row.roleCode}
        </button>
      ),
    },
    {
      key: 'roleName',
      align: 'center',
      header: t.role.fields.roleName,
      render: (row) => row.roleName,
    },
    {
      key: 'isActive',
      align: 'center',
      header: t.role.fields.status,
      width: '112px',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.values.active : t.values.inactive}
        </Chip>
      ),
    },
  ];
  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(사용자 목록과 같다). */
  const ordered = useColumnOrder('omf-mes:users-roles:columns:roles:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:users-roles:columns:roles', ordered);
  const fit = useFitColumns(resizable.columns);

  /**
   * 빈 상태는 세 갈래다 — **셋을 뭉치면 사실과 다른 안내가 된다.**
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다. ② 조건이 걸린 0건: 조건을 줄이면 나올 수 있다.
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

    if (hasAnyRoleFilter(appliedFilters)) {
      return (
        <EmptyState
          size="sm"
          live
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="search_off" size={20} />
            </span>
          }
          title={t.role.empty.noMatchTitle}
          description={t.role.empty.noMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_ROLE_FILTERS)}>
              {t.filters.roleReset}
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
            <Icon name="badge" size={20} />
          </span>
        }
        title={t.role.empty.noneTitle}
        description={t.role.empty.noneDescription}
      />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.roles}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      /* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 단추로 넘긴다(사용자 목록과 같다). */
      <div
        ref={fit.ref}
        className="users-roles-list inspection-queue-table"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
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
          rows={roles}
          getRowId={(row) => String(row.roleId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  return (
    <section className="pane users-roles-list-pane" aria-label={t.panes.roleList}>
      <div className="users-roles-list-body">{listSlot()}</div>
      {pageMeta !== null && (loadError === null || loadError === undefined) && (
        <PageNav
          meta={pageMeta}
          sizes={pageSizes}
          buttonSize="md"
          onChangePage={onChangePage}
          onChangeSize={onChangePageSize}
        />
      )}
    </section>
  );
};
