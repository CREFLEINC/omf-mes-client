import { Button, Chip, type Column, EmptyState, Icon, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav, type PageNavMeta } from '../../patterns/page-nav';

import { hasAnyUserFilter } from './filters';
import type { ListPageSize } from './filters';
import type { PageView } from './pagination';
import type { AppUser, UserFilters } from './types';
import { EMPTY_USER_FILTERS } from './user-filter-bar';

const t = messages.usersRoles;

export interface UserListPaneProps {
  users: AppUser[];
  isLoading: boolean;
  /** 적용된 조건 — 빈 상태 문구를 가른다 */
  appliedFilters: UserFilters;
  onApplyFilters: (next: UserFilters) => void;
  /** 표의 부서 셀에 낼 이름. 값이 없으면 미지정 표기를 낸다 */
  departmentNameOf: (departmentId: number | null | undefined) => string;
  /** 상태 코드의 표시명. 값 목록에 없으면 숫자·코드 대신 공통 「알 수 없음」을 낸다. */
  statusNameOf: (statusCode: string) => string;
  pageView: PageView;
  /** 서버가 준 쪽 정보. 받기 전·실패면 `null` — 셀 것이 없으면 쪽 이동을 그리지 않는다. */
  pageMeta: PageNavMeta | null;
  onChangePage: (page: number) => void;
  /** 건수 선택(10 · 20 · 50) — 바꾸면 첫 쪽으로 간다(사용자 지시 2026-11-20 · #333). */
  pageSizes?: readonly ListPageSize[];
  onChangePageSize?: (size: ListPageSize) => void;
  selectedAppUserId: number | null;
  onSelect: (appUserId: number) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 사용자가 없습니다」로 보이면 사실과 다른 안내가 되고,
   * 계약이 정한 **권한 없음의 「진입 차단 + 배너」**도 이 자리로 온다.
   */
  loadError: ReactNode;
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
/*
 * 재직 상태 라벨 색 — 초기 시드 세 값만 색을 정하고, 고객이 늘린 값은 중립색이다(값 목록은 고정하지 않는다).
 * 표 안에서 상태가 한눈에 갈리도록 라벨로 낸다(사용자 지시 2026-11-20 · #333).
 */
const STATUS_TONE: Record<string, 'success' | 'warning' | 'idle'> = {
  EMPLOYED: 'success',
  ON_LEAVE: 'warning',
  RESIGNED: 'idle',
};

const orEmptyMark = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 좌 페인 — 사용자를 찾아 고르는 자리.
 *
 * **열은 넷이다**(로그인 ID·이름·부서·상태). 「사용 여부」는 열로 두지 않고 **이름 뒤 접미**로 붙인다 —
 * 좁은 좌 페인에서 열 하나를 더 두면 이름 열이 짓눌리고, 상태 열에 함께 넣으면
 * 서버가 준 상태 코드와 사용 여부라는 **다른 두 값**이 한 칸에서 섞인다.
 *
 * **`.wide-table`을 붙이지 않는다.** 좌 칸의 최소 폭이 320px인데 그 클래스의 최소 폭은 928px이라
 * 언제나 가로 스크롤이 생긴다.
 *
 * **정렬 가능한 열을 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없어
 * 화면이 정렬하면 지금 쪽 안에서만 도는 정렬이 되어 사용자를 속인다.
 *
 * **선택 열을 두지 않는다.** 일괄로 할 쓰기가 계약에 없다 — 눌러도 아무 일이 없는 칸이 된다.
 */
export const UserListPane = ({
  users,
  isLoading,
  appliedFilters,
  onApplyFilters,
  departmentNameOf,
  statusNameOf,
  pageView,
  pageMeta,
  onChangePage,
  pageSizes,
  onChangePageSize,
  selectedAppUserId,
  onSelect,
  loadError,
}: UserListPaneProps) => {
  /* 머리글과 셀을 가운데로 맞춘다(사용자 요청 2026-09-18) — 열 정렬은 DS `Column.align` 으로만 한다. */
  const baseColumns: Column<AppUser>[] = [
    {
      key: 'loginId',
      align: 'center',
      header: t.user.fields.loginId,
      width: '160px',
      /*
       * 링크처럼 보이지 않는다(사용자 지시 2026-11-20 · omf-all-around#333) — 줄 아무 곳이나 눌러 고른다.
       * 이 단추는 키보드·화면 낭독기가 줄을 고르는 자리로만 남는다(수입검사 목록과 같다).
       */
      render: (row) => (
        <button
          type="button"
          className="users-roles-row-pick"
          aria-current={row.appUserId === selectedAppUserId ? 'true' : undefined}
          onClick={() => onSelect(row.appUserId)}
        >
          {row.loginId}
        </button>
      ),
    },
    {
      key: 'userName',
      align: 'center',
      header: t.user.fields.userName,
      render: (row) => (row.isActive ? row.userName : `${row.userName}${t.values.inactiveSuffix}`),
    },
    {
      key: 'departmentId',
      align: 'center',
      header: t.user.fields.department,
      width: '140px',
      render: (row) => departmentNameOf(row.departmentId),
    },
    {
      key: 'statusCode',
      align: 'center',
      header: t.user.fields.status,
      width: '112px',
      render: (row) =>
        row.statusCode === '' ? (
          orEmptyMark('')
        ) : (
          <Chip variant="status" size="sm" status={STATUS_TONE[row.statusCode] ?? 'idle'}>
            {statusNameOf(row.statusCode)}
          </Chip>
        ),
    },
  ];
  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(다른 목록과 같다 · 사용자 지시 2026-11-20). */
  const ordered = useColumnOrder('omf-mes:users-roles:columns:users:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:users-roles:columns:users', ordered);
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

    if (hasAnyUserFilter(appliedFilters)) {
      return (
        <EmptyState
          size="sm"
          live
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="search_off" size={20} />
            </span>
          }
          title={t.user.empty.noMatchTitle}
          description={t.user.empty.noMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_USER_FILTERS)}>
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
            <Icon name="group" size={20} />
          </span>
        }
        title={t.user.empty.noneTitle}
        description={t.user.empty.noneDescription}
      />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.users}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        {/*
         * `inspection-queue-table` — 수입검사 목록과 같은 머리 · 칸 가운데 정렬(열 손잡이가 있어도 이름이 칸 가운데).
         * 고른 줄 표시는 `app.css` 의 `.users-roles-list` 가 그린다 — `Table` 이 행 선택 표시를 주지 않는다.
         * 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 단추로 넘긴다(수입검사 목록과 같다).
         */}
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
            rows={users}
            getRowId={(row) => String(row.appUserId)}
            empty={emptySlot}
          />
        </div>
      </>
    );
  };

  return (
    <section className="pane users-roles-list-pane" aria-label={t.panes.userList}>
      <div className="users-roles-list-body">{listSlot()}</div>
      {pageMeta !== null && loadError === null && (
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
