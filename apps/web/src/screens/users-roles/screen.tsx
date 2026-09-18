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
import {
  createDataScopeDraft,
  isSameDataScopeDrafts,
  removeDataScopeDraft,
  toDataScopeDrafts,
  toDataScopesPayload,
  upsertDataScopeDraft,
  type DataScopeDraft,
} from './data-scope-draft';
import { DataScopeFormDialog } from './data-scope-form-dialog';
import { DataScopePane } from './data-scope-pane';
import {
  applySelection,
  isCreating,
  readPage,
  readRoleFilters,
  readSelectedAppUserId,
  readSelectedRoleId,
  readUserFilters,
  toRoleSearchParams,
  toUserSearchParams,
} from './filters';
import { validateInitialPassword } from './initial-password';
import { isForbiddenLoadError, LoadErrorBanner } from './load-error-banner';
import {
  lookupKeys,
  useBusinessUnitOptions,
  useDepartmentOptions,
  usePlantOptions,
  useRoleOptions,
  useUserStatusOptions,
  type LookupResult,
} from './lookups';
import { toPageView } from './pagination';
import { flattenPermissionColumns, toPermissionGroups } from './permission-catalog';
import {
  isSamePermissionSelection,
  permissionCatalogOrder,
  toPermissionDraft,
  toPermissionsPayload,
  togglePermissionCode,
} from './permission-draft';
import { PermissionGridPane } from './permission-grid-pane';
import { PermissionSaveBanner } from './permission-save-banner';
import { ResetPasswordDialog, TemporaryPasswordDialog } from './reset-password-dialog';
import {
  isSameRoleSelection,
  roleCatalogOrder,
  toRoleAssignDraft,
  toRoleChoices,
  toRolesPayload,
  toggleRoleId,
} from './role-assign-draft';
import { RoleAssignPane } from './role-assign-pane';
import { RoleFormPane } from './role-form-pane';
import { RoleListPane } from './role-list-pane';
import {
  emptyRoleFormValues,
  isSameRoleValues,
  roleToFormValues,
  toRoleCreate,
  toRoleUpdate,
} from './role-mappers';
import {
  roleDetailPath,
  roleKeys,
  usePermissionCatalog,
  useRoleDetail,
  useRoleList,
  useRolePermissions,
} from './role-queries';
import { ROLE_FORM_FIELDS, validateRoleForm } from './role-validation';
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
  useUserDataScopes,
  useUserDetail,
  useUserList,
  useUserRoles,
  userDetailPath,
  userKeys,
} from './user-queries';
import { USER_CREATE_FORM_FIELDS, USER_FORM_FIELDS, validateUserForm } from './user-validation';
import type {
  AppUser,
  Role,
  RoleFilters,
  RoleFormValues,
  UserFilters,
  UserFormValues,
} from './types';

type AppUserDetailResponse = components['schemas']['AppUserDetailResponse'];
type UserRoleListResponse = components['schemas']['UserRoleListResponse'];
type UserDataScopeListResponse = components['schemas']['UserDataScopeListResponse'];
type AppUserPasswordReset = components['schemas']['AppUserPasswordReset'];
type RoleDetailResponse = components['schemas']['RoleDetailResponse'];
type RolePermissionListResponse = components['schemas']['RolePermissionListResponse'];

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
  /**
   * 초기 비밀번호 칸을 **사람이 한 번이라도 건드렸는가.** 등록 폼이 그 칸을 기본값으로 채워 열기
   * 때문에 필요하다 — 빈 칸을 「아직 안 채웠다」로만 보면 값을 **지운** 사람에게도 아무 말을 못 한다.
   *
   * ⭐ **왜 별 `useState`가 아니라 이 안인가.** 폼 시딩 블록이 편집 대상이 바뀔 때마다 이
   * 상태를 통째로 새로 만들고, `resetUserEditing`이 `null`로 떨군다. 폼 닫기·다른 사용자
   * 선택·등록 성공·탭 전환·뒤로가기가 **전부 그 길을 지난다.** 별 상태로 두면 그 길마다 초기화를
   * 적어야 하고, **하나를 잊어도 타입이 그것을 잡지 못한다** — 앞 등록에서 손댄 흔적이 다음
   * 등록 폼에 남아 첫 렌더부터 붉은 글씨가 선다. 이 안에 두면 폼 값과 **수명이 같아져** 잊을
   * 자리가 없다.
   */
  isPasswordTouched: boolean;
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
 * 기능 권한 초안. 역할 부여와 같은 규칙이다 — **출처가 바뀔 때만** 다시 세운다.
 *
 * 출처는 **부여분**이다. 후보 목록은 열을 만들 뿐 초안의 값이 아니라, 후보가 갱신돼도
 * 사용자가 켜 둔 칸이 되돌아가면 안 된다.
 */
interface PermissionState {
  source: RolePermissionListResponse;
  baseline: string[];
  selected: string[];
}

/** 접근범위 초안. 역할 부여와 같은 규칙으로 수명을 다룬다. */
interface DataScopeState {
  source: UserDataScopeListResponse;
  baseline: DataScopeDraft[];
  drafts: DataScopeDraft[];
}

/** 역할 폼의 출처. 사용자 폼과 같은 규칙이다 — 수정은 상세 응답, 등록은 주소에서 파생한 문자열. */
type RoleFormSource = string | RoleDetailResponse;

interface RoleFormState {
  source: RoleFormSource;
  baseline: RoleFormValues;
  values: RoleFormValues;
}

