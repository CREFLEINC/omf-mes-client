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

import { clearUserFilter, hasAnyUserFilter, toUserFilterChips } from './filters';
import type { PageView } from './pagination';
import { SelectField } from './select-field';
import type { AppUser, SelectOption, UserFilters } from './types';

const t = messages.usersRoles;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_USER_FILTERS: UserFilters = {
  q: '',
  departmentId: '',
  statusCode: '',
  includeInactive: false,
};

export interface UserFilterBarProps {
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: UserFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: UserFilters) => void;
  departmentOptions: SelectOption[];
  /** 조건 칩에 낼 부서 이름. 번호를 그대로 보이면 무엇을 걸었는지 모른다 */
  departmentLabel: (departmentId: string) => string;
  statusNameOf: (statusCode: string) => string;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddUser: () => void;
}

/**
 * 위 조회 카드 — 수입검사 화면의 검색 묶음과 같은 자리(omf-all-around#333).
 * 소속 부서 · 검색창 · 사용 중지 계정 포함 · [조회][초기화] | [+ 사용자 추가] 를 한 줄에(사용자 지시 2026-11-20).
 * 재직 상태는 탭 줄 오른쪽 칩이 맡는다(수입검사의 상태 칩과 같다) — 조회·초기화는 걸린 칩을 그대로 둔다.
 */
export const UserFilterBar = ({
  appliedFilters,
  onApplyFilters,
  departmentOptions,
  departmentLabel,
  statusNameOf,
  optionsNotice,
  isCreating,
  onAddUser,
}: UserFilterBarProps) => {
  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<UserFilters>(appliedFilters);
  const {
    q: appliedQ,
    departmentId: appliedDepartmentId,
    statusCode: appliedStatusCode,
    includeInactive: appliedIncludeInactive,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      q: appliedQ,
      departmentId: appliedDepartmentId,
      statusCode: appliedStatusCode,
      includeInactive: appliedIncludeInactive,
    });
  }, [appliedQ, appliedDepartmentId, appliedStatusCode, appliedIncludeInactive]);

  /* 재직 상태 칩은 탭 줄에 있으니 여기서 겹쳐 세우지 않는다. */
  const chips = toUserFilterChips(appliedFilters, departmentLabel, statusNameOf).filter(
    (chip) => chip.key !== 'statusCode',
  );

  return (
    <>
      {optionsNotice}
      <div className="filter-bar users-roles-filter-row">
        {/* 규범 3-2 — 「SYN-DEPT-01 · 합성 부서 A」는 트리거 폭에 갇혀 잘린다. */}
        <SelectField
          label={t.filters.department}
          wide
          options={[{ value: '', label: t.filters.departmentAll }, ...departmentOptions]}
          value={draft.departmentId}
          onChange={(value) => setDraft((prev) => ({ ...prev, departmentId: value }))}
        />

        <SearchInput
          containerClassName="users-roles-search-input"
          label={t.filters.userSearchLabel}
          placeholder={t.filters.userSearchPlaceholder}
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
            {t.filters.includeInactive}
          </Checkbox>
        </div>

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1). 초기화는 재직 상태 칩도 함께 푼다. */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters({ ...draft, statusCode: appliedStatusCode })}>
            {messages.common.search}
          </Button>
          <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_USER_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>

        {/* 다른 화면의 추가 단추와 같은 모양 — 구분선 뒤 채운 단추 + 더하기 아이콘(사용자 지시 2026-11-20). */}
        <span className="inspection-standard-filter-divider" aria-hidden />
        <Button
          variant="filled"
          leadingIcon={<Icon name="add" size={18} />}
          disabled={isCreating}
          onClick={onAddUser}
        >
          {t.actions.addUser}
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
              onRemove={() => onApplyFilters(clearUserFilter(appliedFilters, chip.key))}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};

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
      render: (row) => (row.statusCode === '' ? orEmptyMark('') : statusNameOf(row.statusCode)),
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
         * 고른 줄 표시는 `app.css` 의 `.users-roles-list` 가 그린다 — `Table` 이 행 선택 표시를 주지 않는다.
         * 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 단추로 넘긴다(수입검사 목록과 같다).
         */}
        <div
          ref={fit.ref}
          className="users-roles-list"
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
        <PageNav meta={pageMeta} buttonSize="md" onChangePage={onChangePage} />
      )}
    </section>
  );
};
