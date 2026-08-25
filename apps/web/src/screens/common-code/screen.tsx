import {
  AlertBanner,
  Breadcrumb,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useMemo, useRef, useState } from 'react';
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
import {
  isPartnerNotFound,
  partnerKeys,
  partnerRolesPath,
  usePartnerDetail,
  usePartnerList,
  usePartnerRoles,
} from './partner-queries';
import { PartnerRoleConfirmDialog } from './partner-role-confirm-dialog';
import {
  isSamePartnerRoleSelection,
  releasedPartnerRoles,
  toPartnerRoleChoices,
  toPartnerRoleDraft,
  toPartnerRolesPayload,
  togglePartnerRole,
  type PartnerRoleRow,
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
  source: PartnerRoleRow[];
  baseline: string[];
  selected: string[];
}

/**
 * 공통 훅이 잠금 토큰을 못 찾아 멈췄을 때 붙이는 표식. 화면이 그 갈래를 가르는 열쇠다.
 *
 * ⛔ **글자를 공통 훅과 나눠 갖는다** — 훅이 이 코드값을 바꾸면 아래 갈래가 조용히 공통
 * 문구로 되돌아간다. 그래서 화면 감지기(「잠금 토큰을 못 얻으면 …」)가 **전용 문구를
 * 기대값으로 못박아** 그 순간 울게 해 두었다.
 */
const STALE_TOKEN_CODE = 'STALE_TOKEN';

/**
 * 역할 저장의 실패 안내 — **토큰 부재만 이 화면의 문구로 바꿔 낸다.**
 *
 * 공통 문구(`save.staleToken`)는 「잠시 뒤 다시 저장하세요」이고, 그 말은 **다시 시도하면
 * 풀리는** 자원을 전제한다. 계약은 이 자원의 토큰 원천을 선언했으나(#174) **서버가 아직 주지
 * 않는 동안**에는 다시 눌러도 같은 자리에서 멈춘다 — 그대로 두면 사용자가 **없는 조치를
 * 지시받는다.** 체감은 어휘 밖 역할이 붙은 거래처에서 가장 나쁘다: 확인 창에서 해제를 승낙한
 * **뒤에** 「잠시 뒤 다시」를 읽는다.
 *
 * ⛔ **공통 훅과 공통 문구는 손대지 않는다.** 다시 시도가 실제로 통하는 형제 화면(폐기 출고
 * 상신 등)에서는 그 문구가 참이라, 공통 자리를 고치면 그쪽이 거짓이 된다. 바꾸는 자리를
 * **이 화면 하나**로 가둔다.
 *
 * 나머지 오류는 **그대로 지나간다** — 서버가 준 문구를 화면이 고쳐 쓰지 않는다.
 */
