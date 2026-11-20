import { Button, Checkbox, Icon, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { hasChangedFilters } from '../../patterns/filter-more';

import type { RoleFilters } from './types';

const t = messages.usersRoles;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_ROLE_FILTERS: RoleFilters = { q: '', includeInactive: false, status: '' };

export interface RoleFilterBarProps {
  /** 적용된(주소에 반영된) 조건 */
  appliedFilters: RoleFilters;
  /** 조회 버튼·Enter·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
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
   * 편집 중인 값은 draft에만 있다. 조건이 모두 조건 줄 · 탭 줄 라벨에 보여 조건 칩을 두지 않는다(C-6 · main #1712).
   */
  const [draft, setDraft] = useState<RoleFilters>(appliedFilters);
  const {
    q: appliedQ,
    includeInactive: appliedIncludeInactive,
    status: appliedStatus,
  } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, includeInactive: appliedIncludeInactive, status: appliedStatus });
  }, [appliedQ, appliedIncludeInactive, appliedStatus]);

  /*
   * 「초기화」는 바뀐 것이 있을 때만 보인다(C-6 · main #1712). 누르면 초안도 함께 비운다 — 주소가 이미 처음 값이면
   * 주소가 바뀌지 않아 따라가는 effect 가 깨어나지 않고, 치던 값이 그대로 남는다.
   */
  const isChanged = hasChangedFilters(EMPTY_ROLE_FILTERS, draft, appliedFilters);
  const reset = (): void => {
    setDraft(EMPTY_ROLE_FILTERS);
    onApplyFilters(EMPTY_ROLE_FILTERS);
  };

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
          {isChanged && (
            <Button variant="outlined" onClick={reset}>
              {t.filters.roleReset}
            </Button>
          )}
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
    </>
  );
};
