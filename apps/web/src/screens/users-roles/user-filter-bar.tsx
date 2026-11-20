import { Button, Checkbox, Icon, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { hasChangedFilters } from '../../patterns/filter-more';

import { SelectField } from './select-field';
import type { SelectOption, UserFilters } from './types';

const t = messages.usersRoles;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_USER_FILTERS: UserFilters = {
  q: '',
  departmentId: '',
  statusCode: '',
  includeInactive: false,
};

export interface UserFilterBarProps {
  /** 적용된(주소에 반영된) 조건 */
  appliedFilters: UserFilters;
  /** 조회 버튼·Enter·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: UserFilters) => void;
  departmentOptions: SelectOption[];
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddUser: () => void;
}

/**
 * 위 조회 카드 — 수입검사 화면의 검색 묶음과 같은 자리(omf-all-around#333).
 * 소속 부서 · 검색창 · 사용 중지 계정 포함 · [조회][초기화] … [+ 사용자 추가](오른쪽 끝) 를 한 줄에(사용자 지시 2026-11-20).
 * 재직 상태는 탭 줄 오른쪽 칩이 맡는다(수입검사의 상태 칩과 같다) — 조회·초기화는 걸린 칩을 그대로 둔다.
 */
export const UserFilterBar = ({
  appliedFilters,
  onApplyFilters,
  departmentOptions,
  optionsNotice,
  isCreating,
  onAddUser,
}: UserFilterBarProps) => {
  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있다. 조건이 모두 조건 줄 · 탭 줄 칩에 보여 조건 칩을 두지 않는다(C-6 · main #1712).
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

  /*
   * 「초기화」는 바뀐 것이 있을 때만 보인다(C-6 · main #1712). 탭 줄 재직 상태 칩도 함께 푼다.
   * 누르면 초안도 함께 비운다 — 주소가 이미 처음 값이면 따라가는 effect 가 깨어나지 않는다.
   */
  const isChanged = hasChangedFilters(EMPTY_USER_FILTERS, draft, appliedFilters);
  const reset = (): void => {
    setDraft(EMPTY_USER_FILTERS);
    onApplyFilters(EMPTY_USER_FILTERS);
  };

  return (
    <>
      {optionsNotice}
      <div className="filter-bar users-roles-filter-row">
        {/* 부서 고르개는 이름이 들어가는 만큼만 — 넓은 칸(`wide`)은 빈 공간이 커서 뺐다(사용자 지시 2026-11-20 · #333). */}
        <SelectField
          label={t.filters.department}
          className="users-roles-department-select"
          searchPlaceholder={t.filters.departmentSearchPlaceholder}
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
          {isChanged && (
            <Button variant="outlined" onClick={reset}>
              {messages.common.reset}
            </Button>
          )}
        </div>

        {/* 다른 화면의 추가 단추와 같은 모양(채운 단추 + 더하기 아이콘) — 구분선 없이 줄 오른쪽 끝(사용자 지시 2026-11-20). */}
        <Button
          variant="filled"
          className="users-roles-add-user"
          leadingIcon={<Icon name="add" size={18} />}
          disabled={isCreating}
          onClick={onAddUser}
        >
          {t.actions.addUser}
        </Button>
      </div>
    </>
  );
};
