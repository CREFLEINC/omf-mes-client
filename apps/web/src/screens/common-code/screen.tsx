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
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { CodeGroupFormPane } from './code-group-form-pane';
import { CodeGroupListPane } from './code-group-list-pane';
import {
  codeGroupToFormValues,
  emptyCodeGroupFormValues,
  isSameCodeGroupValues,
  toCodeGroupCreate,
  toCodeGroupUpdate,
} from './code-group-mappers';
import {
  codeGroupDetailPath,
  codeGroupKeys,
  useCodeGroupDetail,
  useCodeGroupList,
} from './code-group-queries';
import { CODE_GROUP_FORM_FIELDS, validateCodeGroupForm } from './code-group-validation';
import { lookupLabel, selectableOptions } from './code-options';
import { CodeValueSection } from './code-value-section';
import { DeactivateDialog } from './deactivate-dialog';
import { DepartmentFormPane } from './department-form-pane';
import { indexById, orderForGrouping, parentOptionsFor } from './department-hierarchy';
import { DepartmentListPane } from './department-list-pane';
import {
  departmentToFormValues,
  emptyDepartmentFormValues,
  isSameDepartmentValues,
  toDepartmentCreate,
  toDepartmentRows,
  toDepartmentUpdate,
} from './department-mappers';
import {
  departmentDetailPath,
  departmentKeys,
  useDepartmentDetail,
  useDepartmentList,
} from './department-queries';
import { DEPARTMENT_FORM_FIELDS, validateDepartmentForm } from './department-validation';
import {
  PARTNER_SELECT_KEY,
  SCOPE_KEYS,
  readCodeGroupFilters,
  readPage,
  readPartnerFilters,
  readScopedFilters,
  readSelectedId,
  toPartnerSearchParams,
  toScopedSearchParams,
  toSearchParams,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  useBusinessUnitOptions,
  useDepartmentOptions,
  usePlantOptions,
  useProcessOptions,
  type LookupResult,
} from './lookups';
import { PartnerListPane } from './partner-list-pane';
import { partnerKeys, usePartnerList, usePartnerRoles } from './partner-queries';
import { PartnerRoleConfirmDialog } from './partner-role-confirm-dialog';
import {
  isSamePartnerRoleSelection,
  releasedPartnerRoles,
  toPartnerRoleChoices,
  toPartnerRoleDraft,
  toPartnerRolesPayload,
  togglePartnerRole,
} from './partner-role-draft';
import { PartnerRolePane } from './partner-role-pane';
import { toPageView } from './pagination';
import {
  createQualificationDraft,
  isSameQualificationDrafts,
  removeQualificationDraft,
  toQualificationDrafts,
  toQualificationsPayload,
  upsertQualificationDraft,
  type QualificationDraft,
} from './qualification-draft';
import { QualificationFormDialog } from './qualification-form-dialog';
import { QualificationPane } from './qualification-pane';
import { COMMON_CODE_TABS, resolveTab, tabSearchParams } from './tabs';
import { WorkerDetailPane } from './worker-detail-pane';
import { WorkerListPane } from './worker-list-pane';
import {
  useWorkerDetail,
  useWorkerList,
  useWorkerQualifications,
  workerKeys,
} from './worker-queries';
import type {
  CodeGroupFilters,
  CodeGroupFormValues,
  DepartmentFormValues,
  PartnerFilters,
  PartnerRole,
  ScopedFilters,
} from './types';

type CodeGroup = components['schemas']['CodeGroup'];
type CodeGroupDetailResponse = components['schemas']['CodeGroupDetailResponse'];
type Department = components['schemas']['Department'];
type DepartmentDetailResponse = components['schemas']['DepartmentDetailResponse'];
type WorkerQualificationListResponse = components['schemas']['WorkerQualificationListResponse'];

const t = messages.commonCode;

/**
 * 폼의 현재 값과 그것이 어디서 나왔는지.
 * 「고친 것이 있는가」는 둘의 비교로 판정하고, 출처가 바뀔 때만 폼을 다시 세운다 —
 * 사용자가 입력하는 동안 값이 되돌아가면 안 된다.
 *
 * **출처는 등록과 수정을 함께 담는다** — 수정은 상세 응답 객체이고, 등록은 주소에서 파생한
 * 문자열이다. 등록 폼의 값을 로컬 상태에만 두면 주소로 직접 들어온 사용자에게 빈 화면이 남는다
 * (여닫음은 주소가 소유한다고 정해 놓고 값은 주소에서 살아나지 못하는 어긋남).
 */
type CodeGroupFormSource = string | CodeGroupDetailResponse;

interface CodeGroupFormState {
  source: CodeGroupFormSource;
  baseline: CodeGroupFormValues;
  values: CodeGroupFormValues;
}

/** 부서 폼도 같은 규칙을 쓴다 — 수정은 상세 응답 객체, 등록은 주소에서 파생한 문자열. */
type DepartmentFormSource = string | DepartmentDetailResponse;

interface DepartmentFormState {
  source: DepartmentFormSource;
  baseline: DepartmentFormValues;
  values: DepartmentFormValues;
}

/**
 * 자격 초안과 그 기준값. 「고친 것이 있는가」는 둘의 비교로 판정하고,
 * **서버 응답 객체가 바뀔 때만** 다시 세운다 — 편집 중에 캐시가 갱신돼도 되돌아가지 않는다.
 */
interface QualificationState {
  source: WorkerQualificationListResponse;
  baseline: QualificationDraft[];
  drafts: QualificationDraft[];
}

/**
 * 역할 초안과 그 기준값. 같은 규칙을 쓴다 — **서버 응답 배열이 바뀔 때만** 다시 세운다.
 *
 * `source`를 함께 들고 다니는 이유는 초안이 코드만 담기 때문이다 — 어휘 밖 코드의 표시명과
 * 「원래 붙어 있던 역할」의 판정이 서버 응답에서 나온다.
 */
interface PartnerRoleState {
  source: PartnerRole[];
  baseline: string[];
  selected: string[];
}

/**
 * W-06-06 컨테이너.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?tab=&q=&inactive=1&page=&grp=&new=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **탭은 만든 것만 렌더한다**(`tabs.ts`). 조직·작업자 탭은 그 탭의 목록·폼이 생길 때 붙는다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 */
