import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { ApiClient, ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { lookupDisplayLabel, selectableLookupOptions } from '../../patterns/lookup-display';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { usePageHub } from '../../patterns/page-hub';
import { PaneEmptyIcon } from '../../patterns/pane-empty-icon';
import { TAB_PAGE_SIZES } from '../../patterns/client-page';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { DependencyDialog } from './dependency-dialog';
import { HeaderPane } from './header-pane';
import { ROUTING_HEADER_FORM_FIELDS, validateRoutingHeader } from './header-validation';
import { ItemFilterBar, ItemPane, ItemStatusChips } from './item-pane';
import { DiscardDialog, LeaveGuard } from './leave-guard';
import {
  emptyHeaderFormValues,
  isSameHeaderValues,
  routingToFormValues,
  toRoutingCreate,
  toRoutingUpdate,
} from './mappers';
import { OperationFormDialog } from './operation-form-dialog';
import {
  createOperationDraft,
  isSameDrafts,
  moveDraft,
  removeDraft,
  toOperationDrafts,
  toOperationsPayload,
  upsertDraft,
} from './operation-order';
import { hasIncompleteDraft, validateOperationDraft } from './operation-validation';
import { OperationsPane } from './operations-pane';
import { ProcessMasterPane } from './process-master-pane';
import { ROUTING_ORIENTATION_KEY } from './split-layout';
import {
  type ListPaging,
  routingDetailPath,
  routingKeys,
  useItemList,
  useItemRevisionSummaries,
  useOperationDependencies,
  usePqcPlanForItem,
  useProcessOptions,
  useRoutingDetail,
  useRoutingList,
  useRoutingOperations,
  type RoutingOperationListResponse,
} from './queries';
import { RevisionActions, RevisionPane } from './revision-pane';
import { RoutingActions } from './routing-actions';
import { RevisionCompareDialog } from './revision-compare-dialog';
import { RevisionDetailDialog } from './revision-detail-dialog';
import { RevisionHistoryDialog } from './revision-history-dialog';
import { SetDefaultDialog } from './set-default-dialog';
import { resolveRoutingStatus } from './routing-status';
import { TransitionConfirmDialog, type RoutingTransitionKind } from './transition-confirm-dialog';
import type {
  ItemFilters,
  OperationDraft,
  Routing,
  RoutingHeaderFormValues,
  SelectOption,
} from './types';

type RoutingDetailResponse = components['schemas']['RoutingDetailResponse'];

/** 폼의 현재 값과 그것이 어디서 나왔는지. 「고친 것이 있는가」는 둘의 비교로 판정한다. */
interface HeaderFormState {
  source: RoutingDetailResponse;
  baseline: RoutingHeaderFormValues;
  values: RoutingHeaderFormValues;
}

/**
 * 공정 라인의 로컬 초안. 헤더 폼과 같은 모양을 쓴다 —
 * 응답 객체를 출처로 들고 있다가 **그것이 바뀔 때만** 다시 세워야,
 * 사용자가 순서를 바꾸는 동안 캐시 갱신이 그 편집을 조용히 지우지 않는다.
 */
interface OperationDraftState {
  source: RoutingOperationListResponse;
  baseline: OperationDraft[];
  drafts: OperationDraft[];
}

/** 편집 창이 열려 있는 동안의 값. 확인을 눌러야 초안 목록에 들어간다. */
interface OperationDialogState {
  mode: 'create' | 'edit';
  values: OperationDraft;
}

const t = messages.routing;
const hubText = messages.common.inspectionHub;

/** 검사 기준 화면 — 「PQC 검사 기준」 옆 단추가 이 주소로 옮긴다(`plan` · `edit` · `new` · `newItem` 은 그 화면의 주소 칸이다). */
const INSPECTION_STANDARD_PATH = '/master-data/inspection-standard';

/** 바뀌면 편집 대상이 바뀌는 질의 — 품목과 Rev. */
/** 주소의 진행 상태(`status`) — 모르는 값은 조건 없음으로 읽는다(#231). */
const parseLatestStatus = (value: string | null): ItemFilters['latestStatus'] =>
  value === 'DRAFT' || value === 'CONFIRMED' || value === 'OBSOLETE' ? value : '';

const EDIT_TARGET_PARAMS = ['item', 'rev'] as const;

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 저장 실패와 달리 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 *
 * 서버가 빈 문구를 주는 일이 실제로 있다 — `??`는 빈 문자열을 통과시켜 배너 본문을 지운다.
 * 그래서 널이 아니라 빈 문자열까지 명시적으로 검사한다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/** 계약이 정한 상태 전이 경로. 본문이 없고 멱등 키만 싣는다. */
type TransitionPath =
  | '/planning/routings/{routingId}:confirm'
  | '/planning/routings/{routingId}:obsolete'
  | '/planning/routings/{routingId}:new-revision'
  | '/planning/routings/{routingId}:set-default';

interface RoutingTransitionOptions {
  /** 계약 클라이언트. 훅이 화면 상태를 알 필요가 없도록 필요한 것만 받는다 */
  client: ApiClient['client'];
  routingId: number | null;
  path: TransitionPath;
  onDone: (saved: Routing) => void;
}

/**
 * 상태 전이 요청 하나.
 *
 * **`etagPath`는 null이다.** 계약이 전이 경로에 If-Match를 요구하지 않는다 —
 * 상세 경로를 주면 토큰을 찾지 못했을 때 요청을 보내지 않고 멈춰 「눌러도 아무 일이 없다」가 된다.
 *
 * **전이 응답에는 ETag가 없다.** 보관된 토큰은 전이 직후 낡은 값이 되므로,
 * 성공하면 상세를 무효화해 재조회가 새 토큰을 확보하게 한다. 무효화를 빠뜨리면
 * 그다음 헤더 저장이 조용히 막힌다.
 */
const useRoutingTransition = ({ client, routingId, path, onDone }: RoutingTransitionOptions) =>
  useMasterWrite<void, Routing>({
    request: (_variables, headers) =>
      client.POST(path, {
        params: {
          path: { routingId: routingId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [routingKeys.all],
    // 전이에는 입력칸이 없다 — 인라인으로 낼 자리가 없어 서버 오류는 전부 배너로 간다.
    knownFields: [],
    onSuccess: onDone,
  });

/** 조회 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매를 붙인다. */
const LoadErrorBanner = ({ error, onRetry }: LoadErrorBannerProps) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

/**
 * W-06-01 컨테이너 — 품목 → Rev → 헤더·공정 라인을 3단으로 놓는다.
 *
 * **접힘 기준점 1280px의 근거**(배치 규범 5의 이탈 조건이 정한 자리):
 * 좌 240 + 중 200 + 이음매 40 + 본문 안쪽 여백 48 = 528px이 왼쪽 두 칸의 하한이고,
 * 오른쪽 편집 칸은 폼 그리드 2열을 유지할 폭(약 700px)이 필요하다. 합이 약 1,228px이라
 * 기존 규범 5와 같은 1280px을 쓴다. 그 아래에서는 좌·중을 한 줄로 두고 편집 칸을 다음 줄 전체 폭으로 내린다.
 * 3단을 쓰는 화면이 둘이 되면 그때 규범으로 올린다 — 화면 한 장에서 전반 규범을 뽑으면 과적합한다.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?item=&rev=&q=&noRouting=1`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 */
const RoutingWorkspace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const toast = useToast();
  const { client } = useApiClient();
  /* 조회 상자 · 목록 | 상세 — 검사 조회·판정과 같은 분할(#231). 비율 · 배치는 브라우저에 남는다. */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:routing:split', 0.35);
  const layout = useSplitOrientation(ROUTING_ORIENTATION_KEY);

  const filters = useMemo<ItemFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      onlyWithoutRouting: searchParams.get('noRouting') === '1',
      latestStatus: parseLatestStatus(searchParams.get('status')),
    }),
    [searchParams],
  );

  /* 품목 목록 쪽 — 주소가 소유한다(#231). 건수는 쪽 이동 줄이 고르는 10 · 20 · 50 중 하나다(기본 20). */
  const itemPaging = useMemo<ListPaging>(
    () => ({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      size: TAB_PAGE_SIZES.find((size) => String(size) === searchParams.get('size')) ?? 20,
    }),
    [searchParams],
  );

  const selectedItemId = Number(searchParams.get('item') ?? '') || null;
  const selectedRoutingId = Number(searchParams.get('rev') ?? '') || null;

  const itemList = useItemList(filters, itemPaging);
  const items = itemList.data?.items ?? [];
  /* 보이는 쪽 품목의 기본 Rev · 작성중 Rev · 개정 수 — 품목 목록 열(#231). */
  const revisionSummaries = useItemRevisionSummaries(items.map((item) => item.itemId));

  const revisionList = useRoutingList(selectedItemId);
  const revisions = revisionList.data?.items ?? [];

  const detail = useRoutingDetail(selectedRoutingId);
  const operationList = useRoutingOperations(selectedRoutingId);
  const dependencyList = useOperationDependencies(selectedRoutingId);
  const processOptions = useProcessOptions();

  const [formState, setFormState] = useState<HeaderFormState | null>(null);

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const formSource = detail.data ?? null;

  if (formSource !== null && formState?.source !== formSource) {
    const seeded = routingToFormValues(formSource.routing);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const isHeaderDirty =
    formState !== null && !isSameHeaderValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>({});

  /**
   * 하단 「저장」 한 번으로 기본 정보 → 공정 구성을 차례로 저장한다(사용자 지시 · #231). 서버는 둘을 따로 받는다.
   * 기본 정보가 성공하면 그때 공정 구성을 보낸다 — 기본 정보가 실패하면 공정 구성은 보내지 않는다.
   */
  const operationsAfterHeaderRef = useRef<OperationDraft[] | null>(null);
  const operationsWriteRef = useRef<((drafts: OperationDraft[]) => void) | null>(null);

  const headerWrite = useMasterWrite<RoutingHeaderFormValues, Routing>({
    request: (values, headers) =>
      client.PUT('/planning/routings/{routingId}', {
        params: {
          path: { routingId: selectedRoutingId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toRoutingUpdate(values),
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 보관 키가 요청 경로라 다른 경로로 꺼내면 언제나 비어 있다.
     * 헤더 수정은 이 화면에서 If-Match를 요구하는 유일한 경로다(계약 실측).
     */
    etagPath: selectedRoutingId === null ? null : routingDetailPath(selectedRoutingId),
    invalidateKeys: [routingKeys.all],
    knownFields: ROUTING_HEADER_FORM_FIELDS,
    onSuccess: (saved) => {
      setLocalFieldErrors({});
      const next = routingToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      /* 하단 「저장」이 공정 구성도 함께 저장할 차례면 이어서 보낸다(#231) — 기본 정보가 성공한 뒤에만. */
      const pendingOperations = operationsAfterHeaderRef.current;
      operationsAfterHeaderRef.current = null;
      if (pendingOperations !== null) {
        operationsWriteRef.current?.(pendingOperations);
        return;
      }
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeHeaderValues = (patch: Partial<RoutingHeaderFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      headerWrite.clearFieldError(field);
      setLocalFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveHeader = () => {
    if (formState === null) return;

    const errors = validateRoutingHeader(formState.values);
    setLocalFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    headerWrite.write(formState.values);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const handleReloadDetail = () => {
    headerWrite.reset();
    setLocalFieldErrors({});
    setFormState(null);
    void detail.refetch();
  };

  /** 다른 Rev·품목으로 옮기면 앞의 실패 표시를 들고 가지 않는다. */
  const resetHeaderEditing = () => {
    headerWrite.reset();
    setLocalFieldErrors({});
  };

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next);
  };

  const handleApplyFilters = (next: ItemFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      noRouting: next.onlyWithoutRouting ? '1' : null,
      status: next.latestStatus === '' ? null : next.latestStatus,
      /* 조건이 바뀌면 첫 쪽부터 본다. */
      page: null,
    });
  };

  /** 다른 품목·Rev 로 옮기기 전 저장하지 않은 편집이 있으면 먼저 묻는다 — 옮기면 그 편집은 사라진다. */
  const [pendingMove, setPendingMove] = useState<(() => void) | null>(null);
  /** 화면이 물어 확인받은 이동은 이동 감시(`LeaveGuard`)가 다시 묻지 않게 한다 */
  const confirmedMoveRef = useRef(false);
  const guardMove = (move: () => void) => {
    if (hasUnsavedChanges) setPendingMove(() => move);
    else move();
  };
  /* 이동이 끝나면 되돌린다 — 질의가 그대로인 이동이어도 기록 항목(key)은 바뀐다. */
  const location = useLocation();
  useEffect(() => {
    confirmedMoveRef.current = false;
  }, [location.key]);

  /** 품목을 바꾸면 Rev 선택을 지운다 — 다른 품목의 Rev를 가리키면 안 된다. */
  const handleSelectItem = (itemId: number) => {
    if (itemId === selectedItemId) return;
    guardMove(() => {
      resetHeaderEditing();
      resetOperationEditing();
      resetTransition();
      updateParams({ item: String(itemId), rev: null });
    });
  };

  /** 어느 품목의 Routing인지 값으로 밝힌다. 조건이 좁아져 목록에 없으면 지어내지 않는다. */
  const selectedItem = items.find((item) => item.itemId === selectedItemId) ?? null;
  const itemLabel =
    selectedItem === null ? t.values.empty : `${selectedItem.itemCode} · ${selectedItem.itemName}`;

  /** 공정 id를 사람이 읽는 이름 또는 조회 상태로 옮긴다. */
  const processLabelOf = (processId: string): string =>
    selectableLookupOptions(processOptions, processId).find((option) => option.value === processId)
      ?.label ?? lookupDisplayLabel(processOptions, processId);

  /**
   * 선택지는 「사용 중인 것 + 지금 고른 값」이다.
   * 미사용을 전부 늘어놓으면 고를 수 없는 값이 섞이고, 지금 값을 빼면 창을 여는 순간 값이 사라진 것처럼 보인다.
   */
  const processOptionsFor = (selectedProcessId: string): SelectOption[] =>
    selectableLookupOptions(processOptions, selectedProcessId);

  const [draftState, setDraftState] = useState<OperationDraftState | null>(null);
  const [operationDialog, setOperationDialog] = useState<OperationDialogState | null>(null);
  const [operationDialogErrors, setOperationDialogErrors] = useState<Record<string, string>>({});
  const [isDependencyDialogOpen, setIsDependencyDialogOpen] = useState(false);
  /** 상세 카드에서 직접 고른 탭. null 이면 상황으로 정한다(#231). */
  const [detailTab, setDetailTab] = useState<'settings' | 'history' | null>(null);

  /*
   * 라인은 화면의 로컬 초안 목록으로 다룬다 — 순서 컬럼에 유일 제약이 있어
   * 행 단위 저장이 성립하지 않기 때문이다(공유계약 A-5).
   * 응답 객체가 바뀔 때만 다시 세운다. 매 렌더 파생값으로 두면 편집 중에 캐시가 갱신될 때
   * 사용자가 바꾼 순서가 조용히 사라진다.
   */
  const operationSource = operationList.data ?? null;

  if (operationSource !== null && draftState?.source !== operationSource) {
    const seeded = toOperationDrafts(operationSource.items);
    setDraftState({ source: operationSource, baseline: seeded, drafts: seeded });
  }

  const operationDrafts = draftState?.drafts ?? [];
  const isOperationsDirty =
    draftState !== null && !isSameDrafts(draftState.drafts, draftState.baseline);

  /** 상세를 받기 전에는 편집을 열지 않는다 — 상태를 모르는 채로 여는 것은 잘못 여는 것이다. */
  const detailStatus =
    detail.data === undefined ? null : resolveRoutingStatus(detail.data.routing.statusCode);
  const isOperationsEditable = detailStatus?.isEditable === true;

  const operationsWrite = useMasterWrite<OperationDraft[], RoutingOperationListResponse>({
    request: (drafts, headers) =>
      client.PUT('/planning/routings/{routingId}/operations', {
        params: {
          path: { routingId: selectedRoutingId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { operations: toOperationsPayload(selectedRoutingId ?? 0, drafts) },
      }),
    /*
     * 계약이 이 경로에 If-Match를 요구하지 않는다 — 컬렉션 전체 치환이라 행 단위 낙관적 잠금이 없고 409도 없다.
     * 상세 경로를 주면 토큰을 찾지 못했을 때 요청을 보내지 않고 멈춰 「저장을 눌러도 아무 일이 없다」가 된다.
     */
    etagPath: null,
    /*
     * 라인 저장이 헤더의 판 번호를 올리는지 계약이 밝히지 않는다.
     * 함께 무효화해 두면 어느 쪽이든 안전하고 비용은 조회 한 번이다.
     */
    invalidateKeys: [routingKeys.all],
    /*
     * 어느 행의 오류인지 계약이 알려 주지 않는다(필드명만 온다) — 인라인으로 낼 자리가 없다.
     * 전부 배너로 올린다. 삼키면 어디에도 보이지 않는 오류가 된다.
     */
    knownFields: [],
    onSuccess: (saved) => {
      // 서버가 정본이다. 채번 방식(연번·간격)은 서버 재량이라 보낸 값과 다를 수 있다.
      const reseeded = toOperationDrafts(saved.items);
      setDraftState((prev) =>
        prev === null ? prev : { ...prev, baseline: reseeded, drafts: reseeded },
      );
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  operationsWriteRef.current = operationsWrite.write;

  /** 다른 Rev·품목으로 옮기면 앞의 편집과 실패 표시를 들고 가지 않는다. */
  const resetOperationEditing = () => {
    operationsWrite.reset();
    setOperationDialog(null);
    setOperationDialogErrors({});
    setDraftState(null);
    setIsDependencyDialogOpen(false);
  };

  const changeOperationDrafts = (next: (drafts: OperationDraft[]) => OperationDraft[]) => {
    setDraftState((prev) => (prev === null ? prev : { ...prev, drafts: next(prev.drafts) }));
  };

  const handleAddOperation = () => {
    setOperationDialogErrors({});
    setOperationDialog({ mode: 'create', values: createOperationDraft() });
  };

  const handleEditOperation = (draftId: string) => {
    const target = operationDrafts.find((draft) => draft.draftId === draftId);

    if (target === undefined) return;

    setOperationDialogErrors({});
    setOperationDialog({ mode: 'edit', values: target });
  };

  /*
   * 라인 저장은 목록 전체를 한 번에 보내므로 한 행의 잘못이 전체 저장을 무르게 한다 —
   * 행이 표에 들어오기 전에 여기서 거른다.
   */
  const handleSubmitOperationDialog = () => {
    if (operationDialog === null) return;

    const errors = validateOperationDraft(operationDialog.values);
    setOperationDialogErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const committed = operationDialog.values;
    changeOperationDrafts((drafts) => upsertDraft(drafts, committed));
    setOperationDialog(null);
  };

  const handleSaveOperations = () => {
    if (draftState === null) return;

    operationsWrite.write(draftState.drafts);
  };

  /** 하단 「취소」 — 기본 정보 · 공정 구성의 고친 것을 함께 되돌린다(#231). */
  const handleCancelAll = () => {
    operationsAfterHeaderRef.current = null;
    resetHeaderEditing();
    setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
    operationsWrite.reset();
    setDraftState((prev) => (prev === null ? prev : { ...prev, drafts: prev.baseline }));
  };

  /** 하단 「저장」 — 바뀐 쪽만, 기본 정보 → 공정 구성 순서로(#231). */
  const handleSaveAll = () => {
    const pendingOperations = isOperationsDirty && draftState !== null ? draftState.drafts : null;

    if (isHeaderDirty && formState !== null) {
      const errors = validateRoutingHeader(formState.values);
      setLocalFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;

      operationsWrite.reset();
      operationsAfterHeaderRef.current = pendingOperations;
      headerWrite.write(formState.values);
      return;
    }

    if (pendingOperations !== null) operationsWrite.write(pendingOperations);
  };

  const [transition, setTransition] = useState<RoutingTransitionKind | null>(null);

  /*
   * 상태 전이 두 갈래. 실패 배너가 섞이지 않도록 훅을 나눈다 —
   * 하나로 묶으면 확정 실패 문구가 폐기 창에 남는다.
   */
  const finishTransition = () => {
    setTransition(null);
    toast.show({ variant: 'success', description: messages.common.saved });
  };

  const confirmWrite = useRoutingTransition({
    client,
    routingId: selectedRoutingId,
    path: '/planning/routings/{routingId}:confirm',
    onDone: finishTransition,
  });

  const obsoleteWrite = useRoutingTransition({
    client,
    routingId: selectedRoutingId,
    path: '/planning/routings/{routingId}:obsolete',
    onDone: finishTransition,
  });

  /*
   * 작성중 Rev 취소(#231) — 지우고 나면 그 Rev 를 볼 수 없으니 주소의 `rev` 를 비운다. 그러면 품목의 남은
   * 개정 가운데 볼 것이 자동으로 열리고, 남은 것이 없으면 「Routing 등록」 상태로 돌아간다.
   */
  const discardWrite = useMasterWrite<void, void>({
    request: (_variables, headers) =>
      client.DELETE('/planning/routings/{routingId}', {
        params: {
          path: { routingId: selectedRoutingId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [routingKeys.all],
    knownFields: [],
    onSuccess: () => {
      setTransition(null);
      resetHeaderEditing();
      resetOperationEditing();
      /* 지운 Rev 의 편집은 함께 사라졌다 — 이동 감시가 묻지 않게 한다. */
      confirmedMoveRef.current = true;
      updateParams({ rev: null });
      toast.show({ variant: 'success', description: t.dialog.discardDone });
    },
  });

  /*
   * 복사할 원본은 고른 Rev다. 아무것도 고르지 않았으면 최신 판을 쓴다 —
   * 계약이 목록을 판 번호 내림차순으로 준다고 정했으므로 첫 행이 최신이다.
   * 원본이 확정이 아니면 서버가 400(STATE_LOCKED)으로 거부하고 화면이 그 사유를 배너로 낸다.
   */
  const newRevisionSourceId = selectedRoutingId ?? revisions[0]?.routingId ?? null;

  const newRevisionWrite = useRoutingTransition({
    client,
    routingId: newRevisionSourceId,
    path: '/planning/routings/{routingId}:new-revision',
    onDone: (saved) => {
      /*
       * 201 응답에는 ETag가 없다 — 새 판을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 판을 직접 찾아야 한다.
       */
      confirmedMoveRef.current = true;
      updateParams({ rev: String(saved.routingId) });
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /*
   * 발행이 상태 잠금으로 거절되면(그사이 다른 사람이 폐기 등) 붉은 상자 대신 개정을 다시 읽는다 —
   * 새 상태가 머리의 「Rev · 상태」와 「수정 · 변경 불가」 라벨로 보이고 발행 단추가 사라진다(#231).
   */
  const isNewRevisionStateLocked = newRevisionWrite.error?.kind === 'stateLocked';
  /* 결과 객체는 렌더마다 새로 와서 의존값에 넣으면 거듭 다시 읽는다 — 늘 같은 refetch 함수만 쓴다. */
  const { refetch: refetchDetail } = detail;
  const { refetch: refetchRevisions } = revisionList;
  useEffect(() => {
    if (!isNewRevisionStateLocked) return;
    void refetchDetail();
    void refetchRevisions();
  }, [isNewRevisionStateLocked, refetchDetail, refetchRevisions]);

  /** Rev 비교 · 변경 이력 창(#231). */
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  /** Rev 이력의 「상세 보기」로 연 Rev(#231). null 이면 창이 닫혀 있다. */
  const [detailRevision, setDetailRevision] = useState<Routing | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  /** 「기본 Rev」 확인 창의 대상 개정(#231). null 이면 창이 닫혀 있다. */
  const [defaultTarget, setDefaultTarget] = useState<Routing | null>(null);
  const setDefaultWrite = useRoutingTransition({
    client,
    routingId: defaultTarget?.routingId ?? null,
    path: '/planning/routings/{routingId}:set-default',
    onDone: () => {
      /* 개정 목록 · 품목 목록 「기본 Rev」 열은 같은 열쇠(routingKeys.all)로 다시 받는다. */
      setDefaultTarget(null);
      toast.show({ variant: 'success', description: t.values.setDefaultDone });
    },
  });

  /**
   * 첫 Rev 등록 폼의 값. null이면 폼이 닫혀 있다.
   *
   * 상세 응답이 없는 폼이라 헤더 폼 상태와 섞지 않는다 —
   * 섞으면 「기준값이 서버에서 왔는가」가 흐려지고, 등록 성공 후 어느 쪽을 비울지도 갈린다.
   */
  const [createValues, setCreateValues] = useState<RoutingHeaderFormValues | null>(null);

  /*
   * 품목을 고르면 볼 개정을 바로 연다(사용자 지시 · #231) — 작성중 개정이 있으면 그것, 없으면 가장 최근 확정 개정.
   * 폐기뿐이거나 개정이 없으면 열지 않는다(이력 관리 탭 · 등록 단추가 선다). 주소의 `rev` 만 채우는 것이라
   * 사용자가 그 줄을 누른 것과 같다 — 기록은 늘리지 않는다(replace). 등록 칸이 열려 있으면 건드리지 않는다.
   */
  const autoRevisionId = useMemo(() => {
    if (selectedItemId === null || selectedRoutingId !== null || revisionList.data === undefined) {
      return null;
    }
    const byLatest = [...revisionList.data.items].sort(
      (a, b) => b.routingVersion - a.routingVersion,
    );
    const draft = byLatest.find((row) => {
      const status = resolveRoutingStatus(row.statusCode);
      return status.isRecognized && status.status === 'draft';
    });
    const confirmed = byLatest.find(
      (row) => resolveRoutingStatus(row.statusCode).status === 'confirmed',
    );
    return (draft ?? confirmed)?.routingId ?? null;
  }, [selectedItemId, selectedRoutingId, revisionList.data]);

  useEffect(() => {
    if (autoRevisionId === null || createValues !== null) return;
    const next = new URLSearchParams(searchParams);
    next.set('rev', String(autoRevisionId));
    setSearchParams(next, { replace: true });
  }, [autoRevisionId, createValues, searchParams, setSearchParams]);
  const discardBody = createValues === null ? t.discard.body : t.discard.bodyCreating;
  const hasUnsavedChanges =
    isHeaderDirty ||
    isOperationsDirty ||
    (createValues !== null && !isSameHeaderValues(createValues, emptyHeaderFormValues()));
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  /*
   * 품목·Rev 가 바뀌면 첫 Rev 등록 칸을 닫는다 — 앞 품목에서 친 값이 새 품목 아래 남으면 엉뚱한 품목에
   * Rev 가 생기고, 비우지 않은 칸 때문에 그 뒤 이동마다 다시 묻는다(뒤로가기로 바뀐 경우도 같다).
   */
  useEffect(() => {
    setCreateValues(null);
    setCreateFieldErrors({});
  }, [selectedItemId, selectedRoutingId]);

  const createWrite = useMasterWrite<RoutingHeaderFormValues, Routing>({
    request: (values, headers) =>
      client.POST('/planning/routings', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toRoutingCreate(values, selectedItemId ?? 0),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [routingKeys.all],
    knownFields: ROUTING_HEADER_FORM_FIELDS,
    onSuccess: (saved) => {
      setCreateValues(null);
      setCreateFieldErrors({});
      /* 방금 저장했으니 잃을 편집이 없다 — 이동 감시가 묻지 않게 한다. */
      confirmedMoveRef.current = true;
      updateParams({ rev: String(saved.routingId) });
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  const handleSaveCreate = () => {
    if (createValues === null) return;

    const errors = validateRoutingHeader(createValues);
    setCreateFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    createWrite.write(createValues);
  };

  const closeCreateForm = () => {
    createWrite.reset();
    setCreateValues(null);
    setCreateFieldErrors({});
  };

  const transitionWrite =
    transition === 'obsolete'
      ? obsoleteWrite
      : transition === 'discard'
        ? discardWrite
        : confirmWrite;

  /** 다른 Rev·품목으로 옮기면 열려 있던 확인 창과 실패 표시를 들고 가지 않는다. */
  const resetTransition = () => {
    setTransition(null);
    confirmWrite.reset();
    obsoleteWrite.reset();
    discardWrite.reset();
  };

  /**
   * 확정을 막는 사유. 서버가 최종 판정을 하지만(400 STATE_LOCKED·LINE_REQUIRED),
   * 화면이 먼저 막고 **무엇을 하면 풀리는지** 알린다.
   *
   * 라인 건수는 **서버가 준 목록**으로 센다. 저장하지 않은 초안으로 세면
   * 화면은 「1건 있음」인데 서버는 0건이라 확정이 400으로 거부된다.
   */
  const savedOperationCount = operationList.data?.items.length ?? 0;

  const confirmDisabledReason = ((): string | null => {
    if (detailStatus === null) return t.actionReasons.confirmNeedsDraft;
    if (!detailStatus.isEditable) return t.actionReasons.confirmNeedsDraft;
    // 확정하면 되돌릴 수 없다 — 저장하지 않은 편집은 그 순간 영영 사라진다.
    if (isHeaderDirty || isOperationsDirty) return t.actionReasons.confirmBlockedByUnsaved;
    if (savedOperationCount === 0) return t.actionReasons.confirmNeedsOperations;

    return null;
  })();

  /** 폐기는 확정된 Rev에만 성립한다 — 계약이 그렇게 정했고 상태표도 같다. */
  const obsoleteDisabledReason =
    detailStatus?.status === 'confirmed' ? null : t.actionReasons.obsoleteNeedsConfirmed;

  /*
   * 발행하면 새 판이 선택돼 지금 판을 떠난다 — 저장하지 않은 편집은 그때 사라진다.
   * 원본 판의 상태(확정이어야 한다)는 서버가 판정한다. 상태 코드가 확정되지 않은 지금
   * 화면이 막으면 잘못 막을 수 있고, 그때 사용자가 풀 길이 없다.
   */
  const newRevisionDisabledReason =
    isHeaderDirty || isOperationsDirty ? t.actionReasons.newRevisionBlockedByUnsaved : null;

  /**
   * 라인 저장을 막는 사유. 잠금은 페인이 따로 다루므로 여기서는 잠금 밖의 사유만 고른다.
   *
   * 헤더에 저장하지 않은 변경이 있으면 막는 이유: 라인 저장이 성공하면 상세도 다시 불러오고,
   * 그때 폼이 서버 값으로 다시 세워져 **사용자가 입력한 헤더 값이 조용히 사라진다.**
   * 무효화 자체는 판 번호가 올라가는 경우를 대비해 반드시 필요하므로(계약이 밝히지 않는다),
   * 잃기 전에 먼저 막고 무엇을 하면 풀리는지 알린다.
   */
  const operationsSaveBlockedReason = ((): string | null => {
    if (isHeaderDirty) return t.actionReasons.operationsSaveBlockedByHeader;
    if (hasIncompleteDraft(operationDrafts)) return t.actionReasons.operationsSaveBlockedByInvalid;

    return null;
  })();

  /*
   * 선후행은 저장된 라인을 가리킨다 — 저장 전 라인에는 서버 식별자가 없어 고를 수 없다.
   * 잠긴 Rev 는 읽기 전용으로 열리므로 건수 조건은 편집할 수 있을 때만 따진다.
   */
  const dependenciesBlockedReason = ((): string | null => {
    if (!isOperationsEditable) return null;
    if (isOperationsDirty) return t.actionReasons.dependenciesBlockedByUnsaved;
    if (savedOperationCount < 2) return t.actionReasons.dependenciesNeedOperations;

    return null;
  })();

  /*
   * 선후행이 걸린 공정은 서버가 라인 저장 전체와 함께 거부한다 — 지우기 전에 막는다.
   * 이름은 지금 표의 번호로 보인다. 사용자는 표를 보고 그 공정을 찾는다.
   */
  const removeBlockedReason = (draft: OperationDraft): string | null => {
    const operationId = draft.routingOperationId;
    if (operationId === null) return null;
    /* 관계를 모르는 채 지우게 두면 서버가 라인 저장 전체를 거부한다 — 알 때까지 막는다. */
    if (dependencyList.isPending) return t.actionReasons.removeBlockedWhileCheckingDependencies;
    if (dependencyList.isError) return t.actionReasons.removeBlockedByDependencyLoadError;

    const relations = (dependencyList.data?.items ?? []).filter(
      (item) =>
        item.predecessorOperationId === operationId || item.successorOperationId === operationId,
    );
    if (relations.length === 0) return null;

    const labelOf = (id: number): string => {
      const index = operationDrafts.findIndex((row) => row.routingOperationId === id);
      const row = operationDrafts[index];

      return row === undefined
        ? t.dependencies.unknownOperation
        : t.dependencies.operationOption(index + 1, row.operationName);
    };

    return t.actionReasons.removeBlockedByDependencies(
      relations
        .map(
          (item) =>
            `${labelOf(item.predecessorOperationId)} → ${labelOf(item.successorOperationId)}`,
        )
        .join(', '),
    );
  };

  /* 표시 번호는 표와 같게 목록 안의 위치다. */
  const dependencyOperations = (operationList.data?.items ?? []).map((operation, index) => ({
    routingOperationId: operation.routingOperationId,
    label: t.dependencies.operationOption(index + 1, operation.operationName),
  }));

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 표 위에 낸다.
   * 알리지 않으면 공정 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const processNotice = (() => {
    if (processOptions.isError) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (processOptions.truncated) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  })();

  /* 머리에 이 품목의 PQC 검사 기준을 보인다 — PQC 대상은 공정이 아니라 품목이다(사용자 지시 2026-11-05). */
  const pqcPlan = usePqcPlanForItem(selectedItemId);
  const pqcPlanLabel = (() => {
    if (pqcPlan.data === undefined) return null;
    return pqcPlan.data === null
      ? t.values.pqcPlanNone
      : t.values.pqcPlanItem(pqcPlan.data.code, pqcPlan.data.name);
  })();
  /* 검사 기준 화면으로 옮긴다 — 기준이 있으면 그 기준을, 없으면 이 품목의 PQC 기준 등록 창을 연다(사용자 지시 2026-11-05). */
  const pqcPlanAction = (() => {
    if (pqcPlan.data === undefined || selectedItemId === null) return null;
    if (!toWebAccess(session?.permissions).allows(INSPECTION_STANDARD_PATH)) return null;
    const plan = pqcPlan.data;
    return plan === null
      ? {
          label: t.actions.registerPqcPlan,
          onClick: () =>
            navigate(`${INSPECTION_STANDARD_PATH}?new=PQC&newItem=${String(selectedItemId)}`),
        }
      : {
          label: t.actions.editPqcPlan,
          onClick: () =>
            navigate(`${INSPECTION_STANDARD_PATH}?plan=${String(plan.inspectionPlanId)}&edit=1`),
        };
  })();

  /**
   * 우측 편집 칸. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderHeaderPane = () => {
    /*
     * 첫 Rev 등록 폼. 아직 없는 Rev를 만드는 자리라 상세 조회가 없고 판 번호·상태도 없다 —
     * 서버가 채우는 값을 미리 지어내 보이지 않는다.
     */
    if (createValues !== null) {
      return (
        <HeaderPane
          showSubject={false}
          mode="create"
          itemLabel={itemLabel}
          routingVersion={null}
          pqcPlanLabel={pqcPlanLabel}
          pqcPlanAction={pqcPlanAction}
          status={null}
          values={createValues}
          onChange={(patch) => {
            setCreateValues((prev) => (prev === null ? prev : { ...prev, ...patch }));

            for (const field of Object.keys(patch)) {
              createWrite.clearFieldError(field);
              setCreateFieldErrors((prev) => {
                if (!(field in prev)) return prev;
                const next = { ...prev };
                delete next[field];
                return next;
              });
            }
          }}
          fieldErrors={{ ...createWrite.fieldErrors, ...createFieldErrors }}
          /* 첫 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={createWrite.error} />}
          // 새로 짓는 코드는 잠길 이유가 없다. editability는 이미 있는 자원의 판정이다.
          codeLockReason={null}
          isDirty={!isSameHeaderValues(createValues, emptyHeaderFormValues())}
          isSaving={createWrite.isSaving}
          onSave={handleSaveCreate}
          onCancel={closeCreateForm}
          // 아직 없는 Rev에는 전이할 대상이 없다. 감추지 않고 사유와 함께 비활성으로 둔다.
          confirmDisabledReason={t.actionReasons.transitionNeedsRouting}
          obsoleteDisabledReason={t.actionReasons.transitionNeedsRouting}
          isTransitioning={false}
          onConfirm={() => undefined}
          onObsolete={() => undefined}
        />
      );
    }

    /* 품목 · 개정을 고르기 전은 상세 칸이 안내 상자 하나로 대신한다(#231). */
    if (selectedRoutingId === null) return null;

    if (detail.isError) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />
        </section>
      );
    }

    if (detail.data === undefined || formState === null) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <div role="status" aria-label={t.loading.header}>
            <SkeletonText lines={5} />
          </div>
        </section>
      );
    }

    return (
      <HeaderPane
        showSubject={false}
        showActions={false}
        mode="edit"
        itemLabel={itemLabel}
        routingVersion={detail.data.routing.routingVersion}
        pqcPlanLabel={pqcPlanLabel}
        pqcPlanAction={pqcPlanAction}
        status={resolveRoutingStatus(detail.data.routing.statusCode)}
        values={formState.values}
        onChange={changeHeaderValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...headerWrite.fieldErrors, ...localFieldErrors }}
        banner={<SaveErrorBanner error={headerWrite.error} onReload={handleReloadDetail} />}
        // 판정의 주인은 codeEditable이다. reason은 문구 선택에만 쓴다.
        codeLockReason={codeLockMessage(detail.data.editability)}
        isDirty={isHeaderDirty}
        isSaving={headerWrite.isSaving}
        onSave={handleSaveHeader}
        onCancel={() => {
          resetHeaderEditing();
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        confirmDisabledReason={confirmDisabledReason}
        obsoleteDisabledReason={obsoleteDisabledReason}
        isTransitioning={confirmWrite.isSaving || obsoleteWrite.isSaving}
        onConfirm={() => {
          confirmWrite.reset();
          setTransition('confirm');
        }}
        onObsolete={() => {
          obsoleteWrite.reset();
          setTransition('obsolete');
        }}
      />
    );
  };

  /*
   * 상세 카드 탭(#231). 직접 고르기 전에는 지금 상황으로 정한다 — 작성중 · 최근 확정 개정이 자동으로 열리므로
   * 대개 설정이고, 열 개정이 없을 때(폐기뿐)만 개정을 고를 이력 관리. 개정이 없으면 「Routing 등록」이 설정 탭 머리에 있다. 품목 · 개정을 새로 고르면 다시 이 규칙으로 돌아간다.
   */
  const hasNoRevisions = revisionList.data !== undefined && revisions.length === 0;
  /* 이력 관리는 「목록을 받았고, 열 개정이 없고(폐기뿐), 아무것도 열려 있지 않을」 때만 — 받는 중에 탭이 뛰지 않게. */
  const showHistoryFirst =
    revisionList.isError ||
    (revisionList.data !== undefined &&
      revisions.length > 0 &&
      autoRevisionId === null &&
      selectedRoutingId === null &&
      createValues === null);
  const activeDetailTab: 'settings' | 'history' =
    detailTab ?? (showHistoryFirst ? 'history' : 'settings');

  const handleNewRevision = () => {
    newRevisionWrite.write();
  };
  const handleOpenCreate = () => {
    resetHeaderEditing();
    setCreateFieldErrors({});
    setCreateValues(emptyHeaderFormValues());
    setDetailTab(null);
  };

  /** 설정 탭 — 「기본 정보」 · 「공정 구성」(공정 라인). 각 칸의 동작은 종전 그대로다. */
  const isViewingDraft =
    selectedRoutingId !== null &&
    detailStatus?.isRecognized === true &&
    detailStatus.status === 'draft';
  /* 폐기된 개정에서는 신규 Rev 를 발행할 수 없다 — 서버가 확정 개정에서만 받는다(사용자 지시 · #231). */
  const isViewingObsolete = selectedRoutingId !== null && detailStatus?.status === 'obsolete';

  const renderSettingsTab = () => {
    const isRevisionOpen = createValues !== null || selectedRoutingId !== null;
    return (
      <div className="routing-card-body">
        {/*
         * 「기본 정보」 상자 · 제목은 두지 않는다 — 칸이 Routing 코드 하나뿐이다(사용자 지시 · #231).
         * 신규 Rev 발행 · Routing 등록은 카드 머리 오른쪽에 있다.
         */}
        {/*
         * 발행에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다.
         * 상태 잠금(폐기 개정에서 발행 등)은 붉은 상자 대신 머리의 「수정 · 변경 불가」 라벨이 말한다(사용자 지시 · #231).
         */}
        {!isNewRevisionStateLocked && <SaveErrorBanner error={newRevisionWrite.error} />}
        {isRevisionOpen ? (
          renderHeaderPane()
        ) : (
          <div className="routing-detail-empty">
            <EmptyState
              size="sm"
              icon={<PaneEmptyIcon name="layers" />}
              title={hasNoRevisions ? t.empty.revisionNoneTitle : t.empty.revisionNotSelected}
              {...(hasNoRevisions ? { description: t.empty.revisionNoneDescription } : {})}
            />
          </div>
        )}

        {isRevisionOpen && (
          <div className="routing-card-section routing-operations-section">
            <OperationsPane
              title={
                <>
                  {t.card.operationsTitle}
                  <span className="routing-card-count">
                    {t.card.operationsCount(operationDrafts.length)}
                  </span>
                </>
              }
              drafts={operationDrafts}
              processLabel={processLabelOf}
              isLoading={operationList.isPending}
              isRevisionSelected={selectedRoutingId !== null}
              loadError={
                operationList.isError ? (
                  <LoadErrorBanner
                    error={operationList.error}
                    onRetry={() => void operationList.refetch()}
                  />
                ) : null
              }
              optionsNotice={processNotice}
              isEditable={isOperationsEditable}
              lockReason={t.actionReasons.operationsLocked}
              isDirty={isOperationsDirty}
              isSaving={operationsWrite.isSaving}
              saveBlockedReason={operationsSaveBlockedReason}
              dependenciesBlockedReason={dependenciesBlockedReason}
              removeBlockedReason={removeBlockedReason}
              /* 라인 저장에는 409가 없다(계약 실측) — 「최신 불러오기」를 낼 자리가 아니라 onReload를 넘기지 않는다. */
              banner={<SaveErrorBanner error={operationsWrite.error} />}
              onAdd={handleAddOperation}
              onEdit={handleEditOperation}
              onRemove={(draftId) => {
                changeOperationDrafts((drafts) => removeDraft(drafts, draftId));
              }}
              /* 순서 이동은 초안만 바꾼다. 여기서 서버를 부르지 않는다(공유계약 A-5). */
              onReorder={(from, to) => {
                changeOperationDrafts((drafts) => moveDraft(drafts, from, to));
              }}
              onSave={handleSaveOperations}
              /* 취소 · 저장은 설정 탭 맨 아래 한 줄로 모은다(#231). */
              showSaveActions={false}
              onOpenDependencies={() => setIsDependencyDialogOpen(true)}
              onCancel={() => {
                operationsWrite.reset();
                setDraftState((prev) =>
                  prev === null ? prev : { ...prev, drafts: prev.baseline },
                );
              }}
            />
          </div>
        )}

        {/*
         * 취소 · 저장 · 확정 · 폐기는 설정 탭 맨 아래 한 줄(사용자 지시 · #231). 저장은 기본 정보 · 공정 구성 중 바뀐 쪽을 함께 저장한다.
         * 첫 등록은 기본 정보 칸에 「Routing 등록」 줄이 그대로 있다.
         */}
        {createValues === null &&
          selectedRoutingId !== null &&
          detail.data !== undefined &&
          formState !== null && (
            <section className="routing-card-actions" aria-label={t.card.actionsLabel}>
              <RoutingActions
                mode="edit"
                routingVersion={detail.data.routing.routingVersion}
                status={detailStatus}
                isDirty={isHeaderDirty || isOperationsDirty}
                isSaving={headerWrite.isSaving || operationsWrite.isSaving}
                saveBlockedReason={
                  isOperationsDirty && hasIncompleteDraft(operationDrafts)
                    ? t.actionReasons.operationsSaveBlockedByInvalid
                    : null
                }
                onSave={handleSaveAll}
                onCancel={handleCancelAll}
                onCompare={() => setIsCompareOpen(true)}
                onHistory={() => setIsHistoryOpen(true)}
                confirmDisabledReason={confirmDisabledReason}
                obsoleteDisabledReason={obsoleteDisabledReason}
                isTransitioning={
                  confirmWrite.isSaving || obsoleteWrite.isSaving || discardWrite.isSaving
                }
                onConfirm={() => {
                  confirmWrite.reset();
                  setTransition('confirm');
                }}
                onObsolete={() => {
                  obsoleteWrite.reset();
                  setTransition('obsolete');
                }}
                onDiscard={() => {
                  discardWrite.reset();
                  setTransition('discard');
                }}
              />
            </section>
          )}
      </div>
    );
  };

  return (
    <>
      <LeaveGuard
        when={hasUnsavedChanges}
        watchedParams={EDIT_TARGET_PARAMS}
        bypassRef={confirmedMoveRef}
        discardBody={discardBody}
      />
      {pendingMove !== null && (
        <DiscardDialog
          body={discardBody}
          onStay={() => setPendingMove(null)}
          onLeave={() => {
            const move = pendingMove;
            setPendingMove(null);
            confirmedMoveRef.current = true;
            move();
          }}
        />
      )}
      {/* 진행 상태 칩은 탭 줄에서 배치 단추 왼쪽 — 먼저 그려야 같은 자리에서 앞에 선다(사용자 지시 · #231). */}
      <ItemStatusChips appliedFilters={filters} onApplyFilters={handleApplyFilters} />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />

      {/* 조회 조건 — 검사 조회·판정처럼 목록과 다른 상자에 둔다(#231). */}
      <section
        ref={aboveRef}
        className="pane inspection-standard-search routing-search"
        role="search"
      >
        <ItemFilterBar appliedFilters={filters} onApplyFilters={handleApplyFilters} />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split routing-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <ItemPane
          items={items}
          isLoading={itemList.isPending}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          selectedItemId={selectedItemId}
          onSelect={(itemId) => {
            setDetailTab(null);
            handleSelectItem(itemId);
          }}
          revisionSummaryOf={(itemId) => revisionSummaries.get(itemId)}
          pageMeta={itemList.data?.page ?? { ...itemPaging, total: 0 }}
          onChangePage={(page) => updateParams({ page: page === 1 ? null : String(page) })}
          onChangePageSize={(size) =>
            updateParams({ page: null, size: size === 20 ? null : String(size) })
          }
          loadError={
            itemList.isError ? (
              <LoadErrorBanner error={itemList.error} onRetry={() => void itemList.refetch()} />
            ) : null
          }
        />

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        {/*
         * 상세 — 사용자 시안(#231): 「공정 경로」 카드 하나에 머리(품목 · Rev · 상태) · 설정 / 이력 관리 탭.
         * 설정 = 기본 정보 + 공정 구성, 이력 관리 = 개정 목록. 저장 · 확정 · 폐기 · 발행 · 라인 편집 동작은 종전 그대로다.
         */}
        <div className="inspection-standard-detail routing-detail">
          {selectedItemId === null ? (
            <section className="pane routing-detail-empty" aria-label={t.panes.header}>
              <EmptyState
                size="sm"
                icon={<PaneEmptyIcon name="layers" />}
                title={t.empty.itemNotSelected}
              />
            </section>
          ) : (
            <section className="pane routing-detail-card" aria-label={t.card.title}>
              <div className="routing-card-head">
                <h2 className="pane-title routing-card-title">{t.card.title}</h2>
                <div className="routing-card-section-tools">
                  {/* 지금 보는 개정 — 「Rev · 상태」 칩은 카드 머리 오른쪽(사용자 시안 · #231). */}
                  {selectedRoutingId !== null &&
                    detail.data !== undefined &&
                    detailStatus !== null && (
                      <Chip variant="status" status={detailStatus.tone}>
                        {t.card.revisionChip(
                          t.values.revision(detail.data.routing.routingVersion),
                          detailStatus.label,
                        )}
                      </Chip>
                    )}
                  {/* 폐기 개정은 고칠 수도 발행할 수도 없다 — 안내 상자 대신 라벨 하나(사용자 지시 · #231). */}
                  {isViewingObsolete && (
                    <Chip variant="status" status="idle">
                      {t.values.lockedBadge}
                    </Chip>
                  )}
                  {/*
                   * 신규 Rev 발행(개정이 없으면 Routing 등록)은 카드 머리 오른쪽의 주요 작업(사용자 지시 · #231).
                   * 작성중 · 폐기 개정을 보고 있으면 세우지 않는다 — 서버가 확정 개정에서만 발행을 받는다.
                   */}
                  {!isViewingDraft && !isViewingObsolete && (
                    <RevisionActions
                      hasRevisions={revisions.length > 0}
                      newRevisionDisabledReason={newRevisionDisabledReason}
                      isCreating={createValues !== null}
                      isPublishing={newRevisionWrite.isSaving}
                      onNewRevision={handleNewRevision}
                      onCreateRouting={handleOpenCreate}
                    />
                  )}
                </div>
              </div>

              <Tabs
                aria-label={t.card.tabsLabel}
                value={activeDetailTab}
                onChange={(value) => setDetailTab(value === 'history' ? 'history' : 'settings')}
                items={[
                  {
                    value: 'settings',
                    label: t.card.settingsTab,
                    content: activeDetailTab === 'settings' ? renderSettingsTab() : null,
                  },
                  {
                    value: 'history',
                    label: t.card.historyTab,
                    content:
                      activeDetailTab === 'history' ? (
                        <RevisionPane
                          revisions={revisions}
                          isLoading={revisionList.isPending}
                          isItemSelected={selectedItemId !== null}
                          selectedRoutingId={selectedRoutingId}
                          /* 상세 보기는 창으로 연다 — 설정 탭으로 넘어가지 않는다(사용자 지시 · #231). */
                          onViewDetail={setDetailRevision}
                          loadError={
                            revisionList.isError ? (
                              <LoadErrorBanner
                                error={revisionList.error}
                                onRetry={() => void revisionList.refetch()}
                              />
                            ) : null
                          }
                          newRevisionDisabledReason={newRevisionDisabledReason}
                          isCreating={createValues !== null}
                          isPublishing={newRevisionWrite.isSaving}
                          onNewRevision={handleNewRevision}
                          onCreateRouting={handleOpenCreate}
                          /* 발행 · 첫 등록 단추와 그 실패 표시는 설정 탭 머리에 있다. */
                          banner={null}
                          showActions={false}
                          onSetDefault={(row) => {
                            setDefaultWrite.reset();
                            setDefaultTarget(row);
                          }}
                        />
                      ) : null,
                  },
                ]}
              />
            </section>
          )}
        </div>
      </div>

      {/* 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 편집 값이 그대로 살아 있다. */}
      {operationDialog !== null && (
        <OperationFormDialog
          open
          mode={operationDialog.mode}
          values={operationDialog.values}
          onChange={(patch) => {
            setOperationDialog((prev) =>
              prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
            );

            for (const field of Object.keys(patch)) {
              setOperationDialogErrors((prev) => {
                if (!(field in prev)) return prev;
                const next = { ...prev };
                delete next[field];
                return next;
              });
            }
          }}
          fieldErrors={operationDialogErrors}
          processOptions={processOptionsFor(operationDialog.values.processId)}
          isSubmitting={false}
          onClose={() => {
            setOperationDialog(null);
            setOperationDialogErrors({});
          }}
          onSubmit={handleSubmitOperationDialog}
        />
      )}

      {isDependencyDialogOpen && selectedRoutingId !== null && detail.data !== undefined && (
        <DependencyDialog
          routingId={selectedRoutingId}
          revisionLabel={t.values.revision(detail.data.routing.routingVersion)}
          itemCode={selectedItem?.itemCode ?? t.values.empty}
          operations={dependencyOperations}
          isEditable={isOperationsEditable}
          renderLoadError={(error, onRetry) => <LoadErrorBanner error={error} onRetry={onRetry} />}
          onClose={() => setIsDependencyDialogOpen(false)}
        />
      )}

      {detailRevision !== null && (
        <RevisionDetailDialog
          revision={detailRevision}
          itemCode={selectedItem?.itemCode ?? t.values.empty}
          itemName={selectedItem?.itemName ?? t.values.empty}
          processLabel={processLabelOf}
          renderLoadError={(error, onRetry) => <LoadErrorBanner error={error} onRetry={onRetry} />}
          onClose={() => setDetailRevision(null)}
        />
      )}

      {isCompareOpen &&
        selectedRoutingId !== null &&
        detail.data !== undefined &&
        (() => {
          /* 기준은 지금 Rev 바로 앞 판, 비교는 지금 Rev(#231). */
          const current = detail.data.routing.routingVersion;
          const previous = [...revisions]
            .filter((row) => row.routingVersion < current)
            .sort((a, b) => b.routingVersion - a.routingVersion)[0];
          if (previous === undefined) return null;
          return (
            <RevisionCompareDialog
              revisions={revisions}
              initialBaseId={previous.routingId}
              initialTargetId={selectedRoutingId}
              processLabel={processLabelOf}
              renderLoadError={(error, onRetry) => (
                <LoadErrorBanner error={error} onRetry={onRetry} />
              )}
              onClose={() => setIsCompareOpen(false)}
            />
          );
        })()}

      {isHistoryOpen && selectedRoutingId !== null && detail.data !== undefined && (
        <RevisionHistoryDialog
          routingId={selectedRoutingId}
          processLabel={processLabelOf}
          renderLoadError={(error, onRetry) => <LoadErrorBanner error={error} onRetry={onRetry} />}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {defaultTarget !== null && (
        <SetDefaultDialog
          revisionLabel={t.values.revision(defaultTarget.routingVersion)}
          isSaving={setDefaultWrite.isSaving}
          banner={<SaveErrorBanner error={setDefaultWrite.error} />}
          onClose={() => setDefaultTarget(null)}
          onConfirm={() => setDefaultWrite.write()}
        />
      )}

      {/*
       * 되돌릴 수 없는 전이라 확인을 한 단계 둔다. 실패해도 창을 닫지 않는다 —
       * 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
       */}
      {transition !== null && (
        <TransitionConfirmDialog
          open
          kind={transition}
          revisionLabel={
            detail.data === undefined ? '' : t.values.revision(detail.data.routing.routingVersion)
          }
          onClose={resetTransition}
          onConfirm={() => {
            transitionWrite.write();
          }}
          isSaving={transitionWrite.isSaving}
          /* 전이에는 409가 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={transitionWrite.error} />}
        />
      )}
    </>
  );
};

type RoutingTab = 'routing' | 'processes';

interface RoutingScreenProps {
  /** 보일 탭. 주소가 정한다 — 공정 경로는 `/master-data/routing`, 공정 관리는 `/master-data/processes`. */
  tab?: RoutingTab;
}

/**
 * W-06-01은 축이 다른 두 업무(공정 경로 · 공정 관리)를 탭으로 가른다. 탭은 셸 탭 막대(주소)로 고른다 —
 * 화면 안 탭 줄은 두지 않는다(#231 · 품질 코드 관리와 같다). 비활성 탭은 요청도 렌더도 하지 않는다.
 */
export const RoutingScreen = ({ tab }: RoutingScreenProps) => {
  const hub = usePageHub();
  const [searchParams] = useSearchParams();

  /* 종전 주소 `?tab=processes` 는 새 주소로 옮긴다 — 북마크·다른 화면 연결이 산다. */
  if (tab === undefined && searchParams.get('tab') === 'processes') {
    return <Navigate replace to="/master-data/processes" />;
  }

  const activeTab: RoutingTab = tab ?? 'routing';

  return (
    <>
      {/* 탭 묶음 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(#231). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}
      {activeTab === 'processes' ? <ProcessMasterPane /> : <RoutingWorkspace />}
    </>
  );
};
