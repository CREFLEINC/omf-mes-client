import { Button, Chip, type Column, EmptyState, Icon, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav, type PageNavMeta } from '../../patterns/page-nav';

import { hasAnyRoleFilter, type ListPageSize } from './filters';
import type { PageView } from './pagination';
import { EMPTY_ROLE_FILTERS } from './role-filter-bar';
import type { Role, RoleFilters } from './types';

const t = messages.usersRoles;

export interface RoleListPaneProps {
  /** 목록 맨 위 제목 줄(「이름 · 건수 · 목록 접기」 · #350). 화면이 `PaneListHead` 로 넘긴다. */
  head?: ReactNode;
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
  head,
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
          rows={roles}
          getRowId={(row) => String(row.roleId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  return (
    <section className="pane users-roles-list-pane" aria-label={t.panes.roleList}>
      {head}
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
