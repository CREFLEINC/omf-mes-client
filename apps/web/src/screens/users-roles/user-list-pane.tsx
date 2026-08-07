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
import { type ReactNode, useEffect, useState } from 'react';

import { pendingCodeOptions } from './code-options';
import { clearUserFilter, hasAnyUserFilter, toUserFilterChips } from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import { SelectField } from './select-field';
import type { AppUser, SelectOption, UserFilters } from './types';

const t = messages.usersRoles;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_USER_FILTERS: UserFilters = { q: '', departmentId: '', includeInactive: false };

/**
 * 상태 조건의 선택지 — **자리표시 하나뿐이다.** 값 목록이 확정되지 않았고
 * 이 조건은 요청에 실리지도 않으므로 고른 값이라는 것 자체가 없다.
 * 모듈 상수로 고정해 매 렌더 새 참조가 만들어지지 않게 한다.
 */
const STATUS_FILTER_OPTIONS: SelectOption[] = pendingCodeOptions('');

export interface UserListPaneProps {
  users: AppUser[];
  isLoading: boolean;
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: UserFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: UserFilters) => void;
  departmentOptions: SelectOption[];
  /** 조건 칩에 낼 부서 이름. 번호를 그대로 보이면 무엇을 걸었는지 모른다 */
  departmentLabel: (departmentId: string) => string;
  /** 표의 부서 셀에 낼 이름. 값이 없으면 미지정 표기를 낸다 */
  departmentNameOf: (departmentId: number | null | undefined) => string;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedAppUserId: number | null;
  onSelect: (appUserId: number) => void;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddUser: () => void;
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
  departmentOptions,
  departmentLabel,
  departmentNameOf,
  optionsNotice,
  pageView,
  onChangePage,
  selectedAppUserId,
  onSelect,
  isCreating,
  onAddUser,
  loadError,
}: UserListPaneProps) => {
  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<UserFilters>(appliedFilters);
  useEffect(() => {
    setDraft(appliedFilters);
  }, [appliedFilters]);

  const columns: Column<AppUser>[] = [
    {
      key: 'loginId',
      header: t.user.fields.loginId,
      width: '160px',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.appUserId === selectedAppUserId ? 'true' : undefined}
          onClick={() => onSelect(row.appUserId)}
        >
          {row.loginId}
        </button>
      ),
    },
    {
      key: 'userName',
      header: t.user.fields.userName,
      render: (row) => (row.isActive ? row.userName : `${row.userName}${t.values.inactiveSuffix}`),
    },
    {
      key: 'departmentId',
      header: t.user.fields.department,
      width: '140px',
      render: (row) => departmentNameOf(row.departmentId),
    },
    {
      /*
       * 값 목록이 미정이라 **원본 문자열을 그대로** 낸다 — 이름을 지어내지 않는다.
       * 서버가 빈 값을 주는 일이 실제로 있어 미지정 표기로 받는다.
       */
      key: 'statusCode',
      header: t.user.fields.status,
      width: '112px',
      render: (row) => orEmptyMark(row.statusCode),
    },
  ];

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
        <Table
          density="compact"
          columns={columns}
          rows={users}
          getRowId={(row) => String(row.appUserId)}
          empty={emptySlot}
        />
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  const chips = toUserFilterChips(appliedFilters, departmentLabel);

  return (
    <section className="pane" aria-label={t.panes.userList}>
      {optionsNotice}

      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.userSearchLabel}
          placeholder={t.filters.userSearchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />

        {/*
         * 규범 3-2 — 「SYN-DEPT-01 · 합성 부서 A」는 트리거 폭에 갇혀 잘린다.
         * 판단 기준은 코드값이 아니라 선택지 문구 길이다.
         */}
        <SelectField
          label={t.filters.department}
          wide
          options={[{ value: '', label: t.filters.departmentAll }, ...departmentOptions]}
          value={draft.departmentId}
          onChange={(value) => setDraft((prev) => ({ ...prev, departmentId: value }))}
        />

        {/*
         * 상태 조건은 **비활성 + 사유**다(배치 규범 4). 값 목록이 확정되지 않아 고를 값이 없고,
         * 자리표시 값을 쿼리로 보내면 언제나 0건이 온다 — 그래서 조건 타입에도 자리가 없다.
         * 문구가 짧아 `.wide-select`를 붙이지 않는다(규범 3-2의 이탈 조건).
         */}
        <SelectField
          label={t.filters.status}
          options={STATUS_FILTER_OPTIONS}
          value=""
          onChange={() => undefined}
          disabled
          disabledReason={t.actionReasons.statusFilterPending}
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
          <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_USER_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

      <div className="filter-bar">
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

      {listSlot()}

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" disabled={isCreating} onClick={onAddUser}>
            {t.actions.addUser}
          </Button>
        </div>
      </div>
    </section>
  );
};
