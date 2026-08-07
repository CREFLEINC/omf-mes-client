import {
  AlertBanner,
  Breadcrumb,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { lookupLabel, selectableOptions } from './code-options';
import { DeactivateDialog } from './deactivate-dialog';
import { readPage, readSelectedId, readUserFilters, toUserSearchParams } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { useDepartmentOptions, useRoleOptions, type LookupResult } from './lookups';
import { toPageView } from './pagination';
import {
  isSameRoleSelection,
  roleCatalogOrder,
  toRoleAssignDraft,
  toRoleChoices,
  toRolesPayload,
  toggleRoleId,
} from './role-assign-draft';
import { RoleAssignPane } from './role-assign-pane';
import { USERS_ROLES_TABS, resolveTab, tabSearchParams } from './tabs';
import { UserFormPane } from './user-form-pane';
import { UserListPane } from './user-list-pane';
import {
  appUserToFormValues,
  emptyUserFormValues,
  isSameUserValues,
  toAppUserCreate,
  toAppUserUpdate,
} from './user-mappers';
import {
  useUserDetail,
  useUserList,
  useUserRoles,
  userDetailPath,
  userKeys,
} from './user-queries';
import { USER_FORM_FIELDS, validateUserForm } from './user-validation';
import type { AppUser, UserFilters, UserFormValues } from './types';

type AppUserDetailResponse = components['schemas']['AppUserDetailResponse'];
type UserRoleListResponse = components['schemas']['UserRoleListResponse'];

const t = messages.usersRoles;

/**
 * 폼의 현재 값과 그것이 어디서 나왔는지.
 * 「고친 것이 있는가」는 둘의 비교로 판정하고, **출처가 바뀔 때만** 폼을 다시 세운다 —
 * 사용자가 입력하는 동안 값이 되돌아가면 안 된다.
 *
 * **출처는 등록과 수정을 함께 담는다** — 수정은 상세 응답 객체이고, 등록은 주소에서 파생한
 * 문자열이다. 등록 폼의 값을 로컬 상태에만 두면 주소로 직접 들어온 사용자에게 빈 화면이 남는다
 * (여닫음은 주소가 소유한다고 정해 놓고 값은 주소에서 살아나지 못하는 어긋남).
 */
type UserFormSource = string | AppUserDetailResponse;

interface UserFormState {
  source: UserFormSource;
  baseline: UserFormValues;
  values: UserFormValues;
}

/**
 * 역할 부여의 초안과 그것이 어디서 나왔는지.
 *
 * 폼과 같은 규칙이다 — **출처(서버 응답 객체)가 바뀔 때만** 다시 세운다.
 * 사용자가 확인칸을 고치는 동안 캐시가 갱신돼도 체크가 되돌아가면 안 된다.
 */
interface RoleAssignState {
  source: UserRoleListResponse;
  baseline: number[];
  selected: number[];
}

/**
 * W-CO-02 컨테이너.
 *
 * 조회 조건과 선택은 **주소가 소유한다**(`?tab=&q=&dept=&inactive=1&page=&usr=&new=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **탭은 만든 것만 렌더한다**(`tabs.ts`). 역할·권한 탭은 그 탭의 목록·폼이 생길 때 붙는다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 *
 * **이 화면은 권한 판정을 하지 않는다.** 누가 무엇을 할 수 있는지는 서버가 정하고,
 * 화면은 그 거부를 사용자에게 옮기는 데까지다(계획 결정 4).
 */
export const UsersRolesScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const tab = resolveTab(searchParams.get('tab'));
  const isUsersTab = tab.id === 'users';

  const filters = useMemo<UserFilters>(() => readUserFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  const isCreatingUser = isUsersTab && searchParams.get('new') === 'user';
  const selectedParam = isUsersTab ? readSelectedId(searchParams, 'usr') : null;
  /** 등록 폼이 열려 있는 동안에는 상세를 조회하지 않는다 — 만들고 있는 자원에는 상세가 없다. */
  const selectedAppUserId = isCreatingUser ? null : selectedParam;

  const userList = useUserList(filters, page, isUsersTab);
  const users = userList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const userPageView = toPageView(userList.data?.page ?? { page, size: 0, total: 0 }, users.length);

  const userDetail = useUserDetail(selectedAppUserId);

  const departmentOptions = useDepartmentOptions(isUsersTab);

  const [formState, setFormState] = useState<UserFormState | null>(null);

  /**
   * 폼의 기준값 출처. 수정은 상세 응답 객체가, 등록은 **주소**가 정한다.
   *
   * 출처가 그대로면 다시 세우지 않아 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않는다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   *
   * 등록 출처를 주소에서 파생시키는 것이 핵심이다 — 그래야 새로고침·공유·뒤로가기로
   * `?new=user`에 바로 들어온 사용자에게도 폼이 선다.
   */
  const userFormSource: UserFormSource | null = isCreatingUser
    ? 'create:user'
    : (userDetail.data ?? null);

  if (userFormSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== userFormSource) {
    const seeded =
      typeof userFormSource === 'string'
        ? emptyUserFormValues()
        : appUserToFormValues(userFormSource.appUser);
    setFormState({ source: userFormSource, baseline: seeded, values: seeded });
  }

  const isUserDirty = formState !== null && !isSameUserValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [userFieldErrors, setUserFieldErrors] = useState<Record<string, string>>({});

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  /* ── 역할 부여 ─────────────────────────────────────────────────────────── */

  const userRoleList = useUserRoles(selectedAppUserId);
  const roleOptions = useRoleOptions(selectedAppUserId !== null);

  const [roleAssignState, setRoleAssignState] = useState<RoleAssignState | null>(null);

  const roleAssignSource = userRoleList.data ?? null;

  if (roleAssignSource === null) {
    if (roleAssignState !== null) setRoleAssignState(null);
  } else if (roleAssignState?.source !== roleAssignSource) {
    const seeded = toRoleAssignDraft(roleAssignSource.items);
    setRoleAssignState({ source: roleAssignSource, baseline: seeded, selected: seeded });
  }

  const roleSelection = roleAssignState?.selected ?? [];
  const isRoleAssignDirty =
    roleAssignState !== null && !isSameRoleSelection(roleAssignState.selected, roleAssignState.baseline);

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 목록 위에 낸다.
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const renderOptionsNotice = (lookups: LookupResult[]): ReactNode => {
    if (lookups.some((lookup) => lookup.isError)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.some((lookup) => lookup.truncated)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  };

  /**
   * 주소의 일부만 고친다.
   *
   * **한 조작은 이 함수를 한 번만 부른다.** 한 틱에 두 번 부르면 앞 갱신이 렌더되지 않은 채
   * 히스토리 칸으로 남아, 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어진다.
   *
   * **주소가 달라지지 않으면 갱신하지 않는다.** 같은 값을 다시 쓰는 갱신은 화면을 바꾸지 않으면서
   * 히스토리 칸만 늘린다.
   */
  const patchSearchParams = (patch: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    patch(next);

    if (next.toString() === searchParams.toString()) return;

    setSearchParams(next);
  };

  const selectUser = (appUserId: number) => {
    patchSearchParams((next) => {
      next.set('usr', String(appUserId));
      // 사용자를 고르는 것과 등록 폼이 열려 있는 것은 함께 성립하지 않는다.
      next.delete('new');
    });
  };

  const reloadUserDetail = () => {
    void userDetail.refetch();
  };

  /**
   * 사용자 수정.
   *
   * 헤더 둘을 모두 싣는다 — 계약이 전 쓰기에 멱등 키를, 이 오퍼레이션에 낙관적 잠금을 요구한다.
   * 잠금 토큰은 **상세 경로**에 보관돼 있다. 보관 키가 요청 경로라 다른 경로로 꺼내면 언제나 비어 있다.
   */
  const userWrite = useMasterWrite<UserFormValues, AppUser>({
    request: (values, headers) =>
      client.PUT('/app/users/{appUserId}', {
        params: {
          path: { appUserId: selectedAppUserId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toAppUserUpdate(values),
      }),
    etagPath: selectedAppUserId === null ? null : userDetailPath(selectedAppUserId),
    invalidateKeys: [userKeys.all],
    knownFields: USER_FORM_FIELDS,
    onSuccess: (saved) => {
      setUserFieldErrors({});
      const next = appUserToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const userCreateWrite = useMasterWrite<UserFormValues, AppUser>({
    request: (values, headers) =>
      client.POST('/app/users', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toAppUserCreate(values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [userKeys.all],
    knownFields: USER_FORM_FIELDS,
    onSuccess: (saved) => {
      setUserFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 사용자를 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 계정을 직접 찾아야 한다.
       *
       * **주소 갱신은 이 한 번뿐이다**(`new` 해제 + `usr` 설정을 한 patch로).
       */
      selectUser(saved.appUserId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 사용 중지 — **본문이 없다.**
   *
   * 응답에 `ETag`가 없으므로 성공하면 상세까지 무효화해 재조회가 새 토큰을 확보하게 한다.
   * 무효화를 빠뜨리면 보관된 토큰이 낡아 그다음 저장이 조용히 막힌다.
   *
   * 잠금 토큰은 **상세 경로**에서 꺼낸다. 요청 경로(`…:deactivate`)로 꺼내면 언제나 비어 있어
   * 사용 중지가 전부 실패한다.
   */
  const userDeactivateWrite = useMasterWrite<void, AppUser>({
    request: (_variables, headers) =>
      client.POST('/app/users/{appUserId}:deactivate', {
        params: {
          /*
           * 고른 사용자가 없으면 **여기까지 오지 않는다** — 창을 그때만 붙이고 확인도 막는다.
           * 되돌릴 수 없는 액션이라 「없는 번호로 나가는 요청」을 만들 여지를 두지 않는다.
           */
          path: { appUserId: selectedAppUserId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: selectedAppUserId === null ? null : userDetailPath(selectedAppUserId),
    invalidateKeys: [userKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 역할 부여 치환.
   *
   * **`etagPath`가 반드시 `null`이다.** 계약에 이 쓰기의 `If-Match` 파라미터 자체가 없다 —
   * `user_role`에는 `version_no`가 없어 낙관적 잠금 대상이 아니다(부여·회수 형).
   * 상세 경로를 넘기면 토큰을 찾지 못해 **요청이 나가지 않고 멈춘다**(「저장을 눌러도 아무 일이 없다」).
   *
   * **무효화는 부여분 키 하나뿐이다.** 사용자 행도 잠금 토큰도 이 치환으로 바뀌지 않고,
   * 상세까지 무효화하면 바로 위 칸에서 편집 중이던 폼이 서버 값으로 되돌아간다.
   */
  const roleAssignWrite = useMasterWrite<readonly number[], UserRoleListResponse>({
    request: (selected, headers) =>
      client.PUT('/app/users/{appUserId}/roles', {
        params: {
          path: { appUserId: selectedAppUserId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: toRolesPayload(selected, roleCatalogOrder(roleOptions.entries)),
      }),
    etagPath: null,
    invalidateKeys: [userKeys.roles(selectedAppUserId ?? 0)],
    // 확인칸에는 계약의 필드 이름이 붙지 않는다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: (saved) => {
      /* **서버 응답이 정본이다.** 보낸 목록을 그대로 두면 서버가 조정한 결과를 놓친다. */
      const next = toRoleAssignDraft(saved.items);
      setRoleAssignState({ source: saved, baseline: next, selected: next });
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 지금 모드의 쓰기. 등록과 수정이 **한 폼 상태**를 쓰므로 저장·오류·진행 표시도
   * 한 곳에서 골라 쓴다 — 두 훅의 상태를 화면에서 합치면 어느 저장의 실패인지 흐려진다.
   */
  const activeUserWrite = isCreatingUser ? userCreateWrite : userWrite;

  /**
   * 편집 중이던 상태를 통째로 비운다 — 창·초안·인라인 오류·저장 실패 배너.
   *
   * **직접 부르지 않는다.** 아래 effect 한 곳만 부른다(선택 수명 규칙의 유일한 실행 지점).
   */
  const resetUserEditing = () => {
    userWrite.reset();
    userCreateWrite.reset();
    userDeactivateWrite.reset();
    roleAssignWrite.reset();
    setIsDeactivateOpen(false);
    setFormState(null);
    setUserFieldErrors({});
    setRoleAssignState(null);
  };

  /*
   * 위 함수는 매 렌더 새로 만들어지므로 그대로 의존성에 넣으면 렌더마다 초기화가 돈다 —
   * 입력 도중에 값이 사라진다. 최신 함수를 참조로 들고 **편집 대상에만** 반응하게 한다.
   */
  const resetUserEditingRef = useRef(resetUserEditing);
  resetUserEditingRef.current = resetUserEditing;

  /**
   * 「지금 무엇을 편집하고 있는가」를 한 값으로 모은다.
   *
   * 고른 사용자와 등록 폼은 **함께 성립하지 않는 하나의 자리**다 — 둘을 따로 감시하면
   * 등록 폼을 닫는 것과 사용자를 바꾸는 것이 서로 다른 규칙을 갖게 된다.
   */
  const editingTargetKey = isCreatingUser ? 'create' : String(selectedAppUserId ?? '');

  /**
   * 선택 수명 규칙의 **유일한 실행 지점**. 클릭 핸들러가 아니라 편집 대상에 묶는다.
   *
   * 클릭에만 두면 뒤로가기·앞으로가기·주소 직접 편집처럼 핸들러를 거치지 않는 경로가 샌다.
   * 그 경로에서 창과 오류가 살아남으면 **앞 사용자를 중지하려고 연 창이 다음 사용자를 중지한다** —
   * 쓰기 대상은 지금 주소를 읽기 때문이다. 계약에 되살리는 오퍼레이션이 없어 복구 경로가 없다.
   * 조건 변경·쪽 이동·탭 전환도 주소에서 `usr`·`new`를 떨구므로 전부 이 한 곳을 지나간다.
   */
  useEffect(() => {
    resetUserEditingRef.current();
  }, [editingTargetKey]);

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `usr`·`new`가 자연히 사라진다 — 보이는 행이 달라지는데 선택이 남으면
   * 우 칸의 폼이 어디서 온 것인지 알 수 없다. 편집 상태 정리는 위 effect가 맡는다.
   */
  const applyFilters = (next: UserFilters) => {
    setSearchParams(toUserSearchParams(tab.id, next, 1));
  };

  const changeUserPage = (nextPage: number) => {
    setSearchParams(toUserSearchParams(tab.id, filters, nextPage));
  };

  const handleAddUser = () => {
    patchSearchParams((next) => {
      next.set('new', 'user');
      // 등록 폼이 열려 있는 동안 고른 사용자의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('usr');
    });
  };

  /** 등록 폼을 닫는다. 편집 상태 정리는 편집 대상이 바뀌면서 위 effect가 맡는다. */
  const closeUserCreateForm = () => {
    patchSearchParams((next) => {
      next.delete('new');
    });
  };

  const changeUserValues = (patch: Partial<UserFormValues>) => {
    setFormState((prev) => (prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } }));

    // 고치는 즉시 그 칸의 오류를 지운다 — 고친 값 옆에 낡은 오류가 남으면 안 된다.
    setUserFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });

    for (const key of Object.keys(patch)) activeUserWrite.clearFieldError(key);
  };

  /**
   * 저장. **화면이 잡을 수 있는 오류가 있으면 요청을 보내지 않는다** —
   * 보내 놓고 서버가 되돌려 주기를 기다리면 사용자가 두 번 기다린다.
   */
  const handleSaveUser = () => {
    if (formState === null) return;

    const errors = validateUserForm(formState.values, isCreatingUser ? 'create' : 'edit');
    setUserFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    activeUserWrite.write(formState.values);
  };

  const handleToggleRole = (roleId: number) => {
    setRoleAssignState((prev) =>
      prev === null ? prev : { ...prev, selected: toggleRoleId(prev.selected, roleId) },
    );
  };

  const handleSaveRoleAssign = () => {
    /*
     * 페인은 고른 사용자가 있을 때만 서므로 여기까지 오지 않는다.
     * 그래도 대상 없이 보내지 않는다 — 「번호 0으로 나가는 요청」을 만들 여지를 두지 않는다.
     */
    if (roleAssignState === null || selectedAppUserId === null) return;

    roleAssignWrite.write(roleAssignState.selected);
  };

  /** 취소는 **서버를 부르지 않는다** — 체크 상태를 기준값으로 되돌릴 뿐이다. */
  const handleCancelRoleAssign = () => {
    roleAssignWrite.reset();
    setRoleAssignState((prev) => (prev === null ? prev : { ...prev, selected: prev.baseline }));
  };

  /**
   * 탭을 바꾸면 **탭 값 하나만 남긴다** — 규칙은 `tabs.ts`가 갖는다.
   * 그 결과 `usr`·`new`가 떨어져 편집 대상이 바뀌므로 정리는 위 effect가 맡는다.
   */
  const changeTab = (nextTabId: string) => {
    setSearchParams(tabSearchParams(nextTabId));
  };

  /**
   * 폼이 쓰는 부서 선택지. **빈 값을 앞에 둔다** — 계약이 널을 허용하므로
   * 고른 부서를 다시 비우는 것이 정상 조작이고, 그 「지정하지 않음」도 고른 값이다.
   */
  const userDepartmentOptions = [
    { value: '', label: t.user.departmentNone },
    ...selectableOptions(departmentOptions.entries, formState?.values.departmentId ?? ''),
  ];

  /**
   * 우 칸 — 사용자 정보.
   *
   * 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 등록·선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderUserFormPane = (): ReactNode => {
    if (isCreatingUser) {
      if (formState === null) return null;

      return (
        <UserFormPane
          mode="create"
          values={formState.values}
          onChange={changeUserValues}
          fieldErrors={{ ...userCreateWrite.fieldErrors, ...userFieldErrors }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={userCreateWrite.error} />}
          departmentOptions={userDepartmentOptions}
          deactivateDisabledReason={null}
          isDirty={isUserDirty}
          isSaving={userCreateWrite.isSaving}
          onSave={handleSaveUser}
          onCancel={closeUserCreateForm}
          onDeactivate={() => undefined}
        />
      );
    }

    if (selectedAppUserId === null) {
      return (
        <section className="pane" aria-label={t.panes.userForm}>
          <EmptyState size="sm" title={t.user.empty.notSelected} />
        </section>
      );
    }

    if (userDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.userForm}>
          <LoadErrorBanner error={userDetail.error} onRetry={reloadUserDetail} />
        </section>
      );
    }

    if (userDetail.data === undefined || formState === null) {
      return (
        <section className="pane" aria-label={t.panes.userForm}>
          <div role="status" aria-label={t.loading.userDetail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    return (
      <UserFormPane
        mode="edit"
        values={formState.values}
        onChange={changeUserValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...userWrite.fieldErrors, ...userFieldErrors }}
        banner={<SaveErrorBanner error={userWrite.error} onReload={reloadUserDetail} />}
        departmentOptions={userDepartmentOptions}
        deactivateDisabledReason={
          userDetail.data.appUser.isActive === false
            ? t.actionReasons.deactivateAlreadyDone
            : null
        }
        isDirty={isUserDirty}
        isSaving={userWrite.isSaving}
        onSave={handleSaveUser}
        onCancel={() => {
          setUserFieldErrors({});
          userWrite.reset();
          // 취소는 **서버를 부르지 않는다** — 초안을 기준값으로 되돌릴 뿐이다.
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        onDeactivate={() => {
          userDeactivateWrite.reset();
          setIsDeactivateOpen(true);
        }}
      />
    );
  };

  /**
   * 우 칸 가운데 — 역할 부여.
   *
   * **고른 사용자가 없으면 페인 자체를 두지 않는다.** 등록 중인 사용자에게는 아직 부여할
   * 대상이 없고(자원이 만들어지지 않았다), 아무도 고르지 않았으면 누구에게 주는 것인지 알 수 없다.
   * 빈 페인을 두면 사용자가 「여기서 무언가 할 수 있다」고 읽는다.
   */
  const renderRoleAssignPane = (): ReactNode => {
    if (selectedAppUserId === null) return null;

    return (
      <RoleAssignPane
        choices={toRoleChoices(roleOptions.entries, roleSelection)}
        /* 선택 목록과 부여분이 함께 있어야 확인칸 하나를 그릴 수 있다. */
        isLoading={userRoleList.isPending || roleOptions.isLoading}
        optionsNotice={renderOptionsNotice([roleOptions])}
        loadError={
          userRoleList.isError ? (
            <LoadErrorBanner
              error={userRoleList.error}
              onRetry={() => void userRoleList.refetch()}
            />
          ) : null
        }
        /*
         * 서버가 거부하면 그 사유를 그대로 낸다. 화면이 무엇을 막을지 정하지 않으므로
         * **이 배너가 사용자가 거부 이유를 아는 유일한 자리**다(계획 결정 4).
         * 이 치환에는 낙관적 잠금이 없어 충돌도 없다 — 「최신 불러오기」를 낼 자리가 아니다.
         */
        banner={<SaveErrorBanner error={roleAssignWrite.error} />}
        isDirty={isRoleAssignDirty}
        isSaving={roleAssignWrite.isSaving}
        onToggle={handleToggleRole}
        onSave={handleSaveRoleAssign}
        onCancel={handleCancelRoleAssign}
      />
    );
  };

  const usersTabContent = (
    <div className="two-pane">
      <UserListPane
        users={users}
        isLoading={userList.isPending}
        appliedFilters={filters}
        onApplyFilters={applyFilters}
        departmentOptions={selectableOptions(departmentOptions.entries, filters.departmentId)}
        /*
         * 조건 칩에는 번호가 아니라 이름을 낸다. 선택 목록을 아직 받지 못했으면
         * 「알 수 없음」이 나오고 목록이 도착하면 이름으로 바뀐다 —
         * 번호를 대신 보이면 사용자가 쓸 수 없는 값을 자료로 읽는다.
         */
        departmentLabel={(departmentId) =>
          lookupLabel(departmentOptions.entries, Number(departmentId))
        }
        departmentNameOf={(departmentId) => lookupLabel(departmentOptions.entries, departmentId)}
        optionsNotice={renderOptionsNotice([departmentOptions])}
        pageView={userPageView}
        onChangePage={changeUserPage}
        selectedAppUserId={selectedAppUserId}
        onSelect={selectUser}
        isCreating={isCreatingUser}
        onAddUser={handleAddUser}
        loadError={
          userList.isError ? (
            <LoadErrorBanner error={userList.error} onRetry={() => void userList.refetch()} />
          ) : null
        }
      />

      {/*
       * 우 칸은 구획을 세로로 쌓는다 — 사용자 정보 아래에 역할 부여·데이터 접근범위가 붙는다.
       * `.pane-stack`은 선택자에 매이지 않은 기본 규칙이라 2단 배치의 칸 안에서도 그대로 동작한다.
       */}
      <div className="pane-stack">
        {renderUserFormPane()}
        {renderRoleAssignPane()}
      </div>
    </div>
  );

  const tabContentOf = (tabId: string): ReactNode => (tabId === 'users' ? usersTabContent : null);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <Tabs
        aria-label={t.tabs.label}
        value={tab.id}
        onChange={changeTab}
        items={USERS_ROLES_TABS.map((definition) => ({
          value: definition.id,
          label: definition.label,
          /*
           * 활성 탭의 내용만 만든다. 디자인 시스템 `Tabs`는 비활성 패널도 DOM에 두므로
           * 모두 만들면 보이지 않는 표가 함께 살아 있게 된다.
           */
          content: definition.id === tab.id ? tabContentOf(definition.id) : null,
        }))}
      />

      {/*
       * 창은 **열 때만 붙인다** — 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아
       * 지난 값이 그대로 살아 있게 된다.
       *
       * 되돌릴 수 없는 액션이라 확인을 한 단계 두고, **실패해도 창을 닫지 않는다** —
       * 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
       */}
      {isDeactivateOpen && selectedAppUserId !== null && (
        <DeactivateDialog
          open
          title={t.dialog.deactivateUserTitle}
          onClose={() => {
            setIsDeactivateOpen(false);
            userDeactivateWrite.reset();
          }}
          onConfirm={() => {
            // 대상이 없으면 보내지 않는다. 위 조건과 짝을 이루는 이중 방어다.
            if (selectedAppUserId === null) return;

            userDeactivateWrite.write(undefined);
          }}
          isSaving={userDeactivateWrite.isSaving}
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다. */
          banner={
            <SaveErrorBanner error={userDeactivateWrite.error} onReload={reloadUserDetail} />
          }
        />
      )}
    </>
  );
};