/**
 * W-CO-02 컨테이너.
 *
 * 조회 조건과 선택은 **주소가 소유한다**(`?tab=&q=&dept=&inactive=1&page=&usr=&rol=&new=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **탭은 만든 것만 렌더한다**(`tabs.ts`) — 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」
 * 상태가 된다.
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
  const isRolesTab = tab.id === 'roles';

  const filters = useMemo<UserFilters>(() => readUserFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  const isCreatingUser = isUsersTab && isCreating(searchParams, 'user');
  const selectedParam = isUsersTab ? readSelectedAppUserId(searchParams) : null;
  const userList = useUserList(filters, page, isUsersTab);
  const userListForbidden = userList.isError && isForbiddenLoadError(userList.error);
  /**
   * 목록으로 화면 접근을 확인하기 전에는 URL의 지난 선택을 조회하지 않는다.
   * 재조회 중에는 기존 데이터를 유지하고, 403이면 기존 데이터가 있어도 즉시 가린다.
   */
  const selectedAppUserId =
    isCreatingUser || userList.data === undefined || userListForbidden ? null : selectedParam;
  const users = userList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const userPageView = toPageView(userList.data?.page ?? { page, size: 0, total: 0 }, users.length);

  const userDetail = useUserDetail(selectedAppUserId);

  const departmentOptions = useDepartmentOptions(isUsersTab);
  const userStatusOptions = useUserStatusOptions(isUsersTab);

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
    setFormState({
      source: userFormSource,
      baseline: seeded,
      values: seeded,
      isPasswordTouched: false,
    });
  }

  const isUserDirty = formState !== null && !isSameUserValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [userFieldErrors, setUserFieldErrors] = useState<Record<string, string>>({});

  /**
   * 초기 비밀번호 칸에 **지금** 설 한 문장. 없으면 `undefined`.
   *
   * ⛔ **이 결과를 `userFieldErrors`에 담지 않는다.** `changeUserValues`가 「고치는 즉시 그 칸의
   * 오류를 지운다」를 보장하는데, 담으면 한 글자마다 지우고 다시 세우는 경쟁이 되어 **그 코드가
   * 뜻을 잃는다**(무엇을 지우는 규칙인지 말할 수 없게 된다). 렌더마다 다시 재면 충돌이 없다 —
   * 지워지는 것은 **담아 둔 오류**(서버가 준 것 · 저장을 누른 시점의 것)뿐이고, 살아 있는 판정은
   * 다음 렌더에 스스로 다시 선다. 그래서 `changeUserValues`는 이 칸을 알 필요가 없다.
   *
   * **네 갈래다.**
   *
   * | 값 | 손댔는가 | 무엇을 말하나 |
   * | --- | --- | --- |
   * | 비었다 | 아니오 | **아무 말도 하지 않는다** |
   * | 비었다 | 예 | 「필수」 |
   * | 있다 | 무관 | 규칙 판정 |
   * | — | — | 등록 모드가 아니면 아무 말도 하지 않는다 |
   *
   * ⭐ **셋째 줄의 「무관」이 이 칸의 핵심이다.** 값이 있는데 규칙을 어기면 **손대기 전에도**
   * 말한다. 이 칸은 기본값이 채워진 채 열리므로(`emptyUserFormValues`), 잘못된 기본값이
   * 들어온 배포본을 **즉시 드러내는 유일한 길**이 이것이다 — 손댄 뒤에만 말하면 관리자가 그 칸을
   * 건드리지 않고 저장을 누를 때까지 아무도 모른다.
   *
   * ⭐ **첫째 줄이 침묵하는 것은 「첫 글자부터 붉은 글씨를 세우지 않는다」는 규율 때문이다**
   * (`password-change/password-draft.ts` 머리말 · 이 화면의 `userFieldErrors`도 같은 규율이다).
   * 값을 **지워서** 빈 칸이 된 경우는 손댄 것이므로 둘째 줄로 간다 — 지운 사람에게는 말해야 한다.
   *
   * 등록 모드가 아니면 재지 않는다 — 수정 폼에 이 칸이 없어(`user-form-pane.tsx`) 그릴 자리가
   * 없고, 그릴 자리 없는 오류는 저장만 막는 침묵이 된다.
   */
  const liveInitialPasswordError = ((): string | undefined => {
    if (!isCreatingUser || formState === null) return undefined;

    const value = formState.values.password;

    if (value === '' && !formState.isPasswordTouched) return undefined;

    return validateInitialPassword(value);
  })();

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  /**
   * 초기화 응답으로 받은 임시 비밀번호와 그 대상. 서버가 **이 응답에서 한 번만** 주므로 창을 닫을
   * 때 비운다.
   *
   * ⛔ 선택 수명 규칙(`resetUserEditing`)이 이 값을 비우지 않는다 — 응답이 대상 전환 뒤에 와도
   * 비우면 그 값을 영영 잃는다. 대신 누구의 값인지를 로그인 ID로 함께 보인다.
   */
  const [issuedPassword, setIssuedPassword] = useState<{
    loginId: string;
    temporaryPassword: string;
  } | null>(null);

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
    roleAssignState !== null &&
    !isSameRoleSelection(roleAssignState.selected, roleAssignState.baseline);

  /* ── 데이터 접근범위 ───────────────────────────────────────────────────── */

  const dataScopeList = useUserDataScopes(selectedAppUserId);
  const businessUnitOptions = useBusinessUnitOptions(selectedAppUserId !== null);
  const plantOptions = usePlantOptions(selectedAppUserId !== null);

  const [dataScopeState, setDataScopeState] = useState<DataScopeState | null>(null);

  const dataScopeSource = dataScopeList.data ?? null;

  if (dataScopeSource === null) {
    if (dataScopeState !== null) setDataScopeState(null);
  } else if (dataScopeState?.source !== dataScopeSource) {
    const seeded = toDataScopeDrafts(dataScopeSource.items);
    setDataScopeState({ source: dataScopeSource, baseline: seeded, drafts: seeded });
  }

  const dataScopeDrafts = dataScopeState?.drafts ?? [];
  const isDataScopeDirty =
    dataScopeState !== null &&
    !isSameDataScopeDrafts(dataScopeState.drafts, dataScopeState.baseline);

  /** 편집 창의 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다. */
  const [editingDataScope, setEditingDataScope] = useState<DataScopeDraft | null>(null);
  const [isEditingNewDataScope, setIsEditingNewDataScope] = useState(false);

  /* ── 역할·권한 탭 ──────────────────────────────────────────────────────── */

  /**
   * 역할 목록의 조회 조건. **사용자 조건과 별개 값이다** — 조건 종류가 다르고(부서가 없다),
   * 탭을 바꾸면 주소에서 통째로 떨어진다.
   */
  const roleFilters = useMemo<RoleFilters>(() => readRoleFilters(searchParams), [searchParams]);

  const isCreatingRole = isRolesTab && isCreating(searchParams, 'role');
  const selectedRoleParam = isRolesTab ? readSelectedRoleId(searchParams) : null;
  const roleList = useRoleList(roleFilters, page, isRolesTab);
  const roleListForbidden = roleList.isError && isForbiddenLoadError(roleList.error);
  /** 사용자 탭과 같이 목록 접근 확인 전에는 지난 역할의 상세를 조회하지 않는다. */
  const selectedRoleId =
    isCreatingRole || roleList.data === undefined || roleListForbidden ? null : selectedRoleParam;
  const roles = roleList.data?.items ?? [];

  /* 서버가 준 쪽 정보를 정본으로 쓴다 — 사용자 목록과 같은 규칙이다. */
  const rolePageView = toPageView(roleList.data?.page ?? { page, size: 0, total: 0 }, roles.length);

  const roleDetail = useRoleDetail(selectedRoleId);
  const rolePermissions = useRolePermissions(selectedRoleId);
  /*
   * 후보 목록은 **역할과 무관하다** — 고른 역할이 없어도 받아 둔다. 역할을 바꿀 때마다
   * 다시 받으면 화면 수만큼의 목록이 매번 오간다.
   */
  const permissionCatalog = usePermissionCatalog();

  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  const permissionSource = rolePermissions.data ?? null;

  if (permissionSource === null) {
    if (permissionState !== null) setPermissionState(null);
  } else if (permissionState?.source !== permissionSource) {
    const seeded = toPermissionDraft(permissionSource.items);
    setPermissionState({ source: permissionSource, baseline: seeded, selected: seeded });
  }

  const permissionSelection = permissionState?.selected ?? [];
  const isPermissionDirty =
    permissionState !== null &&
    !isSamePermissionSelection(permissionState.selected, permissionState.baseline);

  /*
   * 격자는 **초안**을 그린다 — 켠 칸이 저장 전에도 그대로 보여야 한다.
   *
   * 다만 **후보 밖 열이 있는지**는 서버 부여분(`baseline`)이 정한다. 초안으로 정하면 그 칸을
   * 끄는 순간 열이 통째로 사라져 다시 켤 수 없다.
   */
  const permissionGroups = toPermissionGroups(
    permissionCatalog.data?.items ?? [],
    permissionSelection,
    permissionState?.baseline ?? [],
  );
  const permissionColumns = flattenPermissionColumns(permissionGroups);
  /*
   * ⛔ **후보를 받은 뒤에만 말한다.** 조회가 실패했거나 아직 오는 중이면 후보가 빈 배열이라
   * 부여분 전부가 「목록에 없는 권한」으로 잡힌다 — 일시적 통신 실패를 자료 이상으로 오인시킨다.
   */
  const hasUnlistedPermission =
    permissionCatalog.isSuccess && permissionColumns.some((column) => column.isUnlisted);

  const [roleFormState, setRoleFormState] = useState<RoleFormState | null>(null);

  /** 사용자 폼과 같은 규칙 — 출처가 바뀔 때만 다시 세우고, 등록 출처는 주소에서 파생한다. */
  const roleFormSource: RoleFormSource | null = isCreatingRole
    ? 'create:role'
    : (roleDetail.data ?? null);

  if (roleFormSource === null) {
    if (roleFormState !== null) setRoleFormState(null);
  } else if (roleFormState?.source !== roleFormSource) {
    const seeded =
      typeof roleFormSource === 'string'
        ? emptyRoleFormValues()
        : roleToFormValues(roleFormSource.role);
    setRoleFormState({ source: roleFormSource, baseline: seeded, values: seeded });
  }

  const isRoleDirty =
    roleFormState !== null && !isSameRoleValues(roleFormState.values, roleFormState.baseline);

  const [roleFieldErrors, setRoleFieldErrors] = useState<Record<string, string>>({});

  const [isRoleDeactivateOpen, setIsRoleDeactivateOpen] = useState(false);

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

  /*
   * 선택 자리 넷(`usr`·`rol`·`new=user`·`new=role`)은 **함께 성립하지 않는 하나의 자리**다.
   * 그 배타 규칙은 `filters.ts`의 `applySelection` 한 곳에 있다 — 자리마다 손으로 지우면
   * 「무엇을 비우는가」가 자리마다 갈린다.
   */
  const selectUser = (appUserId: number) => {
    patchSearchParams((next) => {
      applySelection(next, { kind: 'user', appUserId });
    });
  };

  const selectRole = (roleId: number) => {
    patchSearchParams((next) => {
      applySelection(next, { kind: 'role', roleId });
    });
  };

  const reloadUserDetail = () => {
    void userDetail.refetch();
  };

  const reloadRoleDetail = () => {
    void roleDetail.refetch();
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
      setFormState((prev) =>
        prev === null ? prev : { ...prev, baseline: next, values: next, isPasswordTouched: false },
      );
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
    /*
     * ⭐ **등록만 `password`를 아는 목록을 쓴다.** 넣지 않으면 서버가 그 필드에 낸 400이
     * `splitError`(`patterns/master/use-master-write.ts`)에서 「화면이 아는 필드가 아니면 배너로
     * 올린다」에 걸려 **고칠 칸을 짚어 주지 못한다.**
     *
     * ⛔ **수정 쓰기(위 `userWrite`)는 `USER_FORM_FIELDS`를 그대로 둔다 — 넓히면 안 된다.**
     * 두 쓰기가 같은 상수를 쓰고 있어서 상수를 넓히는 쪽으로 고치면, 수정 저장에서 서버가
     * `field: "password"`를 내려보낼 때 같은 함수가 그것을 **인라인으로 분류하는데 수정 폼에는
     * 그 칸이 없어 어디에도 그려지지 않는다.** 배너로 올라가야 할 실패가 조용히 삼켜지고
     * 사용자는 저장이 왜 안 됐는지 알 수 없다 — 그 함수가 「어디에도 표시되지 않는 오류가
     * 생긴다」로 경고하는 사고가 바로 이것이다. 그래서 목록은 **그 폼에 실제로 있는 칸으로만**
     * 유지한다.
     */
    knownFields: USER_CREATE_FORM_FIELDS,
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
   * 비밀번호 초기화 — **본문도 잠금 토큰도 없다.** 계약이 멱등 키만 요구한다.
   *
   * 서버는 자격증명 행만 고치고 사용자 행은 건드리지 않는다 — 그래서 **아무것도 무효화하지
   * 않는다.** 상세를 무효화하면 바로 위 폼에서 편집 중이던 값이 서버 값으로 되돌아간다.
   *
   * 멱등 키는 기본 수명(`per-attempt`)이다 — 본문이 빈 액션이라 `until-applied`를 쓰면 거부된
   * 뒤 다시 눌러도 같은 거부가 돌아온다(`use-master-write.ts`). 통신이 끊겨 다시 누르면 새 값이
   * 나가지만, 받지 못한 앞의 값이 무효가 될 뿐 잃는 것이 없다(단말 등록 코드 발급과 같은 판단).
   *
   * 대상의 로그인 ID는 **보낼 때** 잡는다 — 처리기가 보낼 때의 렌더를 보므로 응답이 늦어도
   * 그 시도의 대상과 짝이 맞는다.
   */
  const resetPasswordLoginId = userDetail.data?.appUser.loginId ?? '';
  const userResetPasswordWrite = useMasterWrite<void, AppUserPasswordReset>({
    request: (_variables, headers) =>
      client.POST('/app/users/{appUserId}:reset-password', {
        params: {
          path: { appUserId: selectedAppUserId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: [],
    onSuccess: (reset) => {
      setIsResetPasswordOpen(false);
      setIssuedPassword({
        loginId: resetPasswordLoginId,
        temporaryPassword: reset.temporaryPassword,
      });
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
   * 데이터 접근범위 치환. 역할 부여와 같은 규약이다 —
   * **`If-Match` 없음 · 자기 키만 무효화 · 서버 응답으로 초안을 다시 세움.**
   */
  const dataScopeWrite = useMasterWrite<readonly DataScopeDraft[], UserDataScopeListResponse>({
    request: (drafts, headers) =>
      client.PUT('/app/users/{appUserId}/data-scopes', {
        params: {
          path: { appUserId: selectedAppUserId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { scopes: toDataScopesPayload(drafts) },
      }),
    etagPath: null,
    invalidateKeys: [userKeys.dataScopes(selectedAppUserId ?? 0)],
    // 대응하는 입력칸이 이 구획에 없다(창 안에 있고, 창은 닫혀 있다) — 필드 오류도 배너로 올린다.
    knownFields: [],
    onSuccess: (saved) => {
      /* 서버가 줄 번호를 새로 매기므로 보낸 목록을 그대로 두면 다음 저장이 옛 번호로 돈다. */
      const next = toDataScopeDrafts(saved.items);
      setDataScopeState({ source: saved, baseline: next, drafts: next });
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 역할 쓰기가 무효화하는 것 — **역할 자신과 사용자 탭의 역할 선택 목록 둘**이다.
   *
   * 선택 목록을 함께 무효화하는 이유: 역할을 만들고 고치고 중지하는 일은 **이 탭**에서 일어나는데
   * 그 결과가 보이는 자리는 **사용자 탭의 역할 부여 확인칸**이다. 앱의 기본 `staleTime`이 30초라
   * (`app/providers.tsx` — 「탭 전환마다 재요청하지 않는다」) 재마운트만으로는 다시 조회되지 않는다.
   * 무효화하지 않으면 **방금 만든 역할이 부여 목록에 없고, 고친 이름이 옛 이름 그대로이며,
   * 중지한 역할에 「(미사용)」이 붙지 않는다.**
   *
   * **「무효화를 좁힌다」와 어긋나지 않는다.** 그 규칙은 *편집 중인 초안의 출처*를 되돌리지 말라는
   * 것인데(PR ②), 이 선택 목록은 부여 초안의 **출처가 아니라 선택지**다 — 초안은
   * `useUserRoles`가 세운다. 그래서 여기서는 사용자 상세·목록·부여분을 건드리지 않는다.
   */
  const roleWriteInvalidateKeys = [roleKeys.all, lookupKeys.roles];

  /**
   * 역할 수정. 사용자 수정과 **같은 규약**이다 — 두 헤더를 모두 싣고 잠금 토큰은 상세 경로에서 꺼낸다.
   *
   * **`roleCode`가 본문에 실린다.** 로그인 ID와 갈리는 자리다(계획 결정 10) —
   * 잠긴 칸이어도 서버가 준 값이 그대로 되돌아 나간다.
   */
  const roleWrite = useMasterWrite<RoleFormValues, Role>({
    request: (values, headers) =>
      client.PUT('/app/roles/{roleId}', {
        params: {
          path: { roleId: selectedRoleId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toRoleUpdate(values),
      }),
    etagPath: selectedRoleId === null ? null : roleDetailPath(selectedRoleId),
    invalidateKeys: roleWriteInvalidateKeys,
    knownFields: ROLE_FORM_FIELDS,
    onSuccess: (saved) => {
      setRoleFieldErrors({});
      const next = roleToFormValues(saved);
      setRoleFormState((prev) =>
        prev === null ? prev : { ...prev, baseline: next, values: next },
      );
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const roleCreateWrite = useMasterWrite<RoleFormValues, Role>({
    request: (values, headers) =>
      client.POST('/app/roles', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toRoleCreate(values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: roleWriteInvalidateKeys,
    knownFields: ROLE_FORM_FIELDS,
    onSuccess: (saved) => {
      setRoleFieldErrors({});
      /* 방금 만든 역할을 연다 — 상세 조회가 잠금 토큰을 확보한다. 주소 갱신은 이 한 번뿐이다. */
      selectRole(saved.roleId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 역할 사용 중지 — **본문이 없다.** 사용자 사용 중지와 같은 규약이다.
   *
   * 잠금 토큰은 **상세 경로**에서 꺼낸다. 요청 경로(`…:deactivate`)로 꺼내면 언제나 비어 있어
   * 사용 중지가 전부 실패한다.
   */
  const roleDeactivateWrite = useMasterWrite<void, Role>({
    request: (_variables, headers) =>
      client.POST('/app/roles/{roleId}:deactivate', {
        params: {
          // 고른 역할이 없으면 여기까지 오지 않는다 — 창을 그때만 붙이고 확인도 막는다.
          path: { roleId: selectedRoleId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: selectedRoleId === null ? null : roleDetailPath(selectedRoleId),
    invalidateKeys: roleWriteInvalidateKeys,
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsRoleDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 기능 권한 치환.
   *
   * **`etagPath`가 반드시 `null`이다.** 계약에 이 쓰기의 `If-Match` 파라미터 자체가 없다 —
   * `role_permission`에는 `version_no`가 없어 낙관적 잠금 대상이 아니다(부여·회수 형).
   * 상세 경로를 넘기면 토큰을 찾지 못해 **요청이 나가지 않고 멈춘다.**
   *
   * **무효화는 부여분 키 하나뿐이다.** 역할 행도 잠금 토큰도 이 치환으로 바뀌지 않고,
   * 상세까지 무효화하면 위 칸에서 편집 중이던 역할 폼이 서버 값으로 되돌아간다.
   * 후보 목록은 앱 기능 목록이라 이 저장으로 달라지지 않는다.
   */
  const permissionWrite = useMasterWrite<readonly string[], RolePermissionListResponse>({
    request: (selected, headers) =>
      client.PUT('/app/roles/{roleId}/permissions', {
        params: {
          path: { roleId: selectedRoleId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: toPermissionsPayload(selected, permissionCatalogOrder(permissionColumns)),
      }),
    etagPath: null,
    invalidateKeys: [roleKeys.permissions(selectedRoleId ?? 0)],
    /*
     * 격자 칸에는 계약의 필드 이름이 붙지 않는다 — 후보 밖 코드의 `permissionCodes[i]` 도
     * 인라인으로 낼 자리가 없어 전부 배너로 올린다.
     */
    knownFields: [],
    onSuccess: (saved) => {
      /* **서버 응답이 정본이다.** 보낸 목록을 그대로 두면 서버가 접은 중복을 놓친다. */
      const next = toPermissionDraft(saved.items);
      setPermissionState({ source: saved, baseline: next, selected: next });
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 지금 모드의 쓰기. 등록과 수정이 **한 폼 상태**를 쓰므로 저장·오류·진행 표시도
   * 한 곳에서 골라 쓴다 — 두 훅의 상태를 화면에서 합치면 어느 저장의 실패인지 흐려진다.
   */
  const activeUserWrite = isCreatingUser ? userCreateWrite : userWrite;
  const activeRoleWrite = isCreatingRole ? roleCreateWrite : roleWrite;

  /**
   * 편집 중이던 상태를 통째로 비운다 — 창·초안·인라인 오류·저장 실패 배너.
   *
   * **직접 부르지 않는다.** 아래 effect 한 곳만 부른다(선택 수명 규칙의 유일한 실행 지점).
   */
  const resetUserEditing = () => {
    userWrite.reset();
    userCreateWrite.reset();
    userDeactivateWrite.reset();
    userResetPasswordWrite.reset();
    roleAssignWrite.reset();
    dataScopeWrite.reset();
    setIsDeactivateOpen(false);
    setIsResetPasswordOpen(false);
    setFormState(null);
    setUserFieldErrors({});
    setRoleAssignState(null);
    setDataScopeState(null);
    setEditingDataScope(null);
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
   * 역할 쪽의 같은 규칙. **자원마다 실행 지점이 하나씩**이다 —
   * 둘을 한 effect로 합치면 사용자를 바꿀 때 역할 상태까지 지우게 되어
   * 「무엇이 무엇을 정리하는가」가 흐려진다.
   */
  const resetRoleEditing = () => {
    roleWrite.reset();
    roleCreateWrite.reset();
    roleDeactivateWrite.reset();
    permissionWrite.reset();
    setIsRoleDeactivateOpen(false);
    setRoleFormState(null);
    setRoleFieldErrors({});
    setPermissionState(null);
  };

  const resetRoleEditingRef = useRef(resetRoleEditing);
  resetRoleEditingRef.current = resetRoleEditing;

  const editingRoleTargetKey = isCreatingRole ? 'create' : String(selectedRoleId ?? '');

  useEffect(() => {
    resetRoleEditingRef.current();
  }, [editingRoleTargetKey]);

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
    // 등록 폼이 열려 있는 동안 고른 사용자의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
    patchSearchParams((next) => {
      applySelection(next, { kind: 'createUser' });
    });
  };

  /** 등록 폼을 닫는다. 편집 상태 정리는 편집 대상이 바뀌면서 위 effect가 맡는다. */
  const closeUserCreateForm = () => {
    patchSearchParams((next) => {
      applySelection(next, { kind: 'none' });
    });
  };

  const changeUserValues = (patch: Partial<UserFormValues>) => {
    setFormState((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            values: { ...prev.values, ...patch },
            /*
             * 「손댔다」를 값과 **한 번에** 갱신한다 — 값 갱신 뒤에 따로 세우면 한 입력이 두 번의
             * 상태 갱신이 되고, 두 갱신 사이의 렌더에서 「새 값 + 낡은 손댔는가」가 보인다.
             * 한 번 참이 되면 되돌리지 않는다 — 값을 지운 것도 손댄 것이다.
             */
            isPasswordTouched: prev.isPasswordTouched || 'password' in patch,
          },
    );

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

  const handleTogglePermission = (code: string) => {
    setPermissionState((prev) =>
      prev === null ? prev : { ...prev, selected: togglePermissionCode(prev.selected, code) },
    );
  };

  /**
   * 전체 선택·해제 — **고르기만 하고 저장하지 않는다.**
   *
   * 권한이 117개라 손으로 켜는 비용이 크다는 사용자 판단이다(#1308). 되돌리는 길은 「취소」이고,
   * 서버로 나가는 것은 「저장」을 눌렀을 때뿐이라 한 번의 오조작이 바로 반영되지 않는다.
   *
   * 고르는 범위는 **지금 표에 선 행 전부**다 — 후보 밖 부여분도 행으로 서 있으므로 함께 켜진다.
   */
  const handleSelectAllPermissions = () => {
    const everyCode = permissionColumns.map((column) => column.code);

    setPermissionState((prev) => (prev === null ? prev : { ...prev, selected: everyCode }));
  };

  const handleClearAllPermissions = () => {
    setPermissionState((prev) => (prev === null ? prev : { ...prev, selected: [] }));
  };

  const handleSavePermissions = () => {
    /*
     * 고른 역할이 없으면 격자 자체가 서지 않는다. 그래도 막는 것은, 저장이 `roleId` 를
     * 0 으로 보내는 일이 절대 없어야 하기 때문이다.
     */
    if (permissionState === null || selectedRoleId === null) return;

    permissionWrite.write(permissionState.selected);
  };

  const handleCancelPermissions = () => {
    permissionWrite.reset();
    setPermissionState((prev) => (prev === null ? prev : { ...prev, selected: prev.baseline }));
  };

  const changeDataScopeDrafts = (next: (drafts: DataScopeDraft[]) => DataScopeDraft[]) => {
    setDataScopeState((prev) => (prev === null ? prev : { ...prev, drafts: next(prev.drafts) }));
  };

  /** 창을 열 때 앞선 저장 실패 배너를 걷는다 — 지금 고치는 줄과 무관한 안내다. */
  const openDataScopeDialog = (draft: DataScopeDraft, isNew: boolean) => {
    dataScopeWrite.reset();
    setIsEditingNewDataScope(isNew);
    setEditingDataScope(draft);
  };

  const handleSaveDataScopes = () => {
    if (dataScopeState === null || selectedAppUserId === null) return;

    dataScopeWrite.write(dataScopeState.drafts);
  };

  /** 취소는 **서버를 부르지 않는다** — 표를 기준값으로 되돌릴 뿐이다. */
  const handleCancelDataScopes = () => {
    dataScopeWrite.reset();
    setDataScopeState((prev) => (prev === null ? prev : { ...prev, drafts: prev.baseline }));
  };

  /* ── 역할·권한 탭의 조작 ────────────────────────────────────────────────── */

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.** 그래야 `rol`·`new`가 자연히 사라진다 —
   * 사용자 탭과 같은 규칙이며, 규칙 표는 `filters.ts`가 갖는다.
   */
  const applyRoleFilters = (next: RoleFilters) => {
    setSearchParams(toRoleSearchParams(tab.id, next, 1));
  };

  const changeRolePage = (nextPage: number) => {
    setSearchParams(toRoleSearchParams(tab.id, roleFilters, nextPage));
  };

  const handleAddRole = () => {
    patchSearchParams((next) => {
      applySelection(next, { kind: 'createRole' });
    });
  };

  const closeRoleCreateForm = () => {
    patchSearchParams((next) => {
      applySelection(next, { kind: 'none' });
    });
  };

  const changeRoleValues = (patch: Partial<RoleFormValues>) => {
    setRoleFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    // 고치는 즉시 그 칸의 오류를 지운다 — 고친 값 옆에 낡은 오류가 남으면 안 된다.
    setRoleFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });

    for (const key of Object.keys(patch)) activeRoleWrite.clearFieldError(key);
  };

  /** 저장. **화면이 잡을 수 있는 오류가 있으면 요청을 보내지 않는다.** */
  const handleSaveRole = () => {
    if (roleFormState === null) return;

    const errors = validateRoleForm(roleFormState.values);
    setRoleFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    activeRoleWrite.write(roleFormState.values);
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
    ...selectableOptions(departmentOptions, formState?.values.departmentId ?? ''),
  ];

  const statusDisabledReason = userStatusOptions.isError
    ? t.actionReasons.statusLookupFailed
    : userStatusOptions.isLoading
      ? t.actionReasons.statusLookupLoading
      : userStatusOptions.entries.length === 0
        ? t.actionReasons.statusLookupEmpty
        : null;

  const userStatusSelectOptions = selectableOptions(
    userStatusOptions,
    formState?.values.statusCode ?? '',
  );

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
          /*
           * 병합 순서 — **로컬 검증이 서버 오류를 덮는다**(수정 폼과 같은 순서다). 지금 고칠 수
           * 있는 것을 먼저 보인다.
           *
           * ⚠ **형제 화면(`password-change`)은 반대로 「서버 진술이 이긴다」를 실측 근거까지 달아
           * 두었다.** 여기서 순서를 뒤집지 않는 근거는 **이 칸에서 서버가 낼 수 있는 말이 길이와
           * 형식 둘뿐이고**(8자 미만 → `RANGE`, 문자열 아님 → `INVALID` — `initial-password.ts`의
           * 실측), **그 둘이 화면 규칙이 이미 포함하는 부분집합**이라는 것이다. 가려도 잃는 정보가
           * 없으므로 그쪽 화면이 막으려던 사고(서버가 거절한 값을 사용자가 그대로 되보낸다)가
           * 여기서는 성립하지 않는다. 그쪽은 현재 비밀번호가 맞는지를 **서버만 아는** 칸이라
           * 사정이 다르다.
           *
           * 값이 화면 규칙을 통과하면 파생값이 `undefined`가 되어 **서버 오류가 다시 보인다** —
           * 화면이 재지 않는 축(예: 확인되지 않은 상한)을 서버가 가진다면 그 말이 제자리에 선다.
           *
           * ⛔ **`password: undefined`를 얹지 않는다.** `fieldErrors`는 `Record<string, string>`
           * 이고 디자인 시스템의 `error`는 truthy 판정을 하므로 키가 있기만 해도 형이 어긋난다.
           * 그래서 **있을 때만** 키를 만든다.
           */
          fieldErrors={{
            ...userCreateWrite.fieldErrors,
            ...userFieldErrors,
            ...(liveInitialPasswordError === undefined
              ? {}
              : { password: liveInitialPasswordError }),
          }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={userCreateWrite.error} />}
          departmentOptions={userDepartmentOptions}
          statusOptions={userStatusSelectOptions}
          statusDisabledReason={statusDisabledReason}
          isDeactivateDisabled={false}
          isDirty={isUserDirty}
          isSaving={userCreateWrite.isSaving}
          onSave={handleSaveUser}
          onCancel={closeUserCreateForm}
          onDeactivate={() => undefined}
          onResetPassword={() => undefined}
        />
      );
    }

    /*
     * 고르기 전 — 사용자 정보 카드와 같은 모양(표제 + 구분선)으로 한 번만 안내한다. 역할 부여·
     * 데이터 접근범위 카드는 여기서 서지 않는다(`renderRoleAssignPane` 등).
     */
    if (selectedAppUserId === null) {
      return (
        <section className="pane users-roles-pane" aria-label={t.panes.userForm}>
          <h2 className="pane-title">{t.panes.userForm}</h2>
          <p className="users-roles-select-hint">{t.user.empty.notSelected}</p>
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
        statusOptions={userStatusSelectOptions}
        statusDisabledReason={statusDisabledReason}
        isDeactivateDisabled={userDetail.data.appUser.isActive === false}
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
        onResetPassword={() => {
          userResetPasswordWrite.reset();
          setIsResetPasswordOpen(true);
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

    /*
     * **역할 선택 목록은 이 구획의 보조가 아니라 내용 그 자체다.** 그것이 실패하면
     * 확인칸이 하나도 서지 않는데, 그때 빈 상태를 내면 「역할이 등록되면 여기에서 부여할 수
     * 있습니다」가 되어 **없는 사실을 단정한다** — 역할이 없는 것이 아니라 못 불러온 것이고,
     * 이 사용자에게 이미 부여된 역할이 있을 수도 있다.
     *
     * 그래서 부여분 실패와 **같은 자리**(조회 실패 배너 + 다시 시도)로 보낸다.
     * 부여분 실패를 먼저 보는 이유는 그것이 이 사용자에게 매인 자료이기 때문이다.
     */
    const roleAssignFailure = userRoleList.isError
      ? { error: userRoleList.error, retry: () => void userRoleList.refetch() }
      : roleOptions.isError
        ? { error: roleOptions.error, retry: roleOptions.refetch }
        : null;

    return (
      <RoleAssignPane
        choices={toRoleChoices(roleOptions.entries, roleSelection)}
        /* 선택 목록과 부여분이 함께 있어야 확인칸 하나를 그릴 수 있다. */
        isLoading={userRoleList.isPending || roleOptions.isLoading}
        /*
         * 실패를 배너로 낸 자리에 같은 뜻의 경고를 겹쳐 내지 않는다 —
         * 배너 둘이 서면 사용자가 서로 다른 두 가지 일이 났다고 읽는다.
         */
        optionsNotice={roleAssignFailure === null ? renderOptionsNotice([roleOptions]) : null}
        loadError={
          roleAssignFailure === null ? null : (
            <LoadErrorBanner error={roleAssignFailure.error} onRetry={roleAssignFailure.retry} />
          )
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

  /** 우 칸 아래 — 데이터 접근범위. 역할 부여와 같은 조건에서 선다. */
  const renderDataScopePane = (): ReactNode => {
    if (selectedAppUserId === null) return null;

    return (
      <DataScopePane
        drafts={dataScopeDrafts}
        isLoading={dataScopeList.isPending}
        businessUnitEntries={businessUnitOptions.entries}
        plantEntries={plantOptions.entries}
        optionsNotice={renderOptionsNotice([businessUnitOptions, plantOptions])}
        loadError={
          dataScopeList.isError ? (
            <LoadErrorBanner
              error={dataScopeList.error}
              onRetry={() => void dataScopeList.refetch()}
            />
          ) : null
        }
        /* 이 치환에도 낙관적 잠금이 없어 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
        banner={<SaveErrorBanner error={dataScopeWrite.error} />}
        isDirty={isDataScopeDirty}
        isSaving={dataScopeWrite.isSaving}
        onAdd={() => {
          openDataScopeDialog(createDataScopeDraft(), true);
        }}
        onEdit={(draftId) => {
          const found = dataScopeDrafts.find((draft) => draft.draftId === draftId);

          if (found !== undefined) openDataScopeDialog(found, false);
        }}
        onRemove={(draftId) => {
          changeDataScopeDrafts((drafts) => removeDataScopeDraft(drafts, draftId));
        }}
        onSave={handleSaveDataScopes}
        onCancel={handleCancelDataScopes}
      />
    );
  };

  const usersTabContent = userListForbidden ? (
    <section className="pane" aria-label={t.panes.userList}>
      <LoadErrorBanner error={userList.error} onRetry={() => void userList.refetch()} />
    </section>
  ) : (
    <div className="two-pane users-roles-layout">
      <UserListPane
        users={users}
        isLoading={userList.isPending}
        appliedFilters={filters}
        onApplyFilters={applyFilters}
        departmentOptions={selectableOptions(departmentOptions, filters.departmentId)}
        statusOptions={selectableOptions(userStatusOptions, filters.statusCode)}
        statusDisabledReason={statusDisabledReason}
        /*
         * 조건 칩에는 번호가 아니라 이름을 낸다. 선택 목록을 아직 받지 못했으면
         * 「알 수 없음」이 나오고 목록이 도착하면 이름으로 바뀐다 —
         * 번호를 대신 보이면 사용자가 쓸 수 없는 값을 자료로 읽는다.
         */
        departmentLabel={(departmentId) => lookupLabel(departmentOptions, Number(departmentId))}
        departmentNameOf={(departmentId) => lookupLabel(departmentOptions, departmentId)}
        statusNameOf={(statusCode) => lookupLabel(userStatusOptions, statusCode)}
        optionsNotice={renderOptionsNotice([departmentOptions, userStatusOptions])}
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
      {userList.data !== undefined && (
        <div className="pane-stack">
          {renderUserFormPane()}
          {renderRoleAssignPane()}
          {renderDataScopePane()}
        </div>
      )}
    </div>
  );

  /**
   * 우 칸 위 — 역할 정보.
   *
   * 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 등록·선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다(사용자 폼과 같은 규칙).
   */
  const renderRoleFormPane = (): ReactNode => {
    if (isCreatingRole) {
      if (roleFormState === null) return null;

      return (
        <RoleFormPane
          mode="create"
          values={roleFormState.values}
          onChange={changeRoleValues}
          fieldErrors={{ ...roleCreateWrite.fieldErrors, ...roleFieldErrors }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={roleCreateWrite.error} />}
          /* 아직 없는 자원이라 잠금 판정의 근거가 없다. */
          editability={null}
          deactivateDisabledReason={null}
          isDirty={isRoleDirty}
          isSaving={roleCreateWrite.isSaving}
          onSave={handleSaveRole}
          onCancel={closeRoleCreateForm}
          onDeactivate={() => undefined}
        />
      );
    }

    if (selectedRoleId === null) {
      return (
        <section className="pane" aria-label={t.panes.roleForm}>
          <EmptyState size="sm" title={t.role.empty.notSelected} />
        </section>
      );
    }

    if (roleDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.roleForm}>
          <LoadErrorBanner error={roleDetail.error} onRetry={reloadRoleDetail} />
        </section>
      );
    }

    if (roleDetail.data === undefined || roleFormState === null) {
      return (
        <section className="pane" aria-label={t.panes.roleForm}>
          <div role="status" aria-label={t.loading.roleDetail}>
            <SkeletonText lines={3} />
          </div>
        </section>
      );
    }

    return (
      <RoleFormPane
        mode="edit"
        values={roleFormState.values}
        onChange={changeRoleValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...roleWrite.fieldErrors, ...roleFieldErrors }}
        banner={<SaveErrorBanner error={roleWrite.error} onReload={reloadRoleDetail} />}
        /* **판정의 주인은 `codeEditable`이다.** 화면이 잠금을 따로 정하지 않는다. */
        editability={roleDetail.data.editability}
        deactivateDisabledReason={
          roleDetail.data.role.isActive === false ? t.actionReasons.deactivateRoleAlreadyDone : null
        }
        isDirty={isRoleDirty}
        isSaving={roleWrite.isSaving}
        onSave={handleSaveRole}
        onCancel={() => {
          setRoleFieldErrors({});
          roleWrite.reset();
          // 취소는 **서버를 부르지 않는다** — 초안을 기준값으로 되돌릴 뿐이다.
          setRoleFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        onDeactivate={() => {
          roleDeactivateWrite.reset();
          setIsRoleDeactivateOpen(true);
        }}
      />
    );
  };

  /**
   * 우 칸 아래 — 기능 권한 격자.
   *
   * **고른 역할이 없으면 페인 자체를 두지 않는다.** 등록 중인 역할에는 아직 부여분이 없고
   * (자원이 만들어지지 않았다), 아무도 고르지 않았으면 누구의 권한인지 알 수 없다.
   */
  const renderPermissionGridPane = (): ReactNode => {
    if (selectedRoleId === null) return null;

    /*
     * 행 라벨은 **고른 역할을 가리키는 값**이라 상세가 오기 전에는 지어내지 않는다.
     * 목록에서 찾을 수 있으면 그것을 쓰고(같은 탭에서 방금 고른 행이다), 없으면 상세를 기다린다.
     */
    const selectedRole =
      roleDetail.data?.role ?? roles.find((row) => row.roleId === selectedRoleId);

    /*
     * **기다려도 오지 않는 경우가 있다.** 상세가 실패하고 그 역할이 지금 쪽의 목록에도 없으면
     * (주소로 직접 들어온 자리다) 이름을 영영 받지 못한다 — 앱이 `retry: 0`이라 스스로 회복되지도 않는다.
     * 그대로 두면 **권한 자료는 이미 손에 있는데 격자 대신 진행 표시가 굳어**,
     * 불러오는 중이 아닌데 불러오는 중이라고 말하는 화면이 된다.
     *
     * 그때는 페인을 두지 않는다. 바로 위 역할 정보 페인이 **같은 실패**를 배너와 「다시 시도」로
     * 이미 내고 있고, 하나의 실패를 배너 둘로 내면 사용자가 서로 다른 두 가지 일이 났다고 읽는다
     * (PR ②가 세운 규칙). 다시 시도가 성공하면 이름이 오고 격자가 선다.
     */
    if (selectedRole === undefined && roleDetail.isError) return null;

    /*
     * **두 조회가 다 있어야 격자가 사실을 말한다.** 부여분이 없으면 켜진 칸을 모르고,
     * 후보가 없으면 줄 수 있는 칸을 모른다. 어느 한쪽이라도 실패하면 격자를 내지 않는다 —
     * 반쪽 격자에서 저장하면 못 본 권한이 조용히 회수된다.
     *
     * 부여분 실패를 먼저 낸다. 그쪽이 저장의 기준값이라 더 위험하다.
     */
    const permissionFailure = rolePermissions.isError
      ? { error: rolePermissions.error, retry: () => void rolePermissions.refetch() }
      : permissionCatalog.isError
        ? { error: permissionCatalog.error, retry: () => void permissionCatalog.refetch() }
        : null;

    return (
      <PermissionGridPane
        roleLabel={selectedRole?.roleCode ?? ''}
        groups={permissionGroups}
        isLoading={
          rolePermissions.isPending || permissionCatalog.isPending || selectedRole === undefined
        }
        /*
         * 실패를 빈 상태로 내면 「부여할 수 있는 권한이 없습니다」가 되어 **없는 사실을
         * 단정한다.** 사용자가 할 수 있는 조치가 재시도뿐이라 배너에 그 길을 함께 낸다.
         */
        loadError={
          permissionFailure === null ? null : (
            <LoadErrorBanner error={permissionFailure.error} onRetry={permissionFailure.retry} />
          )
        }
        banner={<PermissionSaveBanner error={permissionWrite.error} />}
        unlistedNotice={
          hasUnlistedPermission ? <p className="field-note">{t.permission.unlistedNotice}</p> : null
        }
        isDirty={isPermissionDirty}
        isSaving={permissionWrite.isSaving}
        onToggle={handleTogglePermission}
        onSelectAll={handleSelectAllPermissions}
        onClearAll={handleClearAllPermissions}
        onSave={handleSavePermissions}
        onCancel={handleCancelPermissions}
      />
    );
  };

  const rolesTabContent = roleListForbidden ? (
    <section className="pane" aria-label={t.panes.roleList}>
      <LoadErrorBanner error={roleList.error} onRetry={() => void roleList.refetch()} />
    </section>
  ) : (
    <div className="two-pane">
      <RoleListPane
        roles={roles}
        isLoading={roleList.isPending}
        appliedFilters={roleFilters}
        onApplyFilters={applyRoleFilters}
        pageView={rolePageView}
        onChangePage={changeRolePage}
        selectedRoleId={selectedRoleId}
        onSelect={selectRole}
        isCreating={isCreatingRole}
        onAddRole={handleAddRole}
        loadError={
          roleList.isError ? (
            <LoadErrorBanner error={roleList.error} onRetry={() => void roleList.refetch()} />
          ) : null
        }
      />

      {roleList.data !== undefined && (
        <div className="pane-stack">
          {renderRoleFormPane()}
          {renderPermissionGridPane()}
        </div>
      )}
    </div>
  );

  const tabContentOf = (tabId: string): ReactNode => {
    if (tabId === 'users') return usersTabContent;
    if (tabId === 'roles') return rolesTabContent;

    return null;
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
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
          description={t.dialog.deactivateUserDescription}
          showCloseButton={false}
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
          banner={<SaveErrorBanner error={userDeactivateWrite.error} onReload={reloadUserDetail} />}
        />
      )}

      {/* 비밀번호 초기화 확인. 사용 중지 창과 같은 규칙 — 열 때만 붙이고, 실패해도 닫지 않는다. */}
      {isResetPasswordOpen && selectedAppUserId !== null && (
        <ResetPasswordDialog
          open
          onClose={() => {
            setIsResetPasswordOpen(false);
            userResetPasswordWrite.reset();
          }}
          onConfirm={() => {
            if (selectedAppUserId === null) return;

            userResetPasswordWrite.write(undefined);
          }}
          isSaving={userResetPasswordWrite.isSaving}
          banner={<SaveErrorBanner error={userResetPasswordWrite.error} />}
        />
      )}

      <TemporaryPasswordDialog issued={issuedPassword} onClose={() => setIssuedPassword(null)} />

      {/*
       * 역할 사용 중지 창. **같은 창을 쓰고 제목과 본문만 다르다** —
       * 중지했을 때 일어나는 일이 사용자와 달라 본문을 함께 쓰면 사실과 다른 안내가 나간다.
       */}
      {isRoleDeactivateOpen && selectedRoleId !== null && (
        <DeactivateDialog
          open
          title={t.dialog.deactivateRoleTitle}
          description={t.dialog.deactivateRoleDescription}
          onClose={() => {
            setIsRoleDeactivateOpen(false);
            roleDeactivateWrite.reset();
          }}
          onConfirm={() => {
            // 대상이 없으면 보내지 않는다. 위 조건과 짝을 이루는 이중 방어다.
            if (selectedRoleId === null) return;

            roleDeactivateWrite.write(undefined);
          }}
          isSaving={roleDeactivateWrite.isSaving}
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다. */
          banner={<SaveErrorBanner error={roleDeactivateWrite.error} onReload={reloadRoleDetail} />}
        />
      )}

      {/*
       * 접근범위 편집 창도 **열 때만 붙인다.** 고른 사용자가 없으면 붙이지 않는 것이
       * 사용 중지 창과 같은 이중 방어다 — 초안이 사라진 뒤에 창만 남는 자리를 만들지 않는다.
       */}
      {editingDataScope !== null && selectedAppUserId !== null && (
        <DataScopeFormDialog
          draft={editingDataScope}
          isNew={isEditingNewDataScope}
          otherDrafts={dataScopeDrafts}
          /*
           * 지금 고른 값이 선택 목록에 없으면(목록이 잘렸을 때) 코드 그대로 남긴다 —
           * 빼면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
           */
          businessUnitOptions={selectableOptions(
            businessUnitOptions,
            editingDataScope.businessUnitId,
          )}
          plantOptions={selectableOptions(plantOptions, editingDataScope.plantId)}
          onClose={() => {
            setEditingDataScope(null);
          }}
          onConfirm={(next) => {
            /* 확인은 **서버를 부르지 않는다** — 표에만 반영하고 저장에서 한 번에 보낸다. */
            changeDataScopeDrafts((drafts) => upsertDataScopeDraft(drafts, next));
            setEditingDataScope(null);
          }}
        />
      )}
    </>
  );
};