const toPartnerRoleSaveError = (error: ApiError | null): ApiError | null => {
  if (error === null || error.kind !== 'validation') return error;

  return {
    kind: 'validation',
    errors: error.errors.map((item) =>
      item.code === STALE_TOKEN_CODE
        ? { ...item, message: messages.commonCode.partnerRole.saveTokenUnavailable }
        : item,
    ),
  };
};

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

  /**
   * **화면이 지금 보고 있는 코드그룹**과 **지금도 등록 모드인가.** 렌더마다 갱신한다.
   *
   * 쓰기의 `onSuccess`는 `mutate`를 부른 **렌더에 닫혀 있어**(공통 훅이 그것을 `mutate`의 두 번째
   * 인자로 넘긴다) 그 자리에서 「지금」을 알 수 없다 — 응답이 늦게 도착하면 클로저의 값은 이미
   * 낡았다. 그래서 지금 값을 ref로 따로 들고, 늦게 온 되먹임이 **남의 폼·주소를 건드리는지**를
   * 그 시점에 판정한다. 전례가 같은 자리에 같은 짝을 둔다(`po-register`의 `currentPurchaseOrderIdRef`).
   */
  const currentCodeGroupIdRef = useRef<number | null>(selectedCodeGroupId);
  const isCreatingCodeGroupRef = useRef<boolean>(isCreatingCodeGroup);

  currentCodeGroupIdRef.current = selectedCodeGroupId;
  isCreatingCodeGroupRef.current = isCreatingCodeGroup;

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
   * **지금 열려 있는 등록 초안의 번호**(D-13).
   *
   * 등록 폼은 취소로 닫고 다시 열 수 있고, 그때 서는 것은 **다른 초안**이다. 그런데 등록에는
   * 아직 자원 번호가 없어(폼 출처도 늘 같은 문자열이다) 수정 경로의 대상 축으로는 두 초안을
   * 가를 수 없다 — 그래서 **초안을 세울 때마다 새 번호**를 준다. 나가는 중인 등록이 어느
   * 초안의 것인지는 이 번호로 판정한다.
   */
  const [createDraftSession, setCreateDraftSession] = useState(0);

  /** **지금** 열려 있는 초안의 번호. 위 두 ref와 같은 이유로 든다 — 늦게 온 되먹임이 읽는다. */
  const currentCreateDraftSessionRef = useRef<number>(createDraftSession);

  currentCreateDraftSessionRef.current = createDraftSession;

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
    const isCreateDraft = typeof codeGroupFormSource === 'string';
    const seeded = isCreateDraft
      ? emptyCodeGroupFormValues()
      : codeGroupToFormValues(codeGroupFormSource.codeGroup);
    setFormState({ source: codeGroupFormSource, baseline: seeded, values: seeded });
    /*
     * **초안이 새로 서는 이 자리가 세션의 경계다.** 폼을 열고 닫는 자리가 여럿이라(액션 ·
     * 취소 · 목록 선택 · 뒤로가기) 그 자리마다 번호를 올리면 한 곳을 빠뜨린다 — 초안을
     * 세우는 자리는 여기 하나뿐이다. 값을 고치는 것은 초안을 다시 세우지 않으므로 세지 않는다.
     */
    if (isCreateDraft) setCreateDraftSession((session) => session + 1);
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
      /* 저장이 성공한 것은 사실이다 — 그사이 대상이 옮겨 갔더라도 그 사실을 감추지 않는다. */
      toast.show({ variant: 'success', description: messages.common.saved });

      /*
       * **늦게 온 성공은 알리기만 한다.** 폼을 서버 응답으로 다시 세우는 것도, 필드 오류를
       * 비우는 것도 **지금 보고 있는 코드그룹**에 대한 조작이라, 그사이 대상이 옮겨 갔다면
       * 남의 폼 값을 앞 그룹의 값으로 갈아 버린다. 배너·진행 표시와 달리 이 갈래는
       * **틀린 자료를 사실처럼 보여 주므로** 가장 조용하다.
       */
      if (selectedCodeGroupId !== currentCodeGroupIdRef.current) return;

      setCodeGroupFieldErrors({});
      const next = codeGroupToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
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
      /* 등록이 성공한 것은 사실이다 — 그사이 화면이 어디로 갔든 그 사실을 감추지 않는다. */
      toast.show({ variant: 'success', description: messages.common.created });

      /*
       * **늦게 온 등록 성공은 주소를 끌고 가지 않는다.** 등록 모드를 이미 떠난 사용자에게
       * 새 자원으로의 이동은 **보던 화면을 빼앗는** 일이다 — 방금 고른 코드그룹이 사라지고
       * 그 자리에 처음 보는 그룹이 선다.
       *
       * **모드만 묻지 않는다**(D-13). 닫았다 다시 연 사용자도 「등록 모드」라, 모드만 물으면
       * 지금 치고 있는 **새 초안**을 두고 앞 초안이 만든 자원으로 끌려간다. 초안 세션까지
       * 같아야 「그 등록을 낸 그 초안에 그대로 있다」가 된다.
       */
      const isSameCreateDraft =
        isCreatingCodeGroupRef.current &&
        createDraftSession === currentCreateDraftSessionRef.current;

      if (!isSameCreateDraft) return;

      setCodeGroupFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 그룹을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 그룹을 직접 찾아야 한다.
       *
       * **주소 갱신은 이 한 번뿐이다.** `new`를 지우는 것과 `grp`를 새 번호로 놓는 것을
       * 한 patch 안에서 함께 한다 — 나눠 부르면 뒤로가기가 중간 상태로 떨어진다.
       */
      selectCodeGroup(saved.codeGroupId);
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

  /**
   * **나가는 중인 저장이 지금 보고 있는 코드그룹의 것인가.**
   *
   * `resetIfIdle`는 나가는 중인 쓰기를 **거두지 않는다**(옳다 — 되먹임을 끊지 않는다).
   * 그래서 거두지 못한 상태(`isSaving`·`error`·`fieldErrors`)가 그대로 남는데, 그사이 사용자가
   * 다른 코드그룹을 고르면 **손댄 적 없는 그룹에 「저장 중」과 남의 실패가 선다.** 좌 목록은
   * 저장 중에도 잠기지 않으므로 특수한 경로가 아니다.
   *
   * 끊는 것과 **가리는 것**은 다르다 — 되먹임은 그대로 두고, *보이는 것*만 대상이 같을 때 낸다.
   * 같은 화면의 자격·거래처 역할 구획이 같은 자리에 같은 축을 두었다.
   */
  const [codeGroupWriteTargetId, setCodeGroupWriteTargetId] = useState<number | null>(null);

  const isCodeGroupWriteMine = codeGroupWriteTargetId === selectedCodeGroupId;

  /**
   * **나가는 중인 등록이 지금 열려 있는 초안의 것인가**(D-13 — 등록 경로의 같은 축).
   *
   * 수정은 자원 번호로 가르지만 등록에는 번호가 없다. 가르는 것은 **초안 세션**이고, 그것이
   * 이 축의 유일한 차이다. 이 값이 없으면 버린 초안의 실패가 방금 연 초안 위에 선다 —
   * 사용자는 한 글자 친 초안이 이미 거부된 줄 안다.
   */
  const [codeGroupCreateWriteSession, setCodeGroupCreateWriteSession] = useState<number | null>(
    null,
  );

  const isCodeGroupCreateWriteMine = codeGroupCreateWriteSession === createDraftSession;

  /**
   * **막을 것은 전역이다.** 저장이 하나라도 나가는 중이면 어느 코드그룹에서도 새 저장을 시작할
   * 수 없다 — 대상 축(`isCodeGroupWriteMine`)은 *보이는 것*을 가릴 뿐 **막는 데 쓰지 않는다.**
   *
   * **두 훅을 함께 본다.** 등록과 수정이 한 폼 상태·한 저장 자리를 쓰므로 한쪽이 나가는 중에
   * 다른 쪽이 열려 있으면 사용자는 같은 자리에서 두 저장을 겹쳐 낼 수 있다.
   * 사용 중지는 넣지 않는다 — 확인 창 안에 갇힌 별개 훅이라 이 자리와 옵저버가 겹치지 않는다.
   */
  const isCodeGroupLocked = codeGroupWrite.isSaving || codeGroupCreateWrite.isSaving;

  /**
   * 저장을 내는 자리는 하나뿐이고(등록·수정이 같은 자리다) **그 자리가 여기를 지난다.**
   *
   * ⛔ **두 번째 저장을 내지 않는다.** 훅 하나에 요청 하나라, 두 번째 `mutate`가 옵저버를
   * 새 요청으로 옮기면서 **앞 요청에서 옵저버를 떼어 낸다** — 그 순간 앞 저장의 무효화·성공·
   * 실패가 전부 오지 않는다(`omf-mes#96`이 `reset()`에 대해 말한 것과 같은 상태다).
   * 잠금(위 `isCodeGroupLocked`)이 첫째 겹이고 이 가드가 둘째 겹이다 — 같은 식을 두 번 적지
   * 않으려고 가드가 그 값을 그대로 읽는다.
   */
  const writeCodeGroup = (values: CodeGroupFormValues): void => {
    if (isCodeGroupLocked) return;

    /*
     * **두 축을 함께 적는다.** 등록과 수정이 한 자리에서 나가므로 어느 쪽이 나갔는지에 따라
     * 소비처가 갈리는데, 각 폼은 **자기 축만** 읽는다(수정은 자원 번호 · 등록은 초안 세션).
     * 한쪽만 적으면 그 폼의 되먹임이 영영 「남의 것」이 된다.
     */
    setCodeGroupWriteTargetId(selectedCodeGroupId);
    setCodeGroupCreateWriteSession(createDraftSession);
    activeCodeGroupWrite.write(values);
  };

  /** 편집 중이던 상태를 통째로 비운다. 보이는 행이 달라질 때 함께 부른다. */
  const resetCodeGroupEditing = () => {
    resetIfIdle(codeGroupWrite);
    resetIfIdle(codeGroupCreateWrite);
    resetIfIdle(codeGroupDeactivateWrite);
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
    resetIfIdle(codeGroupCreateWrite);
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

  /**
   * **화면이 지금 보고 있는 부서**와 **지금도 등록 모드인가.** 렌더마다 갱신한다.
   *
   * 쓰기의 `onSuccess`는 `mutate`를 부른 **렌더에 닫혀 있어**(공통 훅이 그것을 `mutate`의 두 번째
   * 인자로 넘긴다) 그 자리에서 「지금」을 알 수 없다 — 응답이 늦게 도착하면 클로저의 값은 이미
   * 낡았다. 그래서 지금 값을 ref로 따로 들고, 늦게 온 되먹임이 **남의 폼·주소를 건드리는지**를
   * 그 시점에 판정한다. 코드그룹 구획이 같은 자리에 같은 짝을 두었다.
   */
  const currentDepartmentIdRef = useRef<number | null>(selectedDepartmentId);
  const isCreatingDepartmentRef = useRef<boolean>(isCreatingDepartment);

  currentDepartmentIdRef.current = selectedDepartmentId;
  isCreatingDepartmentRef.current = isCreatingDepartment;

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
   * **지금 열려 있는 등록 초안의 번호**(D-13).
   *
   * 등록 폼은 취소로 닫고 다시 열 수 있고, 그때 서는 것은 **다른 초안**이다. 그런데 등록에는
   * 아직 자원 번호가 없어(폼 출처도 늘 같은 문자열이다) 수정 경로의 대상 축으로는 두 초안을
   * 가를 수 없다 — 그래서 **초안을 세울 때마다 새 번호**를 준다. 나가는 중인 등록이 어느
   * 초안의 것인지는 이 번호로 판정한다.
   */
  const [departmentCreateDraftSession, setDepartmentCreateDraftSession] = useState(0);

  /** **지금** 열려 있는 초안의 번호. 위 두 ref와 같은 이유로 든다 — 늦게 온 되먹임이 읽는다. */
  const currentDepartmentCreateDraftSessionRef = useRef<number>(departmentCreateDraftSession);

  currentDepartmentCreateDraftSessionRef.current = departmentCreateDraftSession;

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
    const isCreateDraft = typeof departmentFormSource === 'string';
    const seeded = isCreateDraft
      ? emptyDepartmentFormValues()
      : departmentToFormValues(departmentFormSource.department);
    setDepartmentFormState({ source: departmentFormSource, baseline: seeded, values: seeded });
    /*
     * **초안이 새로 서는 이 자리가 세션의 경계다.** 폼을 열고 닫는 자리가 여럿이라(액션 ·
     * 취소 · 목록 선택 · 뒤로가기) 그 자리마다 번호를 올리면 한 곳을 빠뜨린다 — 초안을
     * 세우는 자리는 여기 하나뿐이다. 값을 고치는 것은 초안을 다시 세우지 않으므로 세지 않는다.
     */
    if (isCreateDraft) setDepartmentCreateDraftSession((session) => session + 1);
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
      /* 저장이 성공한 것은 사실이다 — 그사이 대상이 옮겨 갔더라도 그 사실을 감추지 않는다. */
      toast.show({ variant: 'success', description: messages.common.saved });

      /*
       * **늦게 온 성공은 알리기만 한다.** 폼을 서버 응답으로 다시 세우는 것도, 필드 오류를
       * 비우는 것도 **지금 보고 있는 부서**에 대한 조작이라, 그사이 대상이 옮겨 갔다면
       * 남의 폼 값을 앞 부서의 값으로 갈아 버린다. 배너·진행 표시와 달리 이 갈래는
       * **틀린 자료를 사실처럼 보여 주므로** 가장 조용하다.
       */
      if (selectedDepartmentId !== currentDepartmentIdRef.current) return;

      setDepartmentFieldErrors({});
      const next = departmentToFormValues(saved);
      setDepartmentFormState((prev) =>
        prev === null ? prev : { ...prev, baseline: next, values: next },
      );
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
      /* 등록이 성공한 것은 사실이다 — 그사이 화면이 어디로 갔든 그 사실을 감추지 않는다. */
      toast.show({ variant: 'success', description: messages.common.created });

      /*
       * **늦게 온 등록 성공은 주소를 끌고 가지 않는다.** 등록 모드를 이미 떠난 사용자에게
       * 새 자원으로의 이동은 **보던 화면을 빼앗는** 일이다 — 방금 고른 부서가 사라지고
       * 그 자리에 처음 보는 부서가 선다.
       *
       * **모드만 묻지 않는다**(D-13). 닫았다 다시 연 사용자도 「등록 모드」라, 모드만 물으면
       * 지금 치고 있는 **새 초안**을 두고 앞 초안이 만든 자원으로 끌려간다. 초안 세션까지
       * 같아야 「그 등록을 낸 그 초안에 그대로 있다」가 된다.
       */
      const isSameCreateDraft =
        isCreatingDepartmentRef.current &&
        departmentCreateDraftSession === currentDepartmentCreateDraftSessionRef.current;

      if (!isSameCreateDraft) return;

      setDepartmentFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 부서를 고르면 상세를 다시 조회하게 되고 그 조회가 토큰을 확보한다.
       * **주소 갱신은 이 한 번뿐이다**(`new` 해제 + `dep` 설정을 한 patch로).
       */
      handleSelectDepartment(saved.departmentId);
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

  /**
   * 지금 모드의 쓰기. 등록과 수정이 **한 폼 상태**를 쓰므로 저장·오류·진행 표시도
   * 한 곳에서 골라 쓴다 — 두 훅의 상태를 화면에서 합치면 어느 저장의 실패인지 흐려진다.
   */
  const activeDepartmentWrite = isCreatingDepartment ? departmentCreateWrite : departmentWrite;

  /**
   * **나가는 중인 저장이 지금 보고 있는 부서의 것인가.**
   *
   * `resetIfIdle`는 나가는 중인 쓰기를 **거두지 않는다**(옳다 — 되먹임을 끊지 않는다).
   * 그래서 거두지 못한 상태(`isSaving`·`error`·`fieldErrors`)가 그대로 남는데, 그사이 사용자가
   * 다른 부서를 고르면 **손댄 적 없는 부서에 「저장 중」과 남의 실패가 선다.** 좌 목록은
   * 저장 중에도 잠기지 않으므로 특수한 경로가 아니다.
   *
   * 끊는 것과 **가리는 것**은 다르다 — 되먹임은 그대로 두고, *보이는 것*만 대상이 같을 때 낸다.
   * 같은 화면의 코드그룹·자격·거래처 역할 구획이 같은 자리에 같은 축을 두었다.
   */
  const [departmentWriteTargetId, setDepartmentWriteTargetId] = useState<number | null>(null);

  const isDepartmentWriteMine = departmentWriteTargetId === selectedDepartmentId;

  /**
   * **나가는 중인 등록이 지금 열려 있는 초안의 것인가**(D-13 — 등록 경로의 같은 축).
   *
   * 수정은 자원 번호로 가르지만 등록에는 번호가 없다. 가르는 것은 **초안 세션**이고, 그것이
   * 이 축의 유일한 차이다. 이 값이 없으면 버린 초안의 실패가 방금 연 초안 위에 선다 —
   * 사용자는 한 글자 친 초안이 이미 거부된 줄 안다.
   */
  const [departmentCreateWriteSession, setDepartmentCreateWriteSession] = useState<number | null>(
    null,
  );

  const isDepartmentCreateWriteMine = departmentCreateWriteSession === departmentCreateDraftSession;

  /**
   * **막을 것은 전역이다.** 저장이 하나라도 나가는 중이면 어느 부서에서도 새 저장을 시작할
   * 수 없다 — 대상 축(`isDepartmentWriteMine`)은 *보이는 것*을 가릴 뿐 **막는 데 쓰지 않는다.**
   *
   * **두 훅을 함께 본다.** 등록과 수정이 한 폼 상태·한 저장 자리를 쓰므로 한쪽이 나가는 중에
   * 다른 쪽이 열려 있으면 사용자는 같은 자리에서 두 저장을 겹쳐 낼 수 있다.
   * 사용 중지는 넣지 않는다 — 확인 창 안에 갇힌 별개 훅이라 이 자리와 옵저버가 겹치지 않는다.
   */
  const isDepartmentLocked = departmentWrite.isSaving || departmentCreateWrite.isSaving;

  /**
   * 저장을 내는 자리는 하나뿐이고(등록·수정이 같은 자리다) **그 자리가 여기를 지난다.**
   *
   * ⛔ **두 번째 저장을 내지 않는다.** 훅 하나에 요청 하나라, 두 번째 `mutate`가 옵저버를
   * 새 요청으로 옮기면서 **앞 요청에서 옵저버를 떼어 낸다** — 그 순간 앞 저장의 무효화·성공·
   * 실패가 전부 오지 않는다(`omf-mes#96`이 `reset()`에 대해 말한 것과 같은 상태다).
   * 잠금(위 `isDepartmentLocked`)이 첫째 겹이고 이 가드가 둘째 겹이다 — 같은 식을 두 번 적지
   * 않으려고 가드가 그 값을 그대로 읽는다.
   */
  const writeDepartment = (values: DepartmentFormValues): void => {
    if (isDepartmentLocked) return;

    /*
     * **두 축을 함께 적는다.** 등록과 수정이 한 자리에서 나가므로 어느 쪽이 나갔는지에 따라
     * 소비처가 갈리는데, 각 폼은 **자기 축만** 읽는다(수정은 자원 번호 · 등록은 초안 세션).
     * 한쪽만 적으면 그 폼의 되먹임이 영영 「남의 것」이 된다.
     */
    setDepartmentWriteTargetId(selectedDepartmentId);
    setDepartmentCreateWriteSession(departmentCreateDraftSession);
    activeDepartmentWrite.write(values);
  };

  /** 편집 중이던 상태를 통째로 비운다. 보이는 행이 달라질 때 함께 부른다. */
  const resetDepartmentEditing = () => {
    resetIfIdle(departmentWrite);
    resetIfIdle(departmentCreateWrite);
    resetIfIdle(departmentDeactivateWrite);
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
    resetIfIdle(departmentCreateWrite);
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

    writeDepartment(departmentFormState.values);
  };

  const reloadDepartmentDetail = () => {
    resetIfIdle(departmentWrite);
    resetIfIdle(departmentDeactivateWrite);
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
       * **서버 응답이 정본이다.** 서버가 행 번호를 새로 매기므로 보낸 목록을 그대로 두면
       * 다음 저장이 옛 번호로 도는 것처럼 보인다.
       *
       * 그 응답을 **조회 캐시에 앉힌다.** 지역 상태에만 두면 초안의 출처(조회 캐시)와 어긋나
       * 바로 다음 렌더에서 초안이 **저장 전 목록으로 되돌아간다** — 위 되세우기 규칙이
       * 「출처가 바뀌었다」로 읽기 때문이다. 무효화가 낸 재조회는 이 값을 나중에 서버의 것으로
       * 확인해 준다. 응답이 앉는 자리는 **보낸 요청의 캐시 키**다 — 공통 훅이 `mutate`를 부른
       * 렌더의 되먹임을 그대로 붙잡으므로 그사이 선택이 옮겨 가도 남의 자리에 앉지 않는다.
       */
      queryClient.setQueryData(workerKeys.qualifications(selectedWorkerId ?? 0), saved);
      /*
       * **초안을 비워 되세우기를 다시 열어 준다.** 조회 라이브러리는 새 값이 옛 값과 깊이 같으면
       * **옛 참조를 그대로 유지한다**(`replaceEqualDeep`) — 그러면 위 규칙이 「출처가 그대로」로
       * 읽어 초안이 다시 서지 않고, 화면은 서버가 말한 상태가 아니라 **사용자가 고친 상태**를
       * 계속 보인다(서버가 저장을 조용히 무시한 경우가 정확히 그 갈래다).
       * 비워 두면 다음 렌더가 **갱신된 캐시**에서 초안을 다시 세운다.
       */
      setQualificationState(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * **나가는 중인 저장이 지금 보고 있는 작업자의 것인가.**
   *
   * `resetIfIdle`는 나가는 중인 쓰기를 **거두지 않는다**(옳다 — 되먹임을 끊지 않는다).
   * 그래서 거두지 못한 상태(`isSaving`·`error`)가 그대로 남는데, 그사이 사용자가 다른 작업자를
   * 고르면 **손댄 적 없는 작업자에 「저장 중」과 남의 실패 배너가 선다.** 좌 목록은 저장 중에도
   * 잠기지 않으므로 특수한 경로가 아니다.
   *
   * 끊는 것과 **가리는 것**은 다르다 — 되먹임은 그대로 두고, *보이는 것*만 대상이 같을 때 낸다.
   * 같은 화면의 거래처 역할 구획이 같은 자리에 같은 축을 두었다(`isRoleWriteMine`).
   */
  const [qualificationWriteTargetId, setQualificationWriteTargetId] = useState<number | null>(null);

  const isQualificationWriteMine = qualificationWriteTargetId === selectedWorkerId;

  /**
   * 저장을 내는 자리는 하나뿐이고 **그 자리가 여기를 지난다.**
   *
   * ⛔ **두 번째 저장을 내지 않는다.** 훅 하나에 요청 하나라, 두 번째 `mutate`가 옵저버를
   * 새 요청으로 옮기면서 **앞 요청에서 옵저버를 떼어 낸다** — 그 순간 앞 저장의 무효화·성공·
   * 실패가 전부 오지 않는다(`omf-mes#96`이 `reset()`에 대해 말한 것과 같은 상태다).
   * 잠금(아래 `isQualificationLocked`)이 첫째 겹이고 이 가드가 둘째 겹이다.
   */
  const writeQualifications = (drafts: QualificationDraft[]): void => {
    if (qualificationWrite.isSaving) return;

    setQualificationWriteTargetId(selectedWorkerId);
    qualificationWrite.write(drafts);
  };

  /**
   * **막을 것은 전역이다.** 저장이 나가는 중이면 어느 작업자에서도 새 저장을 시작할 수 없다 —
   * 대상 축(`isQualificationWriteMine`)은 *보이는 것*을 가릴 뿐 **막는 데 쓰지 않는다.**
   *
   * **잠기는 것은 구획 전체다**(자격 추가·행 수정·행 삭제·취소·저장). 성공이 초안을 비워
   * 되세우기를 다시 열므로, 저장 중 표를 고칠 수 있게 두면 **성공이 그 편집을 조용히 지운다.**
   * 형제 구획(거래처 역할)이 체크칸까지 전역으로 잠그는 것과 같은 판단이다.
   */
  const isQualificationLocked = qualificationWrite.isSaving;

  const resetQualificationEditing = () => {
    resetIfIdle(qualificationWrite);
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
    resetIfIdle(qualificationWrite);
    setIsEditingNewQualification(isNew);
    setEditingQualification(draft);
  };

  const handleSaveQualifications = () => {
    if (qualificationState === null) return;

    writeQualifications(qualificationState.drafts);
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
   * 고른 거래처의 기본 정보. **단건 조회에서 온다**(#173) — 지금 목록에 실려 있는지와 무관하다.
   *
   * 목록 행에서 찾아 쓰던 동안에는 조건을 바꾼 뒤·다른 쪽으로 넘어간 뒤·링크를 받은 뒤가 모두
   * 「채울 자료가 없는」 상태였다. 그 갈래를 없앤 것이 이 조회의 목적이다.
   */
  const partnerDetail = usePartnerDetail(selectedPartnerId, isPartnerTab);

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
   * ⚠ **`etagPath`가 역할 목록 경로다**(계약 재동기화 #173). 계약이 이 쓰기에 `If-Match`를
   * **필수**로 요구하고 `409`도 함께 붙였다 — 통째로 교체하는 저장이라 보호가 없으면 남이
   * 방금 붙인 역할이 조용히 사라진다.
   *
   * ⛔ **`etagPath`가 역할 목록 경로인 것이 이 배선의 요점이다.** 토큰 보관소는 응답이 온 URL
   * 경로를 열쇠로 쓰고(`packages/api-client/src/client.ts`), 토큰을 내려주는 조회가 **역할 목록**
   * 이다(#174). 단건 조회가 생겼다고 그쪽으로 옮기면 꺼내는 자리가 언제나 비어 저장이 다시
   * 안내에서 멈춘다.
   *
   * ⚠ **서버 구현이 오기 전에는 토큰이 오지 않을 수 있다.** 그때 공통 훅은 토큰을 찾지 못해
   * **요청을 만들지 않고 안내를 세운다.** 그것이 정직한 상태다 — 빈 `If-Match`를 지어 보내면
   * 서버가 400으로 되돌리고 사용자는 원인을 읽을 수 없다(공통 훅이 명시적으로 금지한 행위다).
   *
   * **무효화는 역할 키 하나뿐이다.** 이 치환으로 거래처 본체가 바뀌지 않으므로 목록까지
   * 무효화하면 아무것도 달라지지 않을 조회를 다시 낸다.
   */
  const partnerRoleWrite = useMasterWrite<readonly string[], PartnerRoleRow[]>({
    request: (selected, headers) => {
      const ifMatch = headers['If-Match'];

      /*
       * **없는 값을 빈 글자로 메우지 않는다.** `etagPath`가 있으면 공통 훅은 토큰을 찾지 못한
       * 순간 요청을 만들지 않고 되돌아간다 — 여기까지 오면 토큰이 있다. 그 사실에 기대는 대신
       * 여기서 멈추는 이유는, 빈 `If-Match`가 계약 위반이라 서버가 400으로 되돌리고 사용자는
       * 원인을 읽을 수 없기 때문이다(형제 슬라이스의 상신 가드와 같은 형태).
       */
      if (selectedPartnerId === null || ifMatch === undefined) {
        throw new Error('잠금 토큰 없이 거래처 역할을 저장하지 않습니다.');
      }

      return client.PUT('/mdm/partners/{partnerId}/roles', {
        params: {
          path: { partnerId: selectedPartnerId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'], 'If-Match': ifMatch },
        },
        body: toPartnerRolesPayload(partnerRoleState?.source ?? [], selected),
      });
    },
    etagPath: selectedPartnerId === null ? null : partnerRolesPath(selectedPartnerId),
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

  /**
   * 저장을 내는 자리는 둘(확인 창 있는 길·없는 길)뿐이고 **둘 다 여기를 지난다.**
   *
   * ⛔ **두 번째 저장을 내지 않는다.** 훅 하나에 요청 하나라, 두 번째 `mutate`가 옵저버를
   * 새 요청으로 옮기면서 **앞 요청에서 옵저버를 떼어 낸다** — 그 순간 앞 저장의 무효화·성공·
   * 실패가 전부 오지 않는다(`omf-mes#96`이 `reset()`에 대해 말한 것과 같은 상태다).
   * 앞 저장이 400이었다면 **어디에도 표시되지 않는 실패**가 되고, 성공이었다면 캐시가 저장 전
   * 값으로 남아 다음 통째 교체가 그것을 덮어쓴다. 잠금(아래 `isPartnerRoleLocked`)이 첫째 겹이고
   * 이 가드가 둘째 겹이다.
   */
  const writePartnerRoles = (selected: readonly string[]) => {
    if (partnerRoleWrite.isSaving) return;

    setRoleWriteTargetId(selectedPartnerId);
    partnerRoleWrite.write(selected);
  };

  /**
   * **막을 것은 전역이다.** 저장이 하나라도 나가는 중이면 어느 거래처에서도 새 저장을 시작할
   * 수 없다 — 대상 축(`isRoleWriteMine`)은 *보이는 것*을 가릴 뿐 **막는 데 쓰지 않는다.**
   * 둘을 뭉치면 남의 저장 중에 새 저장이 열려 위의 겹침이 그대로 일어난다.
   * 전례(`iqc-skip-approval`)가 같은 화면에서 잠금과 표시를 이렇게 갈라 둔다.
   */
  const isPartnerRoleLocked = partnerRoleWrite.isSaving;

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

  /**
   * 저장 충돌을 푸는 유일한 경로 — **최신을 다시 받아 잠금 토큰까지 갱신한다.**
   *
   * 계약이 덮어쓰기 강제를 주지 않으므로 최신 목록을 받아 다시 고르는 수밖에 없고, 고치던
   * 체크는 사라진다 — 버튼 옆 공통 안내가 **누르기 전에** 그것을 밝힌다.
   *
   * ⛔ **자동 재시도를 두지 않는다.** 통째 교체 저장이라 다시 부른 목록 위에서 사용자가 다시
   * 고르지 않으면 그사이 남이 붙인 역할을 덮어쓴다 — 충돌 보호가 막으려던 바로 그 일이다.
   *
   * **있는 규율을 지난다.** 위 `resetPartnerRoleEditing`이 쓰기 거둠(`resetIfIdle` 경유)·확인
   * 창 닫기·초안 비움을 한자리에 갖고 있다. 새 함수를 지으면 그 셋이 갈라지고, 특히 나가는
   * 중인 쓰기를 건드리지 않는 가드가 빠진다(`omf-mes#96`).
   *
   * **확인 창은 닫힌다.** 창이 나열하는 것은 이번 저장으로 *해제되는* 역할이고 그 목록은
   * 사용자의 초안에서 나온다 — 초안이 서버값으로 되돌아가면 해제될 것이 하나도 없어져,
   * 그대로 두면 「저장하면 아래 역할이 해제됩니다」 아래에 빈 목록이 선 창이 남는다.
   * 「실패해도 창을 닫지 않는다」는 규율의 이유는 *같은 자리에서 다시 시도할 수 있게* 하려는
   * 것인데, 다시 불러오기는 **그 시도의 전제를 버리는 조작**이라 같은 규율이 걸리지 않는다.
   */
  const reloadPartnerRoles = () => {
    resetPartnerRoleEditing();
    void partnerRoles.refetch();
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
    /*
     * 나가는 중인 저장이 있으면 **확인 창도 세우지 않는다.** 창은 자기 쓰기와 함께만 서는데,
     * 남의 저장 중에 열리면 두 버튼이 잠긴 채 **보낸 적 없는 진행 표시**를 돌며 갇힌다.
     */
    if (isPartnerRoleLocked) return;

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

    writeCodeGroup(formState.values);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const reloadCodeGroupDetail = () => {
    resetIfIdle(codeGroupWrite);
    resetIfIdle(codeGroupDeactivateWrite);
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

      /*
       * **등록 폼의 소비처 셋도 매임을 지난다**(D-13) — 다만 가르는 축이 자원 번호가 아니라
       * **초안 세션**이다. 이 폼은 등록 모드일 때만 마운트되지만 그 사실이 초안을 가르지는
       * 못한다 — 닫았다 다시 열면 같은 모드에서 **다른 초안**이 선다. 세 소비처가 같은 축을
       * 지나야 남는 자리가 없다(배너 · 필드 오류 · 진행 표시).
       */
      return (
        <CodeGroupFormPane
          mode="create"
          values={formState.values}
          onChange={changeCodeGroupValues}
          fieldErrors={{
            ...(isCodeGroupCreateWriteMine ? codeGroupCreateWrite.fieldErrors : {}),
            ...codeGroupFieldErrors,
          }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={
            isCodeGroupCreateWriteMine ? (
              <SaveErrorBanner error={codeGroupCreateWrite.error} />
            ) : null
          }
          /* 등록에서는 코드 칸이 열려 있다 — 아직 참조할 자료가 없다. */
          codeLockReason={null}
          deactivateDisabledReason={null}
          isDirty={isCodeGroupDirty}
          /* **막는 것은 전역** — 수정 저장이 나가는 중에 열린 등록 폼도 잠긴다(사유는 페인이 낸다). */
          isLocked={isCodeGroupLocked}
          /* **가리는 것은 초안 축** — 버린 초안의 진행 표시가 새 초안 위에서 돌지 않는다. */
          isSaving={isCodeGroupCreateWriteMine && codeGroupCreateWrite.isSaving}
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
        /*
         * 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
         * **남의 필드 오류는 아예 넘기지 않는다**(`isCodeGroupWriteMine`) — 뒤늦게 온 앞 그룹의
         * 필드 오류가 이 칸에 서면 사용자는 자기가 방금 고친 값이 거부된 줄 안다.
         */
        fieldErrors={{
          ...(isCodeGroupWriteMine ? codeGroupWrite.fieldErrors : {}),
          ...codeGroupFieldErrors,
        }}
        /*
         * **남의 실패는 아예 그리지 않는다** — 뒤늦게 온 앞 그룹의 실패가 지금 구획에 서면
         * 사용자는 손댄 적 없는 코드그룹이 막힌 줄 안다.
         */
        banner={
          isCodeGroupWriteMine ? (
            <SaveErrorBanner error={codeGroupWrite.error} onReload={reloadCodeGroupDetail} />
          ) : null
        }
        /*
         * 판정의 주인은 서버가 준 `codeEditable`이다. 화면이 스스로 잠그지 않는다 —
         * `reason`이 `EDITABLE`인데 잠긴 어긋난 조합이 실제로 내려온다.
         */
        codeLockReason={codeLockMessage(codeGroupDetail.data.editability)}
        deactivateDisabledReason={deactivateDisabledReason}
        isDirty={isCodeGroupDirty}
        /* **막는 것은 전역** — 남의 저장 중에도 새 저장이 시작되지 않는다(사유는 페인이 낸다). */
        isLocked={isCodeGroupLocked}
        /* **가리는 것은 대상 축** — 진행 표시는 자기 저장에만 돈다. */
        isSaving={isCodeGroupWriteMine && codeGroupWrite.isSaving}
        onSave={handleSaveCodeGroup}
        onCancel={() => {
          setCodeGroupFieldErrors({});
          resetIfIdle(codeGroupWrite);
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        onDeactivate={() => {
          resetIfIdle(codeGroupDeactivateWrite);
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
        {
          ...departmentOptions,
          entries: parentOptionsFor(departmentOptions.entries, selectedDepartmentId),
        },
        selectedParentId,
      ),
    [
      departmentOptions.entries,
      departmentOptions.isError,
      departmentOptions.isLoading,
      selectedDepartmentId,
      selectedParentId,
    ],
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

      /*
       * **등록 폼의 소비처 셋도 매임을 지난다**(D-13) — 다만 가르는 축이 자원 번호가 아니라
       * **초안 세션**이다. 이 폼은 등록 모드일 때만 마운트되지만 그 사실이 초안을 가르지는
       * 못한다 — 닫았다 다시 열면 같은 모드에서 **다른 초안**이 선다. 세 소비처가 같은 축을
       * 지나야 남는 자리가 없다(배너 · 필드 오류 · 진행 표시).
       */
      return (
        <DepartmentFormPane
          mode="create"
          values={departmentFormState.values}
          onChange={changeDepartmentValues}
          fieldErrors={{
            ...(isDepartmentCreateWriteMine ? departmentCreateWrite.fieldErrors : {}),
            ...departmentFieldErrors,
          }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={
            isDepartmentCreateWriteMine ? (
              <SaveErrorBanner error={departmentCreateWrite.error} />
            ) : null
          }
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
            businessUnitOptions,
            departmentFormState.values.businessUnitId,
          )}
          isDirty={isDepartmentDirty}
          /* **막는 것은 전역** — 수정 저장이 나가는 중에 열린 등록 폼도 잠긴다(사유는 페인이 낸다). */
          isLocked={isDepartmentLocked}
          /* **가리는 것은 초안 축** — 버린 초안의 진행 표시가 새 초안 위에서 돌지 않는다. */
          isSaving={isDepartmentCreateWriteMine && departmentCreateWrite.isSaving}
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
        /*
         * 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
         * **남의 필드 오류는 아예 넘기지 않는다**(`isDepartmentWriteMine`) — 뒤늦게 온 앞 부서의
         * 필드 오류가 이 칸에 서면 사용자는 자기가 방금 고친 값이 거부된 줄 안다.
         */
        fieldErrors={{
          ...(isDepartmentWriteMine ? departmentWrite.fieldErrors : {}),
          ...departmentFieldErrors,
        }}
        /*
         * 순환 참조 400도 이 배너로 온다 — 화면이 순환을 막지 않기 때문이다.
         * **남의 실패는 아예 그리지 않는다** — 뒤늦게 온 앞 부서의 실패가 지금 구획에 서면
         * 사용자는 손댄 적 없는 부서가 막힌 줄 안다.
         */
        banner={
          isDepartmentWriteMine ? (
            <SaveErrorBanner error={departmentWrite.error} onReload={reloadDepartmentDetail} />
          ) : null
        }
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
          businessUnitOptions,
          departmentFormState.values.businessUnitId,
        )}
        isDirty={isDepartmentDirty}
        /* **막는 것은 전역** — 남의 저장 중에도 새 저장이 시작되지 않는다(사유는 페인이 낸다). */
        isLocked={isDepartmentLocked}
        /* **가리는 것은 대상 축** — 진행 표시는 자기 저장에만 돈다. */
        isSaving={isDepartmentWriteMine && departmentWrite.isSaving}
        onSave={handleSaveDepartment}
        onCancel={() => {
          setDepartmentFieldErrors({});
          resetIfIdle(departmentWrite);
          setDepartmentFormState((prev) =>
            prev === null ? prev : { ...prev, values: prev.baseline },
          );
        }}
        onDeactivate={() => {
          resetIfIdle(departmentDeactivateWrite);
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
        businessUnitOptions={selectableOptions(businessUnitOptions, departmentFilters.scopeId)}
        /*
         * 조건 칩에는 번호가 아니라 이름을 낸다. 목록을 받는 중·실패·다 받은 뒤 미확인을
         * 각각 다른 상태로 내고, 이름이 도착하면 그 이름으로 바뀐다 —
         * 번호를 대신 보이면 사용자가 쓸 수 없는 값을 자료로 읽는다.
         */
        businessUnitLabel={(scopeId) => lookupLabel(businessUnitOptions, Number(scopeId))}
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
        businessUnits={workerBusinessUnits}
        plants={plantOptions}
        departments={workerDepartmentOptions}
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
        departmentOptions={selectableOptions(workerDepartmentOptions, workerFilters.scopeId)}
        departmentLabel={(scopeId) => lookupLabel(workerDepartmentOptions, Number(scopeId))}
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
          /*
           * **남의 실패는 아예 그리지 않는다**(`isQualificationWriteMine`) — 뒤늦게 온 앞
           * 작업자의 실패가 지금 구획에 서면 사용자는 손댄 적 없는 작업자가 막힌 줄 안다.
           */
          banner={
            isQualificationWriteMine ? <SaveErrorBanner error={qualificationWrite.error} /> : null
          }
          isDirty={isQualificationDirty}
          /* **막는 것은 전역** — 남의 저장 중에도 새 저장이 시작되지 않는다(사유는 페인이 낸다). */
          isLocked={isQualificationLocked}
          /* **가리는 것은 대상 축** — 진행 표시는 자기 저장에만 돈다. */
          isSaving={isQualificationWriteMine && qualificationWrite.isSaving}
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
            resetIfIdle(qualificationWrite);
            setQualificationState((prev) =>
              prev === null ? prev : { ...prev, drafts: prev.baseline },
            );
          }}
        />
      </div>
    </div>
  );

  /**
   * 우 칸 — 거래처 기본 정보와 그 거래처의 역할. **기본 정보는 읽기만 한다.**
   *
   * 앞단 갈래는 **상세 조회를 기준으로 갈린다**(#173) — 선택 전 · 없는 거래처 · 조회 실패 ·
   * 불러오는 중. **좌 목록의 사정은 여기를 막지 않는다**: 두 조회가 갈렸으므로 목록이 실패하거나
   * 아직 오는 중이어도 고른 거래처는 그대로 선다(목록의 실패는 좌 목록이 자기 자리에서 낸다).
   */
  const renderPartnerRolePane = (): ReactNode => {
    if (selectedPartnerId === null) {
      return (
        <section className="pane" aria-label={t.panes.partnerRoles}>
          <EmptyState size="sm" title={t.partner.empty.notSelected} />
        </section>
      );
    }

    if (partnerDetail.isError) {
      /*
       * **없는 거래처와 못 불러온 거래처를 가른다** — 할 수 있는 조치가 다르다. 없는 거래처에
       * 「다시 시도」를 내면 몇 번을 눌러도 같은 자리로 되돌아온다.
       *
       * ⛔ **404는 안내만 낸다 — 주소에서 선택을 지우지 않는다.** 형제 화면 셋이 그 정리를 하는 것은 그쪽
       * 상세가 **목록 조건에 매인 선택**이라 조건이 바뀌면 안내가 가리킬 것이 없어지기 때문이다.
       * 거래처 선택 키는 조건과 독립이므로 그 전제가 없다 — 지우면 사용자는 무엇을 열려 했는지
       * 잃고, 정리가 히스토리를 늘리는 함정까지 함께 들여온다.
       */
      return (
        <section className="pane" aria-label={t.panes.partnerRoles}>
          {isPartnerNotFound(partnerDetail.error) ? (
            <EmptyState
              size="sm"
              live
              title={t.partner.empty.notFoundTitle}
              description={t.partner.empty.notFoundDescription}
            />
          ) : (
            <LoadErrorBanner
              error={partnerDetail.error}
              onRetry={() => void partnerDetail.refetch()}
            />
          )}
        </section>
      );
    }

    /* 빈 칸을 보이면 자료가 없는 것인지 아직 받는 중인지 구분되지 않는다. */
    if (partnerDetail.data === undefined) {
      return (
        <section className="pane" aria-label={t.panes.partnerRoles}>
          <div role="status" aria-label={t.loading.partnerDetail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    return (
      <PartnerRolePane
        partner={partnerDetail.data}
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
         *
         * **재조회 수단을 함께 넘긴다.** 공통 배너가 **충돌일 때만** 그 버튼을 내므로, 다시
         * 불러도 풀리지 않는 실패에는 서지 않는다 — 거기서 내면 입력만 버리게 된다.
         */
        banner={
          isPartnerRoleConfirmOpen || !isRoleWriteMine ? null : (
            <SaveErrorBanner
              error={toPartnerRoleSaveError(partnerRoleWrite.error)}
              onReload={reloadPartnerRoles}
            />
          )
        }
        isDirty={isPartnerRoleDirty}
        /* **막는 것은 전역** — 남의 저장 중에도 새 저장이 시작되지 않는다(사유는 페인이 낸다). */
        isLocked={isPartnerRoleLocked}
        /* **가리는 것은 대상 축** — 진행 표시는 자기 저장에만 돈다. */
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
          processOptions={selectableOptions(processOptions, editingQualification.processId)}
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
            resetIfIdle(departmentDeactivateWrite);
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
            resetIfIdle(codeGroupDeactivateWrite);
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
          /*
           * **창 안에서도 다시 부를 수 있다.** 확인 창을 지나는 저장(해제가 있는 저장)이 충돌하면
           * 사유가 여기 서므로 회복 수단도 여기 있어야 한다 — 창을 닫아 구획 배너를 찾아가게 하면
           * 사용자는 승낙이 받아들여진 줄 안다. 누르면 창은 닫힌다(사유는 `reloadPartnerRoles`).
           */
          banner={
            <SaveErrorBanner
              error={toPartnerRoleSaveError(partnerRoleWrite.error)}
              onReload={reloadPartnerRoles}
            />
          }
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