export const CommonCodeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  const tab = resolveTab(searchParams.get('tab'));
  const isCodeTab = tab.id === 'code';
  const isOrgTab = tab.id === 'org';
  const isWorkerTab = tab.id === 'worker';
  const isPartnerTab = tab.id === 'partner';

  const filters = useMemo<CodeGroupFilters>(
    () => readCodeGroupFilters(searchParams),
    [searchParams],
  );
  const page = readPage(searchParams);

  const isCreatingCodeGroup = isCodeTab && searchParams.get('new') === 'group';
  const selectedParam = isCodeTab ? readSelectedId(searchParams, 'grp') : null;
  /** 등록 폼이 열려 있는 동안에는 상세를 조회하지 않는다 — 만들고 있는 자원에는 상세가 없다. */
  const selectedCodeGroupId = isCreatingCodeGroup ? null : selectedParam;

  const codeGroupList = useCodeGroupList(filters, page, isCodeTab);
  const codeGroups = codeGroupList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const codeGroupPageView = toPageView(
    codeGroupList.data?.page ?? { page, size: 0, total: 0 },
    codeGroups.length,
  );

  const codeGroupDetail = useCodeGroupDetail(selectedCodeGroupId);

  /*
   * 코드값 한 벌에 넘길 상태. 좌 목록과 **다른 주소 키**를 쓴다 —
   * 한 화면에 쪽이 둘이라 같은 키를 쓰면 한쪽을 옮길 때 다른 쪽까지 따라간다.
   */
  const codeValueIncludeInactive = searchParams.get('vinactive') === '1';
  const codeValuePage = readPage(searchParams, 'vpage');
  const selectedCodeValueId = readSelectedId(searchParams, 'val');
  /*
   * 코드값 등록에는 그룹이 있어야 한다 — 계약이 그룹 번호를 필수로 두었다.
   * 그룹 없이 `new=value`만 실린 주소로 들어와도 만들 수 없는 폼을 세우지 않는다.
   */
  const isCreatingCodeValue = searchParams.get('new') === 'value' && selectedCodeGroupId !== null;

  const [formState, setFormState] = useState<CodeGroupFormState | null>(null);

  /**
   * 폼의 기준값 출처. 수정은 상세 응답 객체가, 등록은 **주소**가 정한다.
   *
   * 출처가 그대로면 다시 세우지 않아 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않는다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   *
   * 등록 출처를 주소에서 파생시키는 것이 핵심이다 — 그래야 새로고침·공유·뒤로가기로
   * `?new=group`에 바로 들어온 사용자에게도 폼이 선다.
   */
  const codeGroupFormSource: CodeGroupFormSource | null = isCreatingCodeGroup
    ? 'create:group'
    : (codeGroupDetail.data ?? null);

  if (codeGroupFormSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== codeGroupFormSource) {
    const seeded =
      typeof codeGroupFormSource === 'string'
        ? emptyCodeGroupFormValues()
        : codeGroupToFormValues(codeGroupFormSource.codeGroup);
    setFormState({ source: codeGroupFormSource, baseline: seeded, values: seeded });
  }

  const isCodeGroupDirty =
    formState !== null && !isSameCodeGroupValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [codeGroupFieldErrors, setCodeGroupFieldErrors] = useState<Record<string, string>>({});

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  /**
   * 주소의 일부만 고친다.
   *
   * **한 조작은 이 함수를 한 번만 부른다.** 한 틱에 두 번 부르면 앞 갱신이 렌더되지 않은 채
   * 히스토리 칸으로 남아, 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어진다.
   * 그래서 「선택을 비우면서 등록을 켠다」 같은 조작은 한 번의 patch 안에서 함께 처리한다.
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

  const selectCodeGroup = (codeGroupId: number) => {
    patchSearchParams((next) => {
      next.set('grp', String(codeGroupId));
      // 다른 그룹의 코드값을 가리키면 안 된다.
      next.delete('val');
      next.delete('vpage');
      // 그룹을 고르는 것과 등록 폼이 열려 있는 것은 함께 성립하지 않는다.
      next.delete('new');
    });
  };

  const codeGroupWrite = useMasterWrite<CodeGroupFormValues, CodeGroup>({
    request: (values, headers) =>
      client.PUT('/mdm/code-groups/{codeGroupId}', {
        params: {
          path: { codeGroupId: selectedCodeGroupId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toCodeGroupUpdate(values),
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 보관 키가 요청 경로라 다른 경로로 꺼내면 언제나 비어 있다.
     * 이 화면의 쓰기 열 가지 중 If-Match 를 요구하는 것은 여섯이고 이것이 그 하나다(계약 실측).
     */
    etagPath: selectedCodeGroupId === null ? null : codeGroupDetailPath(selectedCodeGroupId),
    invalidateKeys: [codeGroupKeys.all],
    knownFields: CODE_GROUP_FORM_FIELDS,
    onSuccess: (saved) => {
      setCodeGroupFieldErrors({});
      const next = codeGroupToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const codeGroupCreateWrite = useMasterWrite<CodeGroupFormValues, CodeGroup>({
    request: (values, headers) =>
      client.POST('/mdm/code-groups', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toCodeGroupCreate(values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [codeGroupKeys.all],
    knownFields: CODE_GROUP_FORM_FIELDS,
    onSuccess: (saved) => {
      setCodeGroupFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 그룹을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 그룹을 직접 찾아야 한다.
       *
       * **주소 갱신은 이 한 번뿐이다.** `new`를 지우는 것과 `grp`를 새 번호로 놓는 것을
       * 한 patch 안에서 함께 한다 — 나눠 부르면 뒤로가기가 중간 상태로 떨어진다.
       */
      selectCodeGroup(saved.codeGroupId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 사용 중지 — **본문이 없다.**
   *
   * 응답에 `ETag`가 없으므로 성공하면 상세까지 무효화해 재조회가 새 토큰을 확보하게 한다.
   * 무효화를 빠뜨리면 보관된 토큰이 낡아 그다음 저장이 조용히 막힌다.
   */
  const codeGroupDeactivateWrite = useMasterWrite<void, CodeGroup>({
    request: (_variables, headers) =>
      client.POST('/mdm/code-groups/{codeGroupId}:deactivate', {
        params: {
          path: { codeGroupId: selectedCodeGroupId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 요청 경로(`…:deactivate`)로 꺼내면 언제나 비어 있어
     * 사용 중지가 전부 실패한다.
     */
    etagPath: selectedCodeGroupId === null ? null : codeGroupDetailPath(selectedCodeGroupId),
    invalidateKeys: [codeGroupKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 지금 모드의 쓰기. 등록과 수정이 **한 폼 상태**를 쓰므로 저장·오류·진행 표시도
   * 한 곳에서 골라 쓴다 — 두 훅의 상태를 화면에서 합치면 어느 저장의 실패인지 흐려진다.
   */
  const activeCodeGroupWrite = isCreatingCodeGroup ? codeGroupCreateWrite : codeGroupWrite;

  /** 편집 중이던 상태를 통째로 비운다. 보이는 행이 달라질 때 함께 부른다. */
  const resetCodeGroupEditing = () => {
    codeGroupWrite.reset();
    codeGroupCreateWrite.reset();
    codeGroupDeactivateWrite.reset();
    setIsDeactivateOpen(false);
    setFormState(null);
    setCodeGroupFieldErrors({});
  };

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `grp`·`val`·`vpage`·`vinactive`·`new`가 자연히 사라진다 — 보이는 행이 달라지는데
   * 선택이 남으면 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: CodeGroupFilters) => {
    resetCodeGroupEditing();
    setSearchParams(toSearchParams(tab.id, next, 1));
  };

  const changeCodeGroupPage = (nextPage: number) => {
    resetCodeGroupEditing();
    setSearchParams(toSearchParams(tab.id, filters, nextPage));
  };

  const handleSelectCodeGroup = (codeGroupId: number) => {
    resetCodeGroupEditing();
    selectCodeGroup(codeGroupId);
  };

  const handleAddCodeGroup = () => {
    resetCodeGroupEditing();

    patchSearchParams((next) => {
      next.set('new', 'group');
      // 등록 폼이 열려 있는 동안 고른 그룹의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('grp');
      next.delete('val');
      next.delete('vpage');
    });
  };

  const closeCodeGroupCreateForm = () => {
    codeGroupCreateWrite.reset();
    setCodeGroupFieldErrors({});

    patchSearchParams((next) => {
      next.delete('new');
    });
  };

  /**
   * 코드값 한 벌이 주소에 바라는 것은 **조작 단위**다.
   *
   * 「고른다」·「등록 폼을 연다」·「조건을 바꾼다」가 각각 patch 한 번으로 끝나야
   * 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어지지 않는다. 그래서 각 함수가
   * 그 조작에 딸린 주소 규칙(선택과 등록 폼은 함께 성립하지 않는다 등)까지 함께 처리한다.
   */
  const clearCodeValueCreating = (next: URLSearchParams) => {
    // 코드그룹 등록 폼이 열려 있는 상태를 코드값 쪽 조작이 닫아 버리면 안 된다.
    if (next.get('new') === 'value') next.delete('new');
  };

  const selectCodeValue = (codeValueId: number) => {
    patchSearchParams((next) => {
      next.set('val', String(codeValueId));
      clearCodeValueCreating(next);
    });
  };

  const openCodeValueCreate = () => {
    patchSearchParams((next) => {
      next.set('new', 'value');
      // 등록 폼이 열려 있는 동안 고른 코드값의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('val');
    });
  };

  const closeCodeValueCreate = () => {
    patchSearchParams(clearCodeValueCreating);
  };

  /** 코드값 조건이 바뀌면 보이는 행이 달라진다 — 코드값 선택과 쪽을 함께 비운다. */
  const changeCodeValueIncludeInactive = (includeInactive: boolean) => {
    patchSearchParams((next) => {
      if (includeInactive) {
        next.set('vinactive', '1');
      } else {
        next.delete('vinactive');
      }

      next.delete('val');
      next.delete('vpage');
      clearCodeValueCreating(next);
    });
  };

  const changeCodeValuePage = (nextPage: number) => {
    patchSearchParams((next) => {
      if (nextPage > 1) {
        next.set('vpage', String(nextPage));
      } else {
        next.delete('vpage');
      }

      // 쪽을 옮기면 보이는 행이 달라진다 — 목록에 없는 코드값을 가리키면 안 된다.
      next.delete('val');
      clearCodeValueCreating(next);
    });
  };

  /* ── 조직(부서) 탭 ─────────────────────────────────────────────────────── */

  const departmentFilters = useMemo(
    () => readScopedFilters(searchParams, SCOPE_KEYS.businessUnit),
    [searchParams],
  );

  const isCreatingDepartment = isOrgTab && searchParams.get('new') === 'dept';
  const selectedDepartmentParam = isOrgTab ? readSelectedId(searchParams, 'dep') : null;
  const selectedDepartmentId = isCreatingDepartment ? null : selectedDepartmentParam;

  const departmentList = useDepartmentList(departmentFilters, page, isOrgTab);

  /*
   * 계약 표현을 화면 표현으로 옮기며 **자기참조를 여기서 한 번만 접는다** —
   * 목 서버가 실제로 그런 행을 준다. 접지 않으면 대표가 자기 자신인 그룹이 생긴다.
   */
  const departmentRows = useMemo(
    () => toDepartmentRows(departmentList.data?.items ?? []),
    [departmentList.data],
  );
  const departmentById = useMemo(() => indexById(departmentRows), [departmentRows]);
  /* 디자인 시스템 Table의 그룹 순서는 rows에서 그 키가 처음 나온 순서다 — 화면이 미리 정렬한다. */
  const orderedDepartments = useMemo(
    () => orderForGrouping(departmentRows, departmentById),
    [departmentRows, departmentById],
  );

  const departmentPageView = toPageView(
    departmentList.data?.page ?? { page, size: 0, total: 0 },
    departmentRows.length,
  );

  const departmentDetail = useDepartmentDetail(selectedDepartmentId);

  /** 부서 정보 폼이 화면에 있는가 — 상위 선택지는 그때만 조회한다. */
  const isDepartmentFormOpen = isCreatingDepartment || selectedDepartmentId !== null;

  const businessUnitOptions = useBusinessUnitOptions(isOrgTab);
  /*
   * 상위 선택지는 **조회 조건과 무관한 전체 목록**을 따로 받는다 —
   * 쪽 나눔 때문에 상위 부서가 다른 쪽에 있을 수 있어 보이는 목록만으로는 고를 수 없다.
   */
  const departmentOptions = useDepartmentOptions(isOrgTab && isDepartmentFormOpen);

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
   * 부서를 고른다. **주소 갱신 한 번으로 끝낸다** — 선택과 등록 폼은 함께 성립하지 않으므로
   * 그 규칙까지 이 patch 안에서 처리한다. 나눠 부르면 뒤로가기가 중간 상태로 떨어진다.
   */
  const handleSelectDepartment = (departmentId: number) => {
    patchSearchParams((next) => {
      next.set('dep', String(departmentId));
      next.delete('new');
    });
  };

  const [departmentFormState, setDepartmentFormState] = useState<DepartmentFormState | null>(null);

  /**
   * 부서 폼의 기준값 출처. 수정은 상세 응답 객체가, 등록은 **주소**가 정한다 —
   * 코드그룹과 같은 규칙이다. 등록 출처를 주소에서 파생시켜야 `?tab=org&new=dept`로
   * 바로 들어온 사용자에게도 폼이 선다.
   */
  const departmentFormSource: DepartmentFormSource | null = isCreatingDepartment
    ? 'create:department'
    : (departmentDetail.data ?? null);

  if (departmentFormSource === null) {
    if (departmentFormState !== null) setDepartmentFormState(null);
  } else if (departmentFormState?.source !== departmentFormSource) {
    const seeded =
      typeof departmentFormSource === 'string'
        ? emptyDepartmentFormValues()
        : departmentToFormValues(departmentFormSource.department);
    setDepartmentFormState({ source: departmentFormSource, baseline: seeded, values: seeded });
  }

  const isDepartmentDirty =
    departmentFormState !== null &&
    !isSameDepartmentValues(departmentFormState.values, departmentFormState.baseline);

  const [departmentFieldErrors, setDepartmentFieldErrors] = useState<Record<string, string>>({});
  const [isDepartmentDeactivateOpen, setIsDepartmentDeactivateOpen] = useState(false);

  const departmentWrite = useMasterWrite<DepartmentFormValues, Department>({
    request: (values, headers) =>
      client.PUT('/mdm/departments/{departmentId}', {
        params: {
          path: { departmentId: selectedDepartmentId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toDepartmentUpdate(values),
      }),
    /* 잠금 토큰은 상세 경로에 보관돼 있다. 다른 경로로 꺼내면 언제나 비어 있다. */
    etagPath: selectedDepartmentId === null ? null : departmentDetailPath(selectedDepartmentId),
    // 상위 선택지도 함께 무효화된다 — 이름이 바뀌면 선택지 문구도 바뀐다.
    invalidateKeys: [departmentKeys.all],
    knownFields: DEPARTMENT_FORM_FIELDS,
    onSuccess: (saved) => {
      setDepartmentFieldErrors({});
      const next = departmentToFormValues(saved);
      setDepartmentFormState((prev) =>
        prev === null ? prev : { ...prev, baseline: next, values: next },
      );
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const departmentCreateWrite = useMasterWrite<DepartmentFormValues, Department>({
    request: (values, headers) =>
      client.POST('/mdm/departments', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toDepartmentCreate(values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [departmentKeys.all],
    knownFields: DEPARTMENT_FORM_FIELDS,
    onSuccess: (saved) => {
      setDepartmentFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 부서를 고르면 상세를 다시 조회하게 되고 그 조회가 토큰을 확보한다.
       * **주소 갱신은 이 한 번뿐이다**(`new` 해제 + `dep` 설정을 한 patch로).
       */
      handleSelectDepartment(saved.departmentId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 사용 중지 — **본문이 없다.**
   *
   * 응답에 `ETag`가 없으므로 성공하면 상세까지 무효화해 재조회가 새 토큰을 확보하게 한다.
   * 무효화를 빠뜨리면 보관된 토큰이 낡아 그다음 저장이 조용히 막힌다.
   */
  const departmentDeactivateWrite = useMasterWrite<void, Department>({
    request: (_variables, headers) =>
      client.POST('/mdm/departments/{departmentId}:deactivate', {
        params: {
          path: { departmentId: selectedDepartmentId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: selectedDepartmentId === null ? null : departmentDetailPath(selectedDepartmentId),
    invalidateKeys: [departmentKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDepartmentDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const activeDepartmentWrite = isCreatingDepartment ? departmentCreateWrite : departmentWrite;

  /** 편집 중이던 상태를 통째로 비운다. 보이는 행이 달라질 때 함께 부른다. */
  const resetDepartmentEditing = () => {
    departmentWrite.reset();
    departmentCreateWrite.reset();
    departmentDeactivateWrite.reset();
    setIsDepartmentDeactivateOpen(false);
    setDepartmentFormState(null);
    setDepartmentFieldErrors({});
  };

  const applyDepartmentFilters = (next: ScopedFilters) => {
    resetDepartmentEditing();
    setSearchParams(toScopedSearchParams(tab.id, SCOPE_KEYS.businessUnit, next, 1));
  };

  const changeDepartmentPage = (nextPage: number) => {
    resetDepartmentEditing();
    setSearchParams(
      toScopedSearchParams(tab.id, SCOPE_KEYS.businessUnit, departmentFilters, nextPage),
    );
  };

  const handleSelectDepartmentRow = (departmentId: number) => {
    resetDepartmentEditing();
    handleSelectDepartment(departmentId);
  };

  const handleAddDepartment = () => {
    resetDepartmentEditing();

    patchSearchParams((next) => {
      next.set('new', 'dept');
      // 등록 폼이 열려 있는 동안 고른 부서의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('dep');
    });
  };

  const closeDepartmentCreateForm = () => {
    departmentCreateWrite.reset();
    setDepartmentFieldErrors({});

    patchSearchParams((next) => {
      // 코드그룹·코드값 쪽 등록 폼을 부서 쪽 조작이 닫아 버리면 안 된다.
      if (next.get('new') === 'dept') next.delete('new');
    });
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeDepartmentValues = (patch: Partial<DepartmentFormValues>) => {
    setDepartmentFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      activeDepartmentWrite.clearFieldError(field);
      setDepartmentFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveDepartment = () => {
    if (departmentFormState === null) return;

    const errors = validateDepartmentForm(departmentFormState.values);
    setDepartmentFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    activeDepartmentWrite.write(departmentFormState.values);
  };

  const reloadDepartmentDetail = () => {
    departmentWrite.reset();
    departmentDeactivateWrite.reset();
    setDepartmentFieldErrors({});
    setDepartmentFormState(null);
    void departmentDetail.refetch();
  };

  /* ── 작업자 탭 ─────────────────────────────────────────────────────────── */

  const workerFilters = useMemo(
    () => readScopedFilters(searchParams, SCOPE_KEYS.department),
    [searchParams],
  );

  const selectedWorkerId = isWorkerTab ? readSelectedId(searchParams, 'wkr') : null;

  const workerList = useWorkerList(workerFilters, page, isWorkerTab);
  const workers = workerList.data?.items ?? [];

  const workerPageView = toPageView(
    workerList.data?.page ?? { page, size: 0, total: 0 },
    workers.length,
  );

  const workerDetail = useWorkerDetail(selectedWorkerId);

  /*
   * 작업자 탭이 쓰는 선택지 셋. 부서는 필터에도 상세 표기에도 쓰이므로 탭에 들어오면 받고,
   * 사업부·공장은 **상세 표기에만** 쓰이므로 작업자를 고른 뒤에 받는다 —
   * 목록만 훑는 동안 쓰지 않을 목록을 받아 둘 이유가 없다.
   */
  const workerDepartmentOptions = useDepartmentOptions(isWorkerTab);
  const workerBusinessUnits = useBusinessUnitOptions(isOrgTab || selectedWorkerId !== null);
  const plantOptions = usePlantOptions(selectedWorkerId !== null);

  /* ── 자격·인증 ─────────────────────────────────────────────────────────── */

  const qualificationList = useWorkerQualifications(selectedWorkerId);
  const processOptions = useProcessOptions(selectedWorkerId !== null);

  const [qualificationState, setQualificationState] = useState<QualificationState | null>(null);

  /**
   * 초안의 출처. 서버 응답 객체가 바뀔 때만 다시 세운다 —
   * 사용자가 표를 고치는 동안 캐시가 갱신돼도 편집 중인 목록이 되돌아가지 않는다.
   */
  const qualificationSource = qualificationList.data ?? null;

  if (qualificationSource === null) {
    if (qualificationState !== null) setQualificationState(null);
  } else if (qualificationState?.source !== qualificationSource) {
    const seeded = toQualificationDrafts(qualificationSource.items);
    setQualificationState({ source: qualificationSource, baseline: seeded, drafts: seeded });
  }

  const qualificationDrafts = qualificationState?.drafts ?? [];
  const isQualificationDirty =
    qualificationState !== null &&
    !isSameQualificationDrafts(qualificationState.drafts, qualificationState.baseline);

  /** 편집 창의 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다. */
  const [editingQualification, setEditingQualification] = useState<QualificationDraft | null>(null);
  const [isEditingNewQualification, setIsEditingNewQualification] = useState(false);

  const qualificationWrite = useMasterWrite<QualificationDraft[], WorkerQualificationListResponse>({
    request: (drafts, headers) =>
      client.PUT('/mdm/workers/{workerId}/qualifications', {
        params: {
          path: { workerId: selectedWorkerId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { qualifications: toQualificationsPayload(drafts) },
      }),
    /*
     * **반드시 `null`이다.** 계약에 이 쓰기의 `If-Match` 파라미터 자체가 없고,
     * 더구나 `GET /mdm/workers/{id}`가 `ETag`를 주지 않는다 — 상세 경로를 주면 토큰을 찾지 못해
     * 요청이 **나가지 않고 멈춘다**(「저장을 눌러도 아무 일이 없다」).
     */
    etagPath: null,
    invalidateKeys: [workerKeys.all],
    // 대응하는 입력칸이 이 구획에 없다(창 안에 있다) — 필드 오류도 배너로 올린다.
    knownFields: [],
    onSuccess: (saved) => {
      /*
       * **서버 응답으로 초안을 다시 세운다.** 서버가 행 번호를 새로 매기므로
       * 보낸 목록을 그대로 두면 다음 저장이 옛 번호로 도는 것처럼 보인다.
       */
      const next = toQualificationDrafts(saved.items);
      setQualificationState({ source: saved, baseline: next, drafts: next });
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const resetQualificationEditing = () => {
    qualificationWrite.reset();
    setEditingQualification(null);
    setQualificationState(null);
  };

  /*
   * 작업자 탭의 주소 조작 셋은 **자격 편집 상태를 함께 비운다.**
   * 자격은 고른 작업자에 매인 자료라 보이는 작업자가 달라지면 편집 중이던 초안·저장 실패 배너가
   * 남을 자리가 없다 — 남기면 뒤로가기로 돌아왔을 때 **남의 실패 배너**를 보게 된다.
   * 그래서 초기화 함수 뒤에 모아 둔다(코드그룹·부서와 같은 형태).
   */
  const handleSelectWorker = (workerId: number) => {
    resetQualificationEditing();

    patchSearchParams((next) => {
      next.set('wkr', String(workerId));
    });
  };

  const applyWorkerFilters = (next: ScopedFilters) => {
    resetQualificationEditing();
    setSearchParams(toScopedSearchParams(tab.id, SCOPE_KEYS.department, next, 1));
  };

  const changeWorkerPage = (nextPage: number) => {
    resetQualificationEditing();
    setSearchParams(toScopedSearchParams(tab.id, SCOPE_KEYS.department, workerFilters, nextPage));
  };

  const changeQualificationDrafts = (
    next: (drafts: QualificationDraft[]) => QualificationDraft[],
  ) => {
    setQualificationState((prev) =>
      prev === null ? prev : { ...prev, drafts: next(prev.drafts) },
    );
  };

  const openQualificationDialog = (draft: QualificationDraft, isNew: boolean) => {
    qualificationWrite.reset();
    setIsEditingNewQualification(isNew);
    setEditingQualification(draft);
  };

  const handleSaveQualifications = () => {
    if (qualificationState === null) return;

    qualificationWrite.write(qualificationState.drafts);
  };

  /* ── 거래처 역할 탭 ─────────────────────────────────────────────────────── */

  const partnerFilters = useMemo<PartnerFilters>(
    () => readPartnerFilters(searchParams),
    [searchParams],
  );

  const selectedPartnerId = isPartnerTab ? readSelectedId(searchParams, PARTNER_SELECT_KEY) : null;

  const partnerList = usePartnerList(partnerFilters, page, isPartnerTab);
  const partners = partnerList.data?.items ?? [];

  const partnerPageView = toPageView(
    partnerList.data?.page ?? { page, size: 0, total: 0 },
    partners.length,
  );

  /**
   * 고른 거래처의 기본 정보. **계약에 거래처 상세 경로가 없어** 지금 목록에 있는 행에서만 온다 —
   * 주소를 손으로 고쳐 목록 밖 거래처를 가리키면 채울 자료가 없고, 그 사실을 그대로 밝힌다.
   */
  const selectedPartner = partners.find((row) => row.partnerId === selectedPartnerId) ?? null;

  const partnerRoles = usePartnerRoles(selectedPartnerId);

  const [partnerRoleState, setPartnerRoleState] = useState<PartnerRoleState | null>(null);

  /**
   * 초안의 출처. 서버 응답 배열이 바뀔 때만 다시 세운다 —
   * 사용자가 체크를 고치는 동안 캐시가 갱신돼도 편집 중인 선택이 되돌아가지 않는다.
   */
  const partnerRoleSource = partnerRoles.data ?? null;

  if (partnerRoleSource === null) {
    if (partnerRoleState !== null) setPartnerRoleState(null);
  } else if (partnerRoleState?.source !== partnerRoleSource) {
    const seeded = toPartnerRoleDraft(partnerRoleSource);
    setPartnerRoleState({ source: partnerRoleSource, baseline: seeded, selected: seeded });
  }

  const partnerRoleChoices =
    partnerRoleState === null
      ? []
      : toPartnerRoleChoices(partnerRoleState.source, partnerRoleState.selected);

  const isPartnerRoleDirty =
    partnerRoleState !== null &&
    !isSamePartnerRoleSelection(partnerRoleState.selected, partnerRoleState.baseline);

  /**
   * 저장하면 **해제되는** 역할. 확인 창을 세울지 정하는 근거이자 창이 나열하는 목록이다 —
   * 판정과 표시가 같은 자리에서 나와야 「창이 말한 것」과 「실제로 잃는 것」이 갈리지 않는다.
   */
  const releasedRoles =
    partnerRoleState === null
      ? []
      : releasedPartnerRoles(partnerRoleState.source, partnerRoleState.selected);

  /** 확인 창은 **열 때만 붙인다** — 닫힌 창을 남기면 지난 목록이 그대로 살아 있다. */
  const [isPartnerRoleConfirmOpen, setIsPartnerRoleConfirmOpen] = useState(false);

  /**
   * 역할 통째 교체.
   *
   * ⛔ **`etagPath`가 반드시 `null`이다.** 계약에 이 쓰기의 `If-Match` 파라미터 자체가 없고
   * 응답에 `409`도 없다 — 거래처 역할은 부여·회수 형이라 낙관적 잠금 대상이 아니다.
   * 상세 경로를 넘기면 토큰을 찾지 못해 **요청이 나가지 않고 멈춘다**(「저장을 눌러도 아무 일이
   * 없다」). 같은 슬라이스의 작업자 자격 치환이 같은 형태다. `If-Match`를 **쓰는** 전례
   * (결재선 단계 치환)는 부모 자원에 `version_no`가 있어 토큰이 존재하는 경우이고 여기와 다르다.
   *
   * **무효화는 역할 키 하나뿐이다.** 이 치환으로 거래처 본체가 바뀌지 않으므로 목록까지
   * 무효화하면 아무것도 달라지지 않을 조회를 다시 낸다.
   */
  const partnerRoleWrite = useMasterWrite<readonly string[], PartnerRole[]>({
    request: (selected, headers) =>
      client.PUT('/mdm/partners/{partnerId}/roles', {
        params: {
          /* 고른 거래처가 없으면 여기까지 오지 않는다 — 저장 컨트롤이 그 상태에 서지 않는다. */
          path: { partnerId: selectedPartnerId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: toPartnerRolesPayload(partnerRoleState?.source ?? [], selected),
      }),
    etagPath: null,
    invalidateKeys: [partnerKeys.roles(selectedPartnerId ?? 0)],
    // 체크칸에는 계약의 필드 이름이 붙지 않는다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: (saved) => {
      /*
       * **서버 응답이 정본이다.** 보낸 목록을 그대로 두면 서버가 정규화한 결과
       * (모르는 코드를 버렸다거나 이름을 다시 붙였다거나)를 놓친다.
       *
       * 그 응답을 **조회 캐시에 앉힌다.** 지역 상태에만 두면 초안의 출처(조회 캐시)와 어긋나
       * 바로 다음 렌더에서 초안이 **저장 전 목록으로 되돌아간다** — 위 되세우기 규칙이
       * 「출처가 바뀌었다」로 읽기 때문이다. 무효화가 낸 재조회는 이 값을 나중에 서버의 것으로
       * 확인해 준다. 응답이 앉는 자리는 **보낸 요청의 캐시 키**라 그사이 선택이 옮겨 가도
       * 남의 자리에 앉지 않는다.
       */
      queryClient.setQueryData(partnerKeys.roles(selectedPartnerId ?? 0), saved);
      /*
       * **초안을 비워 되세우기를 다시 열어 준다.** 조회 라이브러리는 새 값이 옛 값과 깊이 같으면
       * **옛 참조를 그대로 유지한다**(`replaceEqualDeep`) — 그러면 위 규칙이 「출처가 그대로」로
       * 읽어 초안이 다시 서지 않고, 화면은 서버가 말한 상태가 아니라 **사용자가 고른 상태**를
       * 계속 보인다(서버가 저장을 조용히 무시한 경우가 정확히 그 갈래다).
       * 비워 두면 다음 렌더가 **갱신된 캐시**에서 초안을 다시 세운다.
       */
      setPartnerRoleState(null);
      setIsPartnerRoleConfirmOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * **나가는 중인 저장이 지금 보고 있는 거래처의 것인가.**
   *
   * `resetIfIdle`는 나가는 중인 쓰기를 **거두지 않는다**(옳다 — 되먹임을 끊지 않는다).
   * 그래서 거두지 못한 상태(`isSaving`·`error`)가 그대로 남는데, 그사이 사용자가 다른 거래처를
   * 고르면 **손댄 적 없는 거래처에 「저장 중」과 「저장이 막혔습니다」가 선다.** 좌 목록은 저장
   * 중에도 잠기지 않으므로 특수한 경로가 아니다.
   *
   * 끊는 것과 **가리는 것**은 다르다 — 되먹임은 그대로 두고, *보이는 것*만 대상이 같을 때 낸다.
   * 같은 저장소의 전례 둘이 같은 자리에 같은 축을 두었다(`iqc-skip-approval`의
   * `isWriteResultMine` · `disposal-issue`의 `isChainForCurrentTarget`).
   */
  const [roleWriteTargetId, setRoleWriteTargetId] = useState<number | null>(null);

  const isRoleWriteMine = roleWriteTargetId === selectedPartnerId;

  /** 저장을 내는 자리는 둘(확인 창 있는 길·없는 길)뿐이고 **둘 다 여기를 지난다.** */
  const writePartnerRoles = (selected: readonly string[]) => {
    setRoleWriteTargetId(selectedPartnerId);
    partnerRoleWrite.write(selected);
  };

  /**
   * **나가는 중인 쓰기는 건드리지 않는다**(`omf-mes#96`).
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 옵저버를 떼어 낸다 — 그 호출에 매달린 되먹임이
   * 통째로 오지 않는다(무효화도, 성공도, 실패도). 요청은 이미 서버에 갔는데 화면만 없던 일로
   * 친다. **`reset()`을 부르는 자리가 전부 이 함수를 지난다.**
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /*
   * 거래처 탭의 주소 조작 셋은 **역할 편집 상태를 함께 비운다.** 역할은 고른 거래처에 매인
   * 자료라 보이는 거래처가 달라지면 편집 중이던 초안·저장 실패 배너가 남을 자리가 없다 —
   * 남기면 뒤로가기로 돌아왔을 때 **남의 실패 배너**를 보게 된다.
   */
  const resetPartnerRoleEditing = () => {
    resetIfIdle(partnerRoleWrite);
    setIsPartnerRoleConfirmOpen(false);
    setPartnerRoleState(null);
  };

  const handleSelectPartner = (partnerId: number) => {
    resetPartnerRoleEditing();

    patchSearchParams((next) => {
      next.set(PARTNER_SELECT_KEY, String(partnerId));
    });
  };

  const applyPartnerFilters = (next: PartnerFilters) => {
    resetPartnerRoleEditing();
    setSearchParams(toPartnerSearchParams(tab.id, next, 1));
  };

  const changePartnerPage = (nextPage: number) => {
    resetPartnerRoleEditing();
    setSearchParams(toPartnerSearchParams(tab.id, partnerFilters, nextPage));
  };

  const togglePartnerRoleChoice = (roleTypeCode: string) => {
    setPartnerRoleState((prev) =>
      prev === null ? prev : { ...prev, selected: togglePartnerRole(prev.selected, roleTypeCode) },
    );
  };

  /**
   * 저장 — **잃는 것이 있을 때만 확인을 세운다**(결정 10).
   *
   * 추가만 하는 저장에까지 창을 세우면 확인이 습관이 되어 정작 잃는 저장에서도 읽히지 않는다.
   */
  const handleSavePartnerRoles = () => {
    if (partnerRoleState === null) return;

    if (releasedRoles.length > 0) {
      setIsPartnerRoleConfirmOpen(true);
      return;
    }

    writePartnerRoles(partnerRoleState.selected);
  };

  const confirmSavePartnerRoles = () => {
    if (partnerRoleState === null) return;

    writePartnerRoles(partnerRoleState.selected);
  };

  /*
   * 탭이 바뀌면 그 탭의 처음 상태로 간다. 한쪽 탭의 조건·선택이 남으면
   * 그 탭에 없는 자원을 조회하게 된다.
   */
  const changeTab = (value: string) => {
    resetCodeGroupEditing();
    resetDepartmentEditing();
    resetQualificationEditing();
    resetPartnerRoleEditing();
    setSearchParams(tabSearchParams(value));
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeCodeGroupValues = (patch: Partial<CodeGroupFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      activeCodeGroupWrite.clearFieldError(field);
      setCodeGroupFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveCodeGroup = () => {
    if (formState === null) return;

    const errors = validateCodeGroupForm(formState.values);
    setCodeGroupFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    activeCodeGroupWrite.write(formState.values);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const reloadCodeGroupDetail = () => {
    codeGroupWrite.reset();
    codeGroupDeactivateWrite.reset();
    setCodeGroupFieldErrors({});
    setFormState(null);
    void codeGroupDetail.refetch();
  };

  /*
   * 이미 미사용이면 되돌릴 수 없는 조작을 다시 할 이유가 없다.
   * 감추지 않고 사유와 함께 비활성으로 둔다 — 감추면 「이 화면에는 없는 기능」으로 오해한다.
   */
  const deactivateDisabledReason =
    codeGroupDetail.data?.codeGroup.isActive === false
      ? t.actionReasons.deactivateAlreadyDone(t.targets.codeGroup)
      : null;

  /**
   * 우 칸 위쪽 — 코드그룹 정보.
   *
   * 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 등록·선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderCodeGroupFormPane = (): ReactNode => {
    if (isCreatingCodeGroup) {
      if (formState === null) return null;

      return (
        <CodeGroupFormPane
          mode="create"
          values={formState.values}
          onChange={changeCodeGroupValues}
          fieldErrors={{ ...codeGroupCreateWrite.fieldErrors, ...codeGroupFieldErrors }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={codeGroupCreateWrite.error} />}
          /* 등록에서는 코드 칸이 열려 있다 — 아직 참조할 자료가 없다. */
          codeLockReason={null}
          deactivateDisabledReason={null}
          isDirty={isCodeGroupDirty}
          isSaving={codeGroupCreateWrite.isSaving}
          onSave={handleSaveCodeGroup}
          onCancel={closeCodeGroupCreateForm}
          onDeactivate={() => undefined}
        />
      );
    }

    if (selectedCodeGroupId === null) {
      return <EmptyState size="sm" title={t.codeGroup.empty.notSelected} />;
    }

    if (codeGroupDetail.isError) {
      return (
        <LoadErrorBanner
          error={codeGroupDetail.error}
          onRetry={() => void codeGroupDetail.refetch()}
        />
      );
    }

    if (codeGroupDetail.data === undefined || formState === null) {
      return (
        <div role="status" aria-label={t.loading.codeGroupDetail}>
          <SkeletonText lines={4} />
        </div>
      );
    }

    return (
      <CodeGroupFormPane
        mode="edit"
        values={formState.values}
        onChange={changeCodeGroupValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...codeGroupWrite.fieldErrors, ...codeGroupFieldErrors }}
        banner={<SaveErrorBanner error={codeGroupWrite.error} onReload={reloadCodeGroupDetail} />}
        /*
         * 판정의 주인은 서버가 준 `codeEditable`이다. 화면이 스스로 잠그지 않는다 —
         * `reason`이 `EDITABLE`인데 잠긴 어긋난 조합이 실제로 내려온다.
         */
        codeLockReason={codeLockMessage(codeGroupDetail.data.editability)}
        deactivateDisabledReason={deactivateDisabledReason}
        isDirty={isCodeGroupDirty}
        isSaving={codeGroupWrite.isSaving}
        onSave={handleSaveCodeGroup}
        onCancel={() => {
          setCodeGroupFieldErrors({});
          codeGroupWrite.reset();
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        onDeactivate={() => {
          codeGroupDeactivateWrite.reset();
          setIsDeactivateOpen(true);
        }}
      />
    );
  };

  const codeTabContent = (
    <div className="two-pane">
      <CodeGroupListPane
        codeGroups={codeGroups}
        isLoading={codeGroupList.isPending}
        appliedFilters={filters}
        onApplyFilters={applyFilters}
        pageView={codeGroupPageView}
        onChangePage={changeCodeGroupPage}
        selectedCodeGroupId={selectedCodeGroupId}
        onSelect={handleSelectCodeGroup}
        isCreating={isCreatingCodeGroup}
        onAddCodeGroup={handleAddCodeGroup}
        loadError={
          codeGroupList.isError ? (
            <LoadErrorBanner
              error={codeGroupList.error}
              onRetry={() => void codeGroupList.refetch()}
            />
          ) : null
        }
      />

      {/*
       * 우 칸은 구획을 세로로 쌓는다 — 코드그룹 정보 아래에 코드값 한 벌이 붙는다.
       * 한 벌을 이 칸에 통째로 두면 코드값만 다루는 화면이 그 칸을 그대로 옮길 수 있다.
       */}
      <div className="pane-stack">
        {renderCodeGroupFormPane()}

        <CodeValueSection
          codeGroupId={selectedCodeGroupId}
          selectedCodeValueId={selectedCodeValueId}
          onSelectCodeValue={selectCodeValue}
          isCreating={isCreatingCodeValue}
          onOpenCreate={openCodeValueCreate}
          onCloseCreate={closeCodeValueCreate}
          includeInactive={codeValueIncludeInactive}
          onIncludeInactiveChange={changeCodeValueIncludeInactive}
          page={codeValuePage}
          onPageChange={changeCodeValuePage}
        />
      </div>
    </div>
  );

  /**
   * 상위로 고를 수 있는 부서. 전체 목록에서 **자기 자신만 뺀다** — 후손은 남는다.
   * 지금 고른 값이 목록에 없거나 미사용이어도 지우지 않는다(그러면 칸이 비어 보인다).
   */
  const selectedParentId = departmentFormState?.values.parentDepartmentId ?? '';
  const parentDepartmentOptions = useMemo(
    () =>
      selectableOptions(
        parentOptionsFor(departmentOptions.entries, selectedDepartmentId),
        selectedParentId,
      ),
    [departmentOptions.entries, selectedDepartmentId, selectedParentId],
  );

  /**
   * 우 칸 — 부서 정보.
   *
   * 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 등록·선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderDepartmentFormPane = (): ReactNode => {
    if (isCreatingDepartment) {
      if (departmentFormState === null) return null;

      return (
        <DepartmentFormPane
          mode="create"
          values={departmentFormState.values}
          onChange={changeDepartmentValues}
          fieldErrors={{ ...departmentCreateWrite.fieldErrors, ...departmentFieldErrors }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={departmentCreateWrite.error} />}
          /* 등록에서는 부서코드 칸이 열려 있다 — 아직 참조할 자료가 없다. */
          codeLockReason={null}
          deactivateDisabledReason={null}
          parentOptions={parentDepartmentOptions}
          parentDisabledReason={
            parentDepartmentOptions.length === 0
              ? t.department.actionReasons.parentNeedsOthers
              : null
          }
          businessUnitOptions={selectableOptions(
            businessUnitOptions.entries,
            departmentFormState.values.businessUnitId,
          )}
          isDirty={isDepartmentDirty}
          isSaving={departmentCreateWrite.isSaving}
          onSave={handleSaveDepartment}
          onCancel={closeDepartmentCreateForm}
          onDeactivate={() => undefined}
        />
      );
    }

    if (selectedDepartmentId === null) {
      return (
        <section className="pane" aria-label={t.panes.departmentForm}>
          <EmptyState size="sm" title={t.department.empty.notSelected} />
        </section>
      );
    }

    if (departmentDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.departmentForm}>
          <LoadErrorBanner
            error={departmentDetail.error}
            onRetry={() => void departmentDetail.refetch()}
          />
        </section>
      );
    }

    if (departmentDetail.data === undefined || departmentFormState === null) {
      return (
        <section className="pane" aria-label={t.panes.departmentForm}>
          <div role="status" aria-label={t.loading.departmentDetail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    return (
      <DepartmentFormPane
        mode="edit"
        values={departmentFormState.values}
        onChange={changeDepartmentValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...departmentWrite.fieldErrors, ...departmentFieldErrors }}
        /* 순환 참조 400도 이 배너로 온다 — 화면이 순환을 막지 않기 때문이다. */
        banner={<SaveErrorBanner error={departmentWrite.error} onReload={reloadDepartmentDetail} />}
        /*
         * 판정의 주인은 서버가 준 `codeEditable`이다. 화면이 스스로 잠그지 않는다 —
         * `reason`이 `EDITABLE`인데 잠긴 어긋난 조합이 실제로 내려온다.
         */
        codeLockReason={codeLockMessage(departmentDetail.data.editability)}
        deactivateDisabledReason={
          departmentDetail.data.department.isActive === false
            ? t.actionReasons.deactivateAlreadyDone(t.targets.department)
            : null
        }
        parentOptions={parentDepartmentOptions}
        parentDisabledReason={
          parentDepartmentOptions.length === 0 ? t.department.actionReasons.parentNeedsOthers : null
        }
        businessUnitOptions={selectableOptions(
          businessUnitOptions.entries,
          departmentFormState.values.businessUnitId,
        )}
        isDirty={isDepartmentDirty}
        isSaving={departmentWrite.isSaving}
        onSave={handleSaveDepartment}
        onCancel={() => {
          setDepartmentFieldErrors({});
          departmentWrite.reset();
          setDepartmentFormState((prev) =>
            prev === null ? prev : { ...prev, values: prev.baseline },
          );
        }}
        onDeactivate={() => {
          departmentDeactivateWrite.reset();
          setIsDepartmentDeactivateOpen(true);
        }}
      />
    );
  };

  const orgTabContent = (
    <div className="two-pane">
      <DepartmentListPane
        rows={orderedDepartments}
        byId={departmentById}
        isLoading={departmentList.isPending}
        appliedFilters={departmentFilters}
        onApplyFilters={applyDepartmentFilters}
        businessUnitOptions={selectableOptions(
          businessUnitOptions.entries,
          departmentFilters.scopeId,
        )}
        /*
         * 조건 칩에는 번호가 아니라 이름을 낸다. 선택 목록을 아직 받지 못했으면
         * 「알 수 없음」이 나오고 목록이 도착하면 이름으로 바뀐다 —
         * 번호를 대신 보이면 사용자가 쓸 수 없는 값을 자료로 읽는다.
         */
        businessUnitLabel={(scopeId) => lookupLabel(businessUnitOptions.entries, Number(scopeId))}
        optionsNotice={renderOptionsNotice([businessUnitOptions])}
        pageView={departmentPageView}
        onChangePage={changeDepartmentPage}
        selectedDepartmentId={selectedDepartmentId}
        onSelect={handleSelectDepartmentRow}
        isCreating={isCreatingDepartment}
        onAddDepartment={handleAddDepartment}
        loadError={
          departmentList.isError ? (
            <LoadErrorBanner
              error={departmentList.error}
              onRetry={() => void departmentList.refetch()}
            />
          ) : null
        }
      />

      {renderDepartmentFormPane()}
    </div>
  );

  /**
   * 우 칸 — 작업자 기본 정보. **값 표기만 있고 쓰기 경로가 없다**(결정 9).
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderWorkerDetailPane = (): ReactNode => {
    if (selectedWorkerId === null) {
      return (
        <section className="pane" aria-label={t.panes.workerDetail}>
          <EmptyState size="sm" title={t.worker.empty.notSelected} />
        </section>
      );
    }

    if (workerDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.workerDetail}>
          <LoadErrorBanner error={workerDetail.error} onRetry={() => void workerDetail.refetch()} />
        </section>
      );
    }

    if (workerDetail.data === undefined) {
      return (
        <section className="pane" aria-label={t.panes.workerDetail}>
          <div role="status" aria-label={t.loading.workerDetail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    return (
      <WorkerDetailPane
        worker={workerDetail.data.worker}
        businessUnitEntries={workerBusinessUnits.entries}
        plantEntries={plantOptions.entries}
        departmentEntries={workerDepartmentOptions.entries}
      />
    );
  };

  const workerTabContent = (
    <div className="two-pane">
      <WorkerListPane
        workers={workers}
        isLoading={workerList.isPending}
        appliedFilters={workerFilters}
        onApplyFilters={applyWorkerFilters}
        departmentOptions={selectableOptions(
          workerDepartmentOptions.entries,
          workerFilters.scopeId,
        )}
        departmentLabel={(scopeId) => lookupLabel(workerDepartmentOptions.entries, Number(scopeId))}
        optionsNotice={renderOptionsNotice([workerDepartmentOptions])}
        pageView={workerPageView}
        onChangePage={changeWorkerPage}
        selectedWorkerId={selectedWorkerId}
        onSelect={handleSelectWorker}
        loadError={
          workerList.isError ? (
            <LoadErrorBanner error={workerList.error} onRetry={() => void workerList.refetch()} />
          ) : null
        }
      />

      <div className="pane-stack">
        {renderWorkerDetailPane()}

        <QualificationPane
          drafts={qualificationDrafts}
          // 작업자를 고르기 전에는 아무것도 기다리지 않는다 — 조회가 나가지도 않았다.
          isLoading={selectedWorkerId !== null && qualificationList.isPending}
          isWorkerSelected={selectedWorkerId !== null}
          processEntries={processOptions.entries}
          optionsNotice={renderOptionsNotice([processOptions])}
          loadError={
            qualificationList.isError ? (
              <LoadErrorBanner
                error={qualificationList.error}
                onRetry={() => void qualificationList.refetch()}
              />
            ) : null
          }
          banner={<SaveErrorBanner error={qualificationWrite.error} />}
          isDirty={isQualificationDirty}
          isSaving={qualificationWrite.isSaving}
          onAdd={() => openQualificationDialog(createQualificationDraft(), true)}
          onEdit={(draftId) => {
            const found = qualificationDrafts.find((item) => item.draftId === draftId);
            if (found !== undefined) openQualificationDialog(found, false);
          }}
          onRemove={(draftId) => {
            changeQualificationDrafts((drafts) => removeQualificationDraft(drafts, draftId));
          }}
          onSave={handleSaveQualifications}
          onCancel={() => {
            qualificationWrite.reset();
            setQualificationState((prev) =>
              prev === null ? prev : { ...prev, drafts: prev.baseline },
            );
          }}
        />
      </div>
    </div>
  );

  /**
   * 우 칸 — 거래처 기본 정보와 그 거래처의 역할. **이 회차에는 읽기만 한다.**
   *
   * 선택 전·목록 실패·불러오는 중·목록 밖 선택을 각각 다른 화면으로 낸다 —
   * 상세 경로가 없어 기본 정보가 목록에 매여 있으므로 「목록 밖」이 실제로 생기는 상태다.
   */
  const renderPartnerRolePane = (): ReactNode => {
    if (selectedPartnerId === null) {
      return (
        <section className="pane" aria-label={t.panes.partnerRoles}>
          <EmptyState size="sm" title={t.partner.empty.notSelected} />
        </section>
      );
    }

    if (partnerList.isError) {
      return (
        <section className="pane" aria-label={t.panes.partnerRoles}>
          <LoadErrorBanner error={partnerList.error} onRetry={() => void partnerList.refetch()} />
        </section>
      );
    }

    if (partnerList.isPending) {
      return (
        <section className="pane" aria-label={t.panes.partnerRoles}>
          <div role="status" aria-label={t.loading.partners}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    if (selectedPartner === null) {
      return (
        <section className="pane" aria-label={t.panes.partnerRoles}>
          <EmptyState
            size="sm"
            live
            title={t.partner.empty.notInListTitle}
            description={t.partner.empty.notInListDescription}
          />
        </section>
      );
    }

    return (
      <PartnerRolePane
        partner={selectedPartner}
        choices={partnerRoleChoices}
        hasSavedRole={partnerRoleState !== null && partnerRoleState.baseline.length > 0}
        isRolesLoading={partnerRoles.isPending}
        rolesLoadError={
          partnerRoles.isError ? (
            <LoadErrorBanner
              error={partnerRoles.error}
              onRetry={() => void partnerRoles.refetch()}
            />
          ) : null
        }
        /*
         * 확인 창이 서 있는 동안에는 실패를 **창 안에서** 낸다 — 두 자리에 같은 배너를 두면
         * 사용자가 스크림 뒤의 사본을 읽으려 든다.
         *
         * **남의 실패는 아예 그리지 않는다**(`isRoleWriteMine`) — 뒤늦게 온 앞 거래처의 실패가
         * 지금 구획에 서면 사용자는 손댄 적 없는 거래처가 막힌 줄 안다.
         */
        banner={
          isPartnerRoleConfirmOpen || !isRoleWriteMine ? null : (
            <SaveErrorBanner error={partnerRoleWrite.error} />
          )
        }
        isDirty={isPartnerRoleDirty}
        /* 잠금과 진행 표시도 대상이 같을 때만 낸다 — 사유 없는 비활성이 남의 구획에 서지 않는다. */
        isSaving={isRoleWriteMine && partnerRoleWrite.isSaving}
        onToggleRole={togglePartnerRoleChoice}
        onSave={handleSavePartnerRoles}
        onCancel={() => {
          resetIfIdle(partnerRoleWrite);
          setPartnerRoleState((prev) =>
            prev === null ? prev : { ...prev, selected: prev.baseline },
          );
        }}
      />
    );
  };

  const partnerTabContent = (
    <div className="two-pane">
      <PartnerListPane
        partners={partners}
        isLoading={partnerList.isPending}
        appliedFilters={partnerFilters}
        onApplyFilters={applyPartnerFilters}
        pageView={partnerPageView}
        onChangePage={changePartnerPage}
        selectedPartnerId={selectedPartnerId}
        onSelect={handleSelectPartner}
        loadError={
          partnerList.isError ? (
            <LoadErrorBanner error={partnerList.error} onRetry={() => void partnerList.refetch()} />
          ) : null
        }
      />

      <div className="pane-stack">{renderPartnerRolePane()}</div>
    </div>
  );

  const tabContentOf = (tabId: string): ReactNode => {
    if (tabId === 'code') return codeTabContent;
    if (tabId === 'org') return orgTabContent;
    if (tabId === 'worker') return workerTabContent;
    return partnerTabContent;
  };

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
        items={COMMON_CODE_TABS.map((definition) => ({
          value: definition.id,
          label: definition.label,
          /*
           * 활성 탭의 내용만 만든다. 디자인 시스템 Tabs는 비활성 패널도 DOM에 두므로
           * 모두 만들면 보이지 않는 표가 함께 살아 있게 된다.
           */
          content: definition.id === tab.id ? tabContentOf(definition.id) : null,
        }))}
      />

      {/*
       * 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다.
       * 되돌릴 수 없는 액션이라 확인을 한 단계 두고, **실패해도 창을 닫지 않는다** —
       * 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
       */}
      {/*
       * 자격 편집 창도 열 때만 붙인다. **확인은 저장이 아니다** —
       * 표에만 반영되고 서버로는 「저장」에서 최종 목록이 한 번에 나간다.
       */}
      {editingQualification !== null && (
        <QualificationFormDialog
          draft={editingQualification}
          isNew={isEditingNewQualification}
          otherDrafts={qualificationDrafts}
          processOptions={selectableOptions(processOptions.entries, editingQualification.processId)}
          onClose={() => setEditingQualification(null)}
          onConfirm={(next) => {
            changeQualificationDrafts((drafts) => upsertQualificationDraft(drafts, next));
            setEditingQualification(null);
          }}
        />
      )}

      {isDepartmentDeactivateOpen && (
        <DeactivateDialog
          open
          title={t.dialog.deactivateDepartmentTitle}
          onClose={() => {
            setIsDepartmentDeactivateOpen(false);
            departmentDeactivateWrite.reset();
          }}
          onConfirm={() => {
            departmentDeactivateWrite.write(undefined);
          }}
          isSaving={departmentDeactivateWrite.isSaving}
          banner={
            <SaveErrorBanner
              error={departmentDeactivateWrite.error}
              onReload={reloadDepartmentDetail}
            />
          }
        />
      )}

      {isDeactivateOpen && (
        <DeactivateDialog
          open
          title={t.dialog.deactivateCodeGroupTitle}
          onClose={() => {
            setIsDeactivateOpen(false);
            codeGroupDeactivateWrite.reset();
          }}
          onConfirm={() => {
            codeGroupDeactivateWrite.write(undefined);
          }}
          isSaving={codeGroupDeactivateWrite.isSaving}
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다. */
          banner={
            <SaveErrorBanner
              error={codeGroupDeactivateWrite.error}
              onReload={reloadCodeGroupDetail}
            />
          }
        />
      )}

      {/*
       * 역할 해제 확인 창은 **잃는 것이 있을 때만** 선다(결정 10). 통째 교체라 목록에 없는
       * 역할은 해제되는데, 그 사실을 이름으로 밝히는 것이 이 화면의 유일한 방어다.
       * 실패해도 창을 닫지 않는다 — 배너를 창 안에 두는 이유가 그것이다.
       */}
      {isPartnerRoleConfirmOpen && (
        <PartnerRoleConfirmDialog
          released={releasedRoles}
          willHaveNoRole={partnerRoleState !== null && partnerRoleState.selected.length === 0}
          isSaving={partnerRoleWrite.isSaving}
          banner={<SaveErrorBanner error={partnerRoleWrite.error} />}
          onConfirm={confirmSavePartnerRoles}
          onClose={() => {
            setIsPartnerRoleConfirmOpen(false);
            resetIfIdle(partnerRoleWrite);
          }}
        />
      )}
    </>
  );
};
