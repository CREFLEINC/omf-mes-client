import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import type { ApiClient, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { selectableOptions } from './code-options';
import { DisabledAction } from './disabled-action';
import { readFilters, readPage, toSearchParams } from './filters';
import { ItemFormDialog } from './item-form-dialog';
import {
  createItemDraft,
  isSameItemDrafts,
  moveItemDraft,
  removeItemDraft,
  toItemDrafts,
  toItemsPayload,
  upsertItemDraft,
} from './item-order';
import { ItemPane } from './item-pane';
import { hasInvalidItemDraft, validateItemDraft, warnItemDraft } from './item-validation';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { PlanActionBanner } from './plan-action-banner';
import { PlanActionDialog, type PlanActionKind } from './plan-action-dialog';
import { PlanListPane } from './plan-list-pane';
import {
  emptyPlanFormValues,
  formatApprovedAt,
  isSamePlanValues,
  planToFormValues,
  toPlanCreate,
  toPlanUpdate,
} from './plan-mappers';
import { PlanPane } from './plan-pane';
import { PLAN_FORM_FIELDS, validatePlanForm } from './plan-validation';
import { resolveVersionStatus } from './plan-version-status';
import {
  planDetailPath,
  planKeys,
  useInspectionItemSpecs,
  useInspectionPlanDetail,
  useInspectionPlanList,
  useInspectionPlanVersionDetail,
  useInspectionPlanVersionList,
  useEquipmentOptions,
  useItemOptions,
  useProcessOptions,
  useRoutingOptions,
  useUomOptions,
  versionDetailPath,
  versionKeys,
  type InspectionItemSpecListResponse,
  type LookupResult,
} from './queries';
import type {
  InspectionPlan,
  InspectionPlanVersion,
  ItemDraft,
  PlanFilters,
  PlanFormValues,
  VersionFormValues,
} from './types';
import { VersionFormPane } from './version-form-pane';
import {
  emptyVersionFormValues,
  isSameVersionValues,
  toVersionCreate,
  toVersionUpdate,
  versionToFormValues,
} from './version-mappers';
import { VersionPane } from './version-pane';
import {
  VersionTransitionDialog,
  type VersionTransitionKind,
} from './version-transition-dialog';
import { VERSION_FORM_FIELDS, validateVersionForm } from './version-validation';

type InspectionPlanDetailResponse = components['schemas']['InspectionPlanDetailResponse'];
type InspectionPlanVersionDetailResponse =
  components['schemas']['InspectionPlanVersionDetailResponse'];

const t = messages.inspectionStandard;

/** 폼의 현재 값과 그것이 어디서 나왔는지. 「고친 것이 있는가」는 둘의 비교로 판정한다. */
interface PlanFormState {
  source: InspectionPlanDetailResponse;
  baseline: PlanFormValues;
  values: PlanFormValues;
}

/** 버전 폼도 같은 모양을 쓴다 — 판정 규칙이 두 곳에서 갈리지 않게 한다. */
interface VersionFormState {
  source: InspectionPlanVersionDetailResponse;
  baseline: VersionFormValues;
  values: VersionFormValues;
}

/**
 * 검사 항목의 로컬 초안. 폼 상태와 같은 모양을 쓴다 —
 * 응답 객체를 출처로 들고 있다가 **그것이 바뀔 때만** 다시 세워야,
 * 사용자가 순서를 바꾸는 동안 캐시 갱신이 그 편집을 조용히 지우지 않는다.
 */
interface ItemDraftState {
  source: InspectionItemSpecListResponse;
  baseline: ItemDraft[];
  drafts: ItemDraft[];
}

/** 편집 창이 열려 있는 동안의 값. 확인을 눌러야 초안 목록에 들어간다. */
interface ItemDialogState {
  mode: 'create' | 'edit';
  values: ItemDraft;
}

/** 계약이 정한 버전 상태 전이 경로. 본문이 없고 멱등 키만 싣는다. */
type VersionTransitionPath =
  | '/quality/inspection-plan-versions/{inspectionPlanVersionId}:confirm'
  | '/quality/inspection-plan-versions/{inspectionPlanVersionId}:obsolete';

interface VersionTransitionOptions {
  /** 계약 클라이언트. 훅이 화면 상태를 알 필요가 없도록 필요한 것만 받는다 */
  client: ApiClient['client'];
  inspectionPlanVersionId: number | null;
  path: VersionTransitionPath;
  onDone: () => void;
}

/**
 * 상태 전이 요청 하나.
 *
 * **`etagPath`는 null이다.** 계약이 전이 경로에 `If-Match`를 요구하지 않는다 —
 * 상세 경로를 주면 토큰을 찾지 못했을 때 요청을 **보내지 않고 멈춰**
 * 「눌러도 아무 일이 없다」가 된다.
 *
 * **전이 응답에는 `ETag`가 없다.** 보관된 토큰은 전이 직후 낡은 값이 되므로,
 * 성공하면 버전 계층 전체를 무효화해 재조회가 새 토큰을 확보하게 한다.
 * 무효화를 빠뜨리면 그다음 저장이 조용히 막힌다.
 */
const useVersionTransition = ({
  client,
  inspectionPlanVersionId,
  path,
  onDone,
}: VersionTransitionOptions) =>
  useMasterWrite<void, InspectionPlanVersion>({
    request: (_variables, headers) =>
      client.POST(path, {
        params: {
          path: { inspectionPlanVersionId: inspectionPlanVersionId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [versionKeys.all],
    // 전이에는 입력칸이 없다 — 인라인으로 낼 자리가 없어 서버 오류는 전부 배너로 간다.
    knownFields: [],
    onSuccess: onDone,
  });

/**
 * W-06-02 컨테이너 — 기준 목록 → 버전 목록 → 기준·버전·항목을 3단으로 놓는다.
 *
 * **배치는 W-06-01(Routing)과 같은 3단이다.** 착수 이슈가 「버전 마스터 형 골격을 그대로
 * 재사용」을 지시했고, 접힘 기준점(1280px·720px)의 근거는 그 화면이 이미 도출해 `.three-pane`에
 * 담아 두었다 — 열 구성이 같으므로 근거를 다시 도출할 이유가 없고 `app.css`를 고치지 않는다.
 *
 * 우 칸이 2구획이 아니라 **3구획**인 이유는 자료 구조가 3계층(기준 → 버전 → 검사 항목)이고
 * 계층마다 자기 상세 조회·자기 잠금 토큰·자기 저장 실패가 있기 때문이다. 두 구획에 접으면
 * 어느 배너가 어느 저장의 실패인지 사용자가 가릴 수 없다.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?q=&type=&inactive=1&page=&plan=&ver=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 */
export const InspectionStandardScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const filters = useMemo<PlanFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  const selectedPlanId = Number(searchParams.get('plan') ?? '') || null;

  const planList = useInspectionPlanList(filters, page);
  const plans = planList.data?.items ?? [];

  const planDetail = useInspectionPlanDetail(selectedPlanId);

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const pageView = toPageView(planList.data?.page ?? { page, size: 0, total: 0 }, plans.length);

  const [formState, setFormState] = useState<PlanFormState | null>(null);

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const planSource = planDetail.data ?? null;

  if (planSource !== null && formState?.source !== planSource) {
    const seeded = planToFormValues(planSource.inspectionPlan);
    setFormState({ source: planSource, baseline: seeded, values: seeded });
  }

  const isPlanDirty = formState !== null && !isSamePlanValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [planFieldErrors, setPlanFieldErrors] = useState<Record<string, string>>({});

  /**
   * 기준 등록 폼의 값. null이면 폼이 닫혀 있다.
   *
   * 상세 응답이 없는 폼이라 수정 폼 상태와 섞지 않는다 —
   * 섞으면 「기준값이 서버에서 왔는가」가 흐려지고, 등록 성공 후 어느 쪽을 비울지도 갈린다.
   */
  const [createValues, setCreateValues] = useState<PlanFormValues | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const planWrite = useMasterWrite<PlanFormValues, InspectionPlan>({
    request: (values, headers) =>
      client.PUT('/quality/inspection-plans/{inspectionPlanId}', {
        params: {
          path: { inspectionPlanId: selectedPlanId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toPlanUpdate(values),
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 보관 키가 요청 경로라 다른 경로로 꺼내면 언제나 비어 있다.
     * 이 화면의 쓰기 열 가지 중 If-Match 를 요구하는 것은 셋뿐이고(기준 수정·기준 사용 중지·버전 수정)
     * 이것이 그 하나다(계약 실측).
     */
    etagPath: selectedPlanId === null ? null : planDetailPath(selectedPlanId),
    invalidateKeys: [planKeys.all],
    knownFields: PLAN_FORM_FIELDS,
    onSuccess: (saved) => {
      setPlanFieldErrors({});
      const next = planToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const createWrite = useMasterWrite<PlanFormValues, InspectionPlan>({
    request: (values, headers) =>
      client.POST('/quality/inspection-plans', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toPlanCreate(values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [planKeys.all],
    knownFields: PLAN_FORM_FIELDS,
    onSuccess: (saved) => {
      setCreateValues(null);
      setCreateFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 기준을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 기준을 직접 찾아야 한다.
       */
      selectPlan(saved.inspectionPlanId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 승인 — **`If-Match`를 싣지 않는다.** 계약이 이 경로에 낙관적 잠금을 두지 않았다.
   * 상세 경로를 주면 토큰을 찾지 못했을 때 요청을 보내지 않고 멈춰
   * 「눌러도 아무 일이 없다」가 된다.
   *
   * **본문이 없다.** 승인자와 승인 시각은 서버가 함께 기록한다 — 화면이 보내지 않는다.
   * 응답에 `ETag`가 없으므로 성공하면 상세를 무효화해 재조회가 새 토큰을 확보하게 한다.
   */
  const approveWrite = useMasterWrite<void, InspectionPlan>({
    request: (_variables, headers) =>
      client.POST('/quality/inspection-plans/{inspectionPlanId}:approve', {
        params: {
          path: { inspectionPlanId: selectedPlanId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [planKeys.all],
    // 액션에는 입력칸이 없다 — 인라인으로 낼 자리가 없어 서버 오류는 전부 배너로 간다.
    knownFields: [],
    onSuccess: () => {
      setPlanAction(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 사용 중지 — 같은 기준에 걸리는 액션인데도 **`If-Match`를 요구한다.**
   * 승인과 규약이 다르다(계약 실측). 여기에 `null`을 주면 서버가 거부한다.
   */
  const deactivateWrite = useMasterWrite<void, InspectionPlan>({
    request: (_variables, headers) =>
      client.POST('/quality/inspection-plans/{inspectionPlanId}:deactivate', {
        params: {
          path: { inspectionPlanId: selectedPlanId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: selectedPlanId === null ? null : planDetailPath(selectedPlanId),
    invalidateKeys: [planKeys.all],
    knownFields: [],
    onSuccess: () => {
      setPlanAction(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [planAction, setPlanAction] = useState<PlanActionKind | null>(null);
  const planActionWrite = planAction === 'deactivate' ? deactivateWrite : approveWrite;

  const versionList = useInspectionPlanVersionList(selectedPlanId);
  const versions = versionList.data?.items ?? [];
  const selectedVersionId = Number(searchParams.get('ver') ?? '') || null;

  /**
   * 버전 등록 폼의 값. null이면 폼이 닫혀 있다.
   * 상세 응답이 없는 폼이라 수정 폼 상태와 섞지 않는다.
   */
  const [versionCreateValues, setVersionCreateValues] = useState<VersionFormValues | null>(null);
  const [versionCreateFieldErrors, setVersionCreateFieldErrors] = useState<Record<string, string>>(
    {},
  );

  /**
   * 첫 버전 등록 — 기준에 버전이 하나도 없을 때만 쓴다.
   * 판 번호는 서버가 항상 1로, 상태는 항상 작성중으로 채운다(계약). 잠글 대상이 없어 `If-Match`가 없다.
   */
  const versionCreateWrite = useMasterWrite<VersionFormValues, InspectionPlanVersion>({
    request: (values, headers) =>
      client.POST('/quality/inspection-plan-versions', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toVersionCreate(values, selectedPlanId ?? 0),
      }),
    etagPath: null,
    invalidateKeys: [versionKeys.all],
    knownFields: VERSION_FORM_FIELDS,
    onSuccess: (saved) => {
      setVersionCreateValues(null);
      setVersionCreateFieldErrors({});
      selectVersion(saved.inspectionPlanVersionId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 신규 버전 발행 — 기존 버전을 복사해 새 판을 만든다.
   *
   * **원본 버전의 상태를 화면이 판정하지 않는다.** 계약은 원본이 확정이어야 한다고 정했지만
   * 상태 코드 어휘가 확정되지 않아 화면이 막으면 잘못 막았을 때 사용자가 풀 길이 없다.
   * 서버가 400(`STATE_LOCKED`)으로 거부하면 그 사유를 배너로 낸다.
   *
   * **대상은 「고른 버전 ?? 목록 첫 행」이다.** 계약이 목록을 판 번호 내림차순으로 준다고
   * 명시했으므로 첫 행이 최신이고, 아무것도 고르지 않았으면 최신을 복사하는 것이 사용자의 의도에 가깝다.
   */
  const newRevisionSourceId = selectedVersionId ?? versions[0]?.inspectionPlanVersionId ?? null;

  const newRevisionWrite = useMasterWrite<void, InspectionPlanVersion>({
    request: (_variables, headers) =>
      client.POST('/quality/inspection-plan-versions/{inspectionPlanVersionId}:new-revision', {
        params: {
          path: { inspectionPlanVersionId: newRevisionSourceId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    // 계약이 이 경로에 If-Match를 요구하지 않는다. 상세 경로를 주면 요청이 나가지 않고 멈춘다.
    etagPath: null,
    invalidateKeys: [versionKeys.all],
    knownFields: [],
    onSuccess: (saved) => {
      /*
       * 201에는 ETag가 없다 — 새 버전을 고르면 상세를 다시 조회하게 되고 그 조회가 잠금 토큰을 확보한다.
       * 여기서 옮기지 않으면 사용자가 방금 만든 버전을 목록에서 직접 찾아야 한다.
       */
      selectVersion(saved.inspectionPlanVersionId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  const versionDetail = useInspectionPlanVersionDetail(selectedVersionId);
  const itemSpecs = useInspectionItemSpecs(selectedVersionId);

  const [versionFormState, setVersionFormState] = useState<VersionFormState | null>(null);
  const [versionFieldErrors, setVersionFieldErrors] = useState<Record<string, string>>({});

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   */
  const versionSource = versionDetail.data ?? null;

  if (versionSource !== null && versionFormState?.source !== versionSource) {
    const seeded = versionToFormValues(versionSource.inspectionPlanVersion);
    setVersionFormState({ source: versionSource, baseline: seeded, values: seeded });
  }

  const isVersionDirty =
    versionFormState !== null &&
    !isSameVersionValues(versionFormState.values, versionFormState.baseline);

  /** 상세를 받기 전에는 편집을 열지 않는다 — 상태를 모르는 채로 여는 것은 잘못 여는 것이다. */
  const versionStatus =
    versionDetail.data === undefined
      ? null
      : resolveVersionStatus(versionDetail.data.inspectionPlanVersion.statusCode);

  const versionWrite = useMasterWrite<VersionFormValues, InspectionPlanVersion>({
    request: (values, headers) =>
      client.PUT('/quality/inspection-plan-versions/{inspectionPlanVersionId}', {
        params: {
          path: { inspectionPlanVersionId: selectedVersionId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toVersionUpdate(values),
      }),
    // 버전 수정은 이 화면에서 If-Match를 요구하는 세 경로 중 하나다(계약 실측).
    etagPath: selectedVersionId === null ? null : versionDetailPath(selectedVersionId),
    invalidateKeys: [versionKeys.all],
    knownFields: VERSION_FORM_FIELDS,
    onSuccess: (saved) => {
      setVersionFieldErrors({});
      const next = versionToFormValues(saved);
      setVersionFormState((prev) =>
        prev === null ? prev : { ...prev, baseline: next, values: next },
      );
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [versionTransition, setVersionTransition] = useState<VersionTransitionKind | null>(null);

  /*
   * 전이 두 갈래의 훅을 나눈다 — 하나로 묶으면 확정 실패 문구가 폐기 창에 남는다.
   */
  const finishVersionTransition = () => {
    setVersionTransition(null);
    toast.show({ variant: 'success', description: messages.common.saved });
  };

  const confirmWrite = useVersionTransition({
    client,
    inspectionPlanVersionId: selectedVersionId,
    path: '/quality/inspection-plan-versions/{inspectionPlanVersionId}:confirm',
    onDone: finishVersionTransition,
  });

  const obsoleteWrite = useVersionTransition({
    client,
    inspectionPlanVersionId: selectedVersionId,
    path: '/quality/inspection-plan-versions/{inspectionPlanVersionId}:obsolete',
    onDone: finishVersionTransition,
  });

  const versionTransitionWrite = versionTransition === 'obsolete' ? obsoleteWrite : confirmWrite;

  /*
   * 검사 항목은 화면의 로컬 초안 목록으로 다룬다 — 순서 컬럼에 유일 제약이 있어
   * 행 단위 저장이 성립하지 않기 때문이다(공유계약 A-5).
   * 응답 객체가 바뀔 때만 다시 세운다. 매 렌더 파생값으로 두면 편집 중에 캐시가 갱신될 때
   * 사용자가 바꾼 순서가 조용히 사라진다.
   */
  const [itemDraftState, setItemDraftState] = useState<ItemDraftState | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState | null>(null);
  const [itemDialogErrors, setItemDialogErrors] = useState<Record<string, string>>({});

  const itemSource = itemSpecs.data ?? null;

  if (itemSource !== null && itemDraftState?.source !== itemSource) {
    const seeded = toItemDrafts(itemSource.items);
    setItemDraftState({ source: itemSource, baseline: seeded, drafts: seeded });
  }

  const itemDrafts = itemDraftState?.drafts ?? [];
  const isItemsDirty =
    itemDraftState !== null && !isSameItemDrafts(itemDraftState.drafts, itemDraftState.baseline);

  const itemsWrite = useMasterWrite<ItemDraft[], InspectionItemSpecListResponse>({
    request: (drafts, headers) =>
      client.PUT('/quality/inspection-plan-versions/{inspectionPlanVersionId}/items', {
        params: {
          path: { inspectionPlanVersionId: selectedVersionId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { items: toItemsPayload(selectedVersionId ?? 0, drafts) },
      }),
    /*
     * 계약이 이 경로에 If-Match를 요구하지 않는다 — 컬렉션 전체 치환이라 행 단위 낙관적 잠금이 없고
     * 409도 없다. 상세 경로를 주면 토큰을 찾지 못했을 때 요청을 보내지 않고 멈춰
     * 「저장을 눌러도 아무 일이 없다」가 된다.
     */
    etagPath: null,
    /*
     * 항목 저장이 버전의 판 번호를 올리는지 계약이 밝히지 않는다.
     * 함께 무효화해 두면 어느 쪽이든 안전하고 비용은 조회 한 번이다.
     */
    invalidateKeys: [versionKeys.all],
    /*
     * 어느 행의 오류인지 계약이 알려 주지 않는다(필드명만 온다) — 인라인으로 낼 자리가 없다.
     * 전부 배너로 올린다. 삼키면 어디에도 보이지 않는 오류가 된다.
     */
    knownFields: [],
    onSuccess: (saved) => {
      // 서버가 정본이다. 채번 방식(연번·간격)은 서버 재량이라 보낸 값과 다를 수 있다.
      const reseeded = toItemDrafts(saved.items);
      setItemDraftState((prev) =>
        prev === null ? prev : { ...prev, baseline: reseeded, drafts: reseeded },
      );
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const uomOptions = useUomOptions();
  const equipmentOptions = useEquipmentOptions();

  /** 다른 버전으로 옮기면 앞의 편집과 실패 표시를 들고 가지 않는다. */
  const resetVersionEditing = () => {
    versionCreateWrite.reset();
    newRevisionWrite.reset();
    versionWrite.reset();
    confirmWrite.reset();
    obsoleteWrite.reset();
    itemsWrite.reset();
    setVersionTransition(null);
    setVersionCreateValues(null);
    setVersionCreateFieldErrors({});
    setVersionFieldErrors({});
    setItemDraftState(null);
    setItemDialog(null);
    setItemDialogErrors({});
  };

  const changeItemDrafts = (next: (drafts: ItemDraft[]) => ItemDraft[]) => {
    setItemDraftState((prev) => (prev === null ? prev : { ...prev, drafts: next(prev.drafts) }));
  };

  const handleAddItem = () => {
    setItemDialogErrors({});
    setItemDialog({ mode: 'create', values: createItemDraft() });
  };

  const handleEditItem = (draftId: string) => {
    const target = itemDrafts.find((draft) => draft.draftId === draftId);

    if (target === undefined) return;

    setItemDialogErrors({});
    setItemDialog({ mode: 'edit', values: target });
  };

  /*
   * 항목 저장은 목록 전체를 한 번에 보내므로 한 행의 잘못이 전체 저장을 무르게 한다 —
   * 행이 표에 들어오기 전에 여기서 거른다. **경고는 막지 않는다**(계약 A-9 ⓑ).
   */
  const handleSubmitItemDialog = () => {
    if (itemDialog === null) return;

    const errors = validateItemDraft(itemDialog.values, itemDrafts);
    setItemDialogErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const committed = itemDialog.values;
    changeItemDrafts((drafts) => upsertItemDraft(drafts, committed));
    setItemDialog(null);
  };

  const handleSaveItems = () => {
    if (itemDraftState === null) return;

    itemsWrite.write(itemDraftState.drafts);
  };

  /** 다른 기준으로 옮기면 앞의 편집과 실패 표시를 들고 가지 않는다. */
  const resetPlanEditing = () => {
    planWrite.reset();
    createWrite.reset();
    approveWrite.reset();
    deactivateWrite.reset();
    setPlanAction(null);
    setPlanFieldErrors({});
    setCreateFieldErrors({});
    setCreateValues(null);
    resetVersionEditing();
  };

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `plan`·`ver`가 자연히 사라진다 — 보이는 행이 달라지는데 선택이 남으면
   * 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: PlanFilters) => {
    resetPlanEditing();
    setSearchParams(toSearchParams(next, 1));
  };

  const changePage = (nextPage: number) => {
    resetPlanEditing();
    setSearchParams(toSearchParams(filters, nextPage));
  };

  /** 기준을 바꾸면 버전 선택을 지운다 — 다른 기준의 버전을 가리키면 안 된다. */
  function selectPlan(inspectionPlanId: number): void {
    const next = new URLSearchParams(searchParams);
    next.set('plan', String(inspectionPlanId));
    next.delete('ver');
    setSearchParams(next);
  }

  const handleSelectPlan = (inspectionPlanId: number) => {
    resetPlanEditing();
    selectPlan(inspectionPlanId);
  };

  function selectVersion(inspectionPlanVersionId: number): void {
    const next = new URLSearchParams(searchParams);
    next.set('ver', String(inspectionPlanVersionId));
    setSearchParams(next);
  }

  const handleSelectVersion = (inspectionPlanVersionId: number) => {
    resetVersionEditing();
    selectVersion(inspectionPlanVersionId);
  };

  const handleChangeVersionCreateValues = (patch: Partial<VersionFormValues>) => {
    setVersionCreateValues((prev) => (prev === null ? prev : { ...prev, ...patch }));

    for (const field of Object.keys(patch)) {
      versionCreateWrite.clearFieldError(field);
      setVersionCreateFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveVersionCreate = () => {
    if (versionCreateValues === null) return;

    const errors = validateVersionForm(versionCreateValues);
    setVersionCreateFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    versionCreateWrite.write(versionCreateValues);
  };

  const handleChangeVersionValues = (patch: Partial<VersionFormValues>) => {
    setVersionFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      versionWrite.clearFieldError(field);
      setVersionFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveVersion = () => {
    if (versionFormState === null) return;

    const errors = validateVersionForm(versionFormState.values);
    setVersionFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    versionWrite.write(versionFormState.values);
  };

  const handleReloadVersionDetail = () => {
    versionWrite.reset();
    setVersionFieldErrors({});
    setVersionFormState(null);
    void versionDetail.refetch();
  };

  /**
   * 라우팅은 **품목을 고른 뒤에만** 조회한다 — 계약이 `itemId`를 필수 쿼리로 두었다.
   * 지금 열려 있는 폼(등록 또는 수정)의 품목이 그 기준이다.
   */
  const activeValues = createValues ?? formState?.values ?? null;
  const activeItemId = Number(activeValues?.itemId ?? '') || null;

  const itemOptions = useItemOptions();
  const processOptions = useProcessOptions();
  const routingOptions = useRoutingOptions(activeItemId);

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 폼 위에 낸다.
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const optionsNotice = (() => {
    const lookups: LookupResult[] = [itemOptions, processOptions, routingOptions];

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
  })();

  /**
   * 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
   *
   * **품목을 바꾸면 라우팅 값을 비운다** — 다른 품목의 라우팅을 가리키면 안 된다.
   * 계약이 공정 개정 시 자동 승계를 정하지 않았고, 이슈도 「사용자가 다시 고른다」로 확정했다.
   */
  const withItemChangeRule = (patch: Partial<PlanFormValues>): Partial<PlanFormValues> =>
    'itemId' in patch ? { ...patch, routingId: '' } : patch;

  const clearFieldErrors = (
    patch: Partial<PlanFormValues>,
    setErrors: (updater: (prev: Record<string, string>) => Record<string, string>) => void,
    clearServerError: (field: string) => void,
  ) => {
    for (const field of Object.keys(patch)) {
      clearServerError(field);
      setErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const changePlanValues = (rawPatch: Partial<PlanFormValues>) => {
    const patch = withItemChangeRule(rawPatch);

    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );
    clearFieldErrors(patch, setPlanFieldErrors, planWrite.clearFieldError);
  };

  const changeCreateValues = (rawPatch: Partial<PlanFormValues>) => {
    const patch = withItemChangeRule(rawPatch);

    setCreateValues((prev) => (prev === null ? prev : { ...prev, ...patch }));
    clearFieldErrors(patch, setCreateFieldErrors, createWrite.clearFieldError);
  };

  const handleSavePlan = () => {
    if (formState === null) return;

    const errors = validatePlanForm(formState.values);
    setPlanFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    planWrite.write(formState.values);
  };

  const handleSaveCreate = () => {
    if (createValues === null) return;

    const errors = validatePlanForm(createValues);
    setCreateFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    createWrite.write(createValues);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const handleReloadPlanDetail = () => {
    planWrite.reset();
    setPlanFieldErrors({});
    setFormState(null);
    void planDetail.refetch();
  };

  const routingDisabledReason = activeItemId === null ? t.actionReasons.routingNeedsItem : null;

  const optionsFor = (lookup: LookupResult, selected: string) =>
    selectableOptions(lookup.entries, selected);

  /**
   * 승인·사용 중지를 막는 사유. 서버가 최종 판정을 하지만(400·403·409)
   * 이미 끝난 액션은 화면이 먼저 막고 **왜 못 하는지** 알린다.
   *
   * 아직 등록하지 않은 기준에는 액션을 걸 대상 자체가 없다 — 감추지 않고 사유와 함께 비활성으로 둔다.
   */
  const savedPlan = planDetail.data?.inspectionPlan ?? null;

  const approveDisabledReason = ((): string | null => {
    if (createValues !== null || savedPlan === null) return t.actionReasons.approveNeedsPlan;
    if (formatApprovedAt(savedPlan.approvedAt) !== null) return t.actionReasons.approveAlreadyDone;

    return null;
  })();

  const deactivateDisabledReason = ((): string | null => {
    if (createValues !== null || savedPlan === null) return t.actionReasons.deactivateNeedsPlan;
    if (!savedPlan.isActive) return t.actionReasons.deactivateAlreadyDone;

    return null;
  })();

  const isPlanActionRunning = approveWrite.isSaving || deactivateWrite.isSaving;

  /*
   * 발행하면 새 버전이 선택돼 지금 버전을 떠난다 — 저장하지 않은 편집은 그때 사라진다.
   * 잃기 전에 먼저 막고 무엇을 하면 풀리는지 알린다.
   */
  const isAnythingDirty = isPlanDirty || isVersionDirty || isItemsDirty;

  const newRevisionDisabledReason = isAnythingDirty
    ? t.actionReasons.newVersionBlockedByUnsaved
    : null;

  /**
   * 확정을 막는 사유. 서버가 최종 판정을 하지만(400 `STATE_LOCKED`·`LINE_REQUIRED`),
   * 화면이 먼저 막고 **무엇을 하면 풀리는지** 알린다.
   *
   * 항목 건수는 **서버가 준 목록**으로 센다. 저장하지 않은 초안으로 세면
   * 화면은 「1건 있음」인데 서버는 0건이라 확정이 400으로 거부된다.
   */
  const savedItemCount = itemSpecs.data?.items.length ?? 0;

  const confirmDisabledReason = ((): string | null => {
    if (versionStatus === null) return t.actionReasons.transitionNeedsVersion;
    if (!versionStatus.isEditable) return t.actionReasons.confirmNeedsDraft;
    // 확정하면 되돌릴 수 없다 — 저장하지 않은 편집은 그 순간 영영 사라진다.
    if (isAnythingDirty) return t.actionReasons.confirmBlockedByUnsaved;
    if (savedItemCount === 0) return t.actionReasons.confirmNeedsItems;

    return null;
  })();

  /** 폐기는 확정된 버전에만 성립한다 — 계약이 그렇게 정했다. */
  const obsoleteDisabledReason = ((): string | null => {
    if (versionStatus === null) return t.actionReasons.transitionNeedsVersion;

    return versionStatus.status === 'confirmed' ? null : t.actionReasons.obsoleteNeedsConfirmed;
  })();

  const isVersionTransitionRunning = confirmWrite.isSaving || obsoleteWrite.isSaving;

  const renderVersionTransitionActions = (): ReactNode => (
    <>
      {confirmDisabledReason === null ? (
        <div className="field-cell">
          <Button
            variant="outlined"
            disabled={isVersionTransitionRunning}
            onClick={() => {
              confirmWrite.reset();
              setVersionTransition('confirm');
            }}
          >
            {t.actions.confirm}
          </Button>
        </div>
      ) : (
        <DisabledAction label={t.actions.confirm} reason={confirmDisabledReason} />
      )}

      {obsoleteDisabledReason === null ? (
        <div className="field-cell">
          <Button
            variant="outlined"
            disabled={isVersionTransitionRunning}
            onClick={() => {
              obsoleteWrite.reset();
              setVersionTransition('obsolete');
            }}
          >
            {t.actions.obsolete}
          </Button>
        </div>
      ) : (
        <DisabledAction label={t.actions.obsolete} reason={obsoleteDisabledReason} />
      )}

      {/* 계약에 경로가 없다. 감추지 않고 사유와 함께 비활성으로 둔다. */}
      <DisabledAction
        label={t.actions.compareVersions}
        reason={t.actionReasons.compareVersionsUnavailable}
      />
      <DisabledAction
        label={t.actions.changeHistory}
        reason={t.actionReasons.changeHistoryUnavailable}
        className="form-actions-secondary"
      />
    </>
  );

  const renderPlanActions = (): ReactNode => (
    <>
      {approveDisabledReason === null ? (
        <div className="field-cell">
          <Button
            variant="outlined"
            disabled={isPlanActionRunning}
            onClick={() => {
              approveWrite.reset();
              setPlanAction('approve');
            }}
          >
            {t.actions.approve}
          </Button>
        </div>
      ) : (
        <DisabledAction label={t.actions.approve} reason={approveDisabledReason} />
      )}

      {deactivateDisabledReason === null ? (
        <div className="field-cell form-actions-secondary">
          <Button
            variant="outlined"
            disabled={isPlanActionRunning}
            onClick={() => {
              deactivateWrite.reset();
              setPlanAction('deactivate');
            }}
          >
            {messages.common.deactivate}
          </Button>
        </div>
      ) : (
        <DisabledAction
          label={messages.common.deactivate}
          reason={deactivateDisabledReason}
          className="form-actions-secondary"
        />
      )}
    </>
  );

  /**
   * 우 상단 편집 칸. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderPlanPane = () => {
    if (createValues !== null) {
      return (
        <PlanPane
          mode="create"
          plan={null}
          values={createValues}
          onChange={changeCreateValues}
          fieldErrors={{ ...createWrite.fieldErrors, ...createFieldErrors }}
          /* 첫 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={createWrite.error} />}
          optionsNotice={optionsNotice}
          itemOptions={optionsFor(itemOptions, createValues.itemId)}
          processOptions={optionsFor(processOptions, createValues.processId)}
          routingOptions={optionsFor(routingOptions, createValues.routingId)}
          routingDisabledReason={routingDisabledReason}
          // 새로 짓는 코드는 잠길 이유가 없다. editability는 이미 있는 자원의 판정이다.
          codeLockReason={null}
          isDirty={!isSamePlanValues(createValues, emptyPlanFormValues())}
          isSaving={createWrite.isSaving}
          onSave={handleSaveCreate}
          onCancel={() => {
            createWrite.reset();
            setCreateValues(null);
            setCreateFieldErrors({});
          }}
          // 아직 없는 기준에는 승인·중지할 대상이 없다. 감추지 않고 사유와 함께 비활성으로 둔다.
          transitionActions={renderPlanActions()}
        />
      );
    }

    if (selectedPlanId === null) {
      return (
        <section className="pane" aria-label={t.panes.planForm}>
          <EmptyState size="sm" title={t.empty.planNotSelected} />
        </section>
      );
    }

    if (planDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.planForm}>
          <LoadErrorBanner error={planDetail.error} onRetry={() => void planDetail.refetch()} />
        </section>
      );
    }

    if (planDetail.data === undefined || formState === null) {
      return (
        <section className="pane" aria-label={t.panes.planForm}>
          <div role="status" aria-label={t.loading.planDetail}>
            <SkeletonText lines={5} />
          </div>
        </section>
      );
    }

    return (
      <PlanPane
        mode="edit"
        plan={planDetail.data.inspectionPlan}
        values={formState.values}
        onChange={changePlanValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...planWrite.fieldErrors, ...planFieldErrors }}
        banner={<SaveErrorBanner error={planWrite.error} onReload={handleReloadPlanDetail} />}
        optionsNotice={optionsNotice}
        itemOptions={optionsFor(itemOptions, formState.values.itemId)}
        processOptions={optionsFor(processOptions, formState.values.processId)}
        routingOptions={optionsFor(routingOptions, formState.values.routingId)}
        routingDisabledReason={routingDisabledReason}
        // 판정의 주인은 codeEditable이다. reason은 문구 선택에만 쓴다.
        codeLockReason={codeLockMessage(planDetail.data.editability)}
        isDirty={isPlanDirty}
        isSaving={planWrite.isSaving}
        onSave={handleSavePlan}
        onCancel={() => {
          planWrite.reset();
          setPlanFieldErrors({});
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        transitionActions={renderPlanActions()}
      />
    );
  };

  /**
   * 우 중단 편집 칸. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderVersionFormPane = (): ReactNode => {
    if (versionCreateValues !== null) {
      return (
        <VersionFormPane
          mode="create"
          // 판 번호와 상태는 서버가 채운다 — 없는 값을 미리 지어내 보이지 않는다.
          planVersion={null}
          status={null}
          values={versionCreateValues}
          onChange={handleChangeVersionCreateValues}
          fieldErrors={{ ...versionCreateWrite.fieldErrors, ...versionCreateFieldErrors }}
          /* 첫 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<PlanActionBanner error={versionCreateWrite.error} />}
          isDirty={!isSameVersionValues(versionCreateValues, emptyVersionFormValues())}
          isSaving={versionCreateWrite.isSaving}
          onSave={handleSaveVersionCreate}
          onCancel={resetVersionEditing}
          // 아직 없는 버전에는 전이할 대상이 없다. 감추지 않고 사유와 함께 비활성으로 둔다.
          transitionActions={renderVersionTransitionActions()}
        />
      );
    }

    if (selectedPlanId === null) return null;

    if (selectedVersionId === null) {
      return (
        <section className="pane" aria-label={t.panes.versionForm}>
          <EmptyState size="sm" title={t.empty.versionNotSelected} />
        </section>
      );
    }

    if (versionDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.versionForm}>
          <LoadErrorBanner
            error={versionDetail.error}
            onRetry={() => void versionDetail.refetch()}
          />
        </section>
      );
    }

    if (versionDetail.data === undefined || versionFormState === null) {
      return (
        <section className="pane" aria-label={t.panes.versionForm}>
          <div role="status" aria-label={t.loading.versionDetail}>
            <SkeletonText lines={5} />
          </div>
        </section>
      );
    }

    return (
      <VersionFormPane
        mode="edit"
        planVersion={versionDetail.data.inspectionPlanVersion.planVersion}
        status={versionStatus}
        values={versionFormState.values}
        onChange={handleChangeVersionValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...versionWrite.fieldErrors, ...versionFieldErrors }}
        banner={
          <PlanActionBanner error={versionWrite.error} onReload={handleReloadVersionDetail} />
        }
        isDirty={isVersionDirty}
        isSaving={versionWrite.isSaving}
        onSave={handleSaveVersion}
        onCancel={() => {
          versionWrite.reset();
          setVersionFieldErrors({});
          setVersionFormState((prev) =>
            prev === null ? prev : { ...prev, values: prev.baseline },
          );
        }}
        transitionActions={renderVersionTransitionActions()}
      />
    );
  };

  /**
   * 항목 저장을 막는 사유. 잠금은 페인이 따로 다루므로 여기서는 잠금 밖의 사유만 고른다.
   *
   * 버전에 저장하지 않은 변경이 있으면 막는 이유: 항목 저장이 성공하면 버전 상세도 다시 불러오고,
   * 그때 폼이 서버 값으로 다시 세워져 **사용자가 입력한 버전 값이 조용히 사라진다.**
   */
  const itemsSaveBlockedReason = ((): string | null => {
    if (isVersionDirty) return t.actionReasons.itemsSaveBlockedByHeader;
    if (hasInvalidItemDraft(itemDrafts)) return t.actionReasons.itemsSaveBlockedByInvalid;

    return null;
  })();

  /**
   * 단위 id를 사람이 읽는 이름으로 옮긴다.
   * 목록에 없는 값은 코드를 그대로 낸다 — 빼 버리면 값이 사라진 것처럼 보인다.
   */
  const uomLabelOf = (uomId: string): string => {
    const entry = uomOptions.entries.find((item) => item.value === uomId);

    if (entry === undefined) return uomId;

    return entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`;
  };

  /**
   * 검사 항목이 쓰는 선택 목록이 잘리거나 실패했다는 사실을 표 위에 낸다.
   * 알리지 않으면 단위 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const itemOptionsNotice = (() => {
    const lookups: LookupResult[] = [uomOptions, equipmentOptions];

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
  })();

  /** 검사 항목 구획. 버전 등록 폼이 열려 있는 동안에는 붙일 버전이 없어 내지 않는다. */
  const renderItemPane = (): ReactNode => {
    if (selectedPlanId === null || versionCreateValues !== null) return null;

    return (
      <ItemPane
        drafts={itemDrafts}
        uomLabel={uomLabelOf}
        isLoading={itemSpecs.isPending}
        isVersionSelected={selectedVersionId !== null}
        loadError={
          itemSpecs.isError ? (
            <LoadErrorBanner error={itemSpecs.error} onRetry={() => void itemSpecs.refetch()} />
          ) : null
        }
        optionsNotice={itemOptionsNotice}
        isEditable={versionStatus?.isEditable === true}
        lockReason={t.actionReasons.versionLocked}
        isDirty={isItemsDirty}
        isSaving={itemsWrite.isSaving}
        saveBlockedReason={itemsSaveBlockedReason}
        /* 전체 치환에는 409가 없다(계약 실측) — 「최신 불러오기」를 낼 자리가 아니다. */
        banner={<PlanActionBanner error={itemsWrite.error} />}
        onAdd={handleAddItem}
        onEdit={handleEditItem}
        onRemove={(draftId) => {
          changeItemDrafts((drafts) => removeItemDraft(drafts, draftId));
        }}
        /* 순서 이동은 초안만 바꾼다. 여기서 서버를 부르지 않는다(공유계약 A-5). */
        onReorder={(from, to) => {
          changeItemDrafts((drafts) => moveItemDraft(drafts, from, to));
        }}
        onSave={handleSaveItems}
        onCancel={() => {
          itemsWrite.reset();
          setItemDraftState((prev) => (prev === null ? prev : { ...prev, drafts: prev.baseline }));
        }}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <div className="three-pane">
        <PlanListPane
          plans={plans}
          isLoading={planList.isPending}
          appliedFilters={filters}
          onApplyFilters={applyFilters}
          pageView={pageView}
          onChangePage={changePage}
          selectedPlanId={selectedPlanId}
          onSelect={handleSelectPlan}
          isCreating={createValues !== null}
          onAddPlan={() => {
            resetPlanEditing();
            setCreateValues(emptyPlanFormValues());
          }}
          loadError={
            planList.isError ? (
              <LoadErrorBanner error={planList.error} onRetry={() => void planList.refetch()} />
            ) : null
          }
        />

        <VersionPane
          versions={versions}
          isLoading={versionList.isPending}
          isPlanSelected={selectedPlanId !== null}
          selectedVersionId={selectedVersionId}
          onSelect={handleSelectVersion}
          loadError={
            versionList.isError ? (
              <LoadErrorBanner
                error={versionList.error}
                onRetry={() => void versionList.refetch()}
              />
            ) : null
          }
          newRevisionDisabledReason={newRevisionDisabledReason}
          isCreating={versionCreateValues !== null}
          isPublishing={newRevisionWrite.isSaving}
          onNewRevision={() => {
            newRevisionWrite.write();
          }}
          onCreateVersion={() => {
            resetVersionEditing();
            setVersionCreateValues(emptyVersionFormValues());
          }}
          /* 등록·발행에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={
            <>
              <PlanActionBanner error={versionCreateWrite.error} />
              <PlanActionBanner error={newRevisionWrite.error} />
            </>
          }
        />

        <div className="pane-stack">
          {renderPlanPane()}
          {renderVersionFormPane()}
          {renderItemPane()}
        </div>
      </div>

      {/*
       * 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다.
       * 되돌릴 수 없는 액션이라 확인을 한 단계 두고, **실패해도 창을 닫지 않는다** —
       * 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
       */}
      {planAction !== null && (
        <PlanActionDialog
          open
          kind={planAction}
          onClose={() => {
            setPlanAction(null);
            approveWrite.reset();
            deactivateWrite.reset();
          }}
          onConfirm={() => {
            planActionWrite.write();
          }}
          isSaving={planActionWrite.isSaving}
          banner={
            <PlanActionBanner
              error={planActionWrite.error}
              /* 409는 사용 중지에만 있다(계약 실측) — 승인에 내면 헛수고를 시킨다. */
              onReload={planAction === 'deactivate' ? handleReloadPlanDetail : undefined}
            />
          }
        />
      )}

      {/* 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 편집 값이 그대로 살아 있다. */}
      {itemDialog !== null && (
        <ItemFormDialog
          open
          mode={itemDialog.mode}
          values={itemDialog.values}
          onChange={(patch) => {
            setItemDialog((prev) =>
              prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
            );

            for (const field of Object.keys(patch)) {
              setItemDialogErrors((prev) => {
                if (!(field in prev)) return prev;
                const next = { ...prev };
                delete next[field];
                return next;
              });
            }
          }}
          fieldErrors={itemDialogErrors}
          /* 경고는 확인을 막지 않는다 — 계약이 경고 등급으로 정했다(A-9 ⓑ). */
          fieldWarnings={warnItemDraft(itemDialog.values)}
          uomOptions={optionsFor(uomOptions, itemDialog.values.uomId)}
          equipmentOptions={optionsFor(
            equipmentOptions,
            itemDialog.values.defaultInspectionEquipmentId,
          )}
          isSubmitting={false}
          onClose={() => {
            setItemDialog(null);
            setItemDialogErrors({});
          }}
          onSubmit={handleSubmitItemDialog}
        />
      )}

      {versionTransition !== null && (
        <VersionTransitionDialog
          open
          kind={versionTransition}
          onClose={() => {
            setVersionTransition(null);
            confirmWrite.reset();
            obsoleteWrite.reset();
          }}
          onConfirm={() => {
            versionTransitionWrite.write();
          }}
          isSaving={versionTransitionWrite.isSaving}
          /* 전이에는 409가 없다(계약 실측) — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<PlanActionBanner error={versionTransitionWrite.error} />}
        />
      )}
    </>
  );
};
