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

import { clearRoleFilter, hasAnyRoleFilter, toRoleFilterChips } from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { Role, RoleFilters } from './types';

const t = messages.usersRoles;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_ROLE_FILTERS: RoleFilters = { q: '', includeInactive: false };

export interface RoleListPaneProps {
  roles: Role[];
  isLoading: boolean;
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: RoleFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: RoleFilters) => void;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedRoleId: number | null;
  onSelect: (roleId: number) => void;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddRole: () => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 역할이 없습니다」로 보이면 사실과 다른 안내가 되고,
   * 계약이 정한 **권한 없음의 「진입 차단 + 배너」**도 이 자리로 온다.
   */
  loadError: ReactNode;
}

/**
 * 좌 페인 — 역할을 찾아 고르는 자리.
 *
 * **열은 셋이다**(역할 코드·역할명·상태). 사용자 표와 달리 **상태 열이 사용 여부를 낸다** —
 * 계약이 역할에 준 필드가 `isActive` 하나뿐이라 상태 코드라는 다른 값이 없다.
 * 그래서 사용 여부를 이름 뒤 접미로 밀어낼 이유도 없다.
 *
 * **조건이 둘뿐이다.** 계약의 역할 목록 쿼리에 부서도 상태도 없다 — 사용자 탭의 조건 줄을
 * 그대로 베끼면 **계약에 없는 쿼리**가 실리거나 누를 수 없는 칸이 이유 없이 는다.
 *
 * **`.wide-table`을 붙이지 않는다.** 좌 칸의 최소 폭이 320px인데 그 클래스의 최소 폭은 928px이라
 * 언제나 가로 스크롤이 생긴다.
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
  onChangePage,
  selectedRoleId,
  onSelect,
  isCreating,
  onAddRole,
  loadError,
}: RoleListPaneProps) => {
  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<RoleFilters>(appliedFilters);
  const { q: appliedQ, includeInactive: appliedIncludeInactive } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedIncludeInactive]);

  const columns: Column<Role>[] = [
    {
      key: 'roleCode',
      header: t.role.fields.roleCode,
      width: '176px',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.roleId === selectedRoleId ? 'true' : undefined}
          onClick={() => onSelect(row.roleId)}
        >
          {row.roleCode}
        </button>
      ),
    },
    {
      key: 'roleName',
      header: t.role.fields.roleName,
      render: (row) => row.roleName,
    },
    {
      key: 'isActive',
      header: t.role.fields.status,
      width: '96px',
      render: (row) => (row.isActive ? t.values.active : t.values.inactive),
    },
  ];

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
          title={t.role.empty.noMatchTitle}
          description={t.role.empty.noMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_ROLE_FILTERS)}>
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
      <>
        <Table
          density="compact"
          columns={columns}
          rows={roles}
          getRowId={(row) => String(row.roleId)}
          empty={emptySlot}
        />
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  const chips = toRoleFilterChips(appliedFilters);

  return (
    <section className="pane" aria-label={t.panes.roleList}>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.roleSearchLabel}
          placeholder={t.filters.roleSearchPlaceholder}
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
         * 갈라지면 남은 버튼이 무엇에 딸린 것인지 읽히지 않는다.
         */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_ROLE_FILTERS)}>
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
            onRemove={() => onApplyFilters(clearRoleFilter(appliedFilters, chip.key))}
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      {listSlot()}

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" disabled={isCreating} onClick={onAddRole}>
            {t.actions.addRole}
          </Button>
        </div>
      </div>
    </section>
  );
};
