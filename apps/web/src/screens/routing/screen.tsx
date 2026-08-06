import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { HeaderPane } from './header-pane';
import { ROUTING_HEADER_FORM_FIELDS, validateRoutingHeader } from './header-validation';
import { ItemPane } from './item-pane';
import { isSameHeaderValues, routingToFormValues, toRoutingUpdate } from './mappers';
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
import {
  isTruncated,
  routingDetailPath,
  routingKeys,
  useItemList,
  useProcessOptions,
  useRoutingDetail,
  useRoutingList,
  useRoutingOperations,
  type RoutingOperationListResponse,
} from './queries';
import { RevisionPane } from './revision-pane';
import { resolveRoutingStatus } from './routing-status';
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
export const RoutingScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const filters = useMemo<ItemFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      onlyWithoutRouting: searchParams.get('noRouting') === '1',
    }),
    [searchParams],
  );

  const selectedItemId = Number(searchParams.get('item') ?? '') || null;
  const selectedRoutingId = Number(searchParams.get('rev') ?? '') || null;

  const itemList = useItemList(filters);
  const items = itemList.data?.items ?? [];

  const revisionList = useRoutingList(selectedItemId);
  const revisions = revisionList.data?.items ?? [];

  const detail = useRoutingDetail(selectedRoutingId);
  const operationList = useRoutingOperations(selectedRoutingId);
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
    });
  };

  /** 품목을 바꾸면 Rev 선택을 지운다 — 다른 품목의 Rev를 가리키면 안 된다. */
  const handleSelectItem = (itemId: number) => {
    resetHeaderEditing();
    resetOperationEditing();
    updateParams({ item: String(itemId), rev: null });
  };

  const handleSelectRevision = (routingId: number) => {
    resetHeaderEditing();
    resetOperationEditing();
    updateParams({ rev: String(routingId) });
  };

  const itemPage = itemList.data?.page;
  const isItemListTruncated = itemPage !== undefined && isTruncated(itemPage, items.length);

  /** 어느 품목의 Routing인지 값으로 밝힌다. 조건이 좁아져 목록에 없으면 지어내지 않는다. */
  const selectedItem = items.find((item) => item.itemId === selectedItemId) ?? null;
  const itemLabel =
    selectedItem === null ? t.values.empty : `${selectedItem.itemCode} · ${selectedItem.itemName}`;

  /**
   * 공정 id를 사람이 읽는 이름으로 옮긴다.
   * 목록에 없는 값은 코드를 그대로 낸다 — 빼 버리면 값이 사라진 것처럼 보인다.
   */
  const processLabelOf = (processId: string): string => {
    const entry = processOptions.entries.find((item) => item.value === processId);

    if (entry === undefined) return processId;

    return entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`;
  };

  /**
   * 선택지는 「사용 중인 것 + 지금 고른 값」이다.
   * 미사용을 전부 늘어놓으면 고를 수 없는 값이 섞이고, 지금 값을 빼면 창을 여는 순간 값이 사라진 것처럼 보인다.
   */
  const processOptionsFor = (selectedProcessId: string): SelectOption[] => {
    const options = processOptions.entries
      .filter((entry) => entry.isActive || entry.value === selectedProcessId)
      .map((entry) => ({ value: entry.value, label: processLabelOf(entry.value) }));

    // 선택 목록이 잘리거나 실패해도 지금 값을 지우지 않는다 — 지우면 저장 때 조용히 다른 값이 된다.
    if (selectedProcessId !== '' && !options.some((option) => option.value === selectedProcessId)) {
      return [{ value: selectedProcessId, label: selectedProcessId }, ...options];
    }

    return options;
  };

  const [draftState, setDraftState] = useState<OperationDraftState | null>(null);
  const [operationDialog, setOperationDialog] = useState<OperationDialogState | null>(null);
  const [operationDialogErrors, setOperationDialogErrors] = useState<Record<string, string>>({});

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

  /** 다른 Rev·품목으로 옮기면 앞의 편집과 실패 표시를 들고 가지 않는다. */
  const resetOperationEditing = () => {
    operationsWrite.reset();
    setOperationDialog(null);
    setOperationDialogErrors({});
    setDraftState(null);
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

  /**
   * 우측 편집 칸. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderHeaderPane = () => {
    if (selectedItemId === null) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <EmptyState size="sm" title={t.empty.itemNotSelected} />
        </section>
      );
    }

    if (selectedRoutingId === null) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <EmptyState size="sm" title={t.empty.revisionNotSelected} />
        </section>
      );
    }

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
        itemLabel={itemLabel}
        routingVersion={detail.data.routing.routingVersion}
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
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/*
       * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
       * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
       */}
      {isItemListTruncated && itemPage !== undefined && (
        <AlertBanner variant="warning">{t.listTruncated(items.length, itemPage.total)}</AlertBanner>
      )}

      <div className="three-pane">
        <ItemPane
          items={items}
          isLoading={itemList.isPending}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          selectedItemId={selectedItemId}
          onSelect={handleSelectItem}
          loadError={
            itemList.isError ? (
              <LoadErrorBanner error={itemList.error} onRetry={() => void itemList.refetch()} />
            ) : null
          }
        />

        <RevisionPane
          revisions={revisions}
          isLoading={revisionList.isPending}
          isItemSelected={selectedItemId !== null}
          selectedRoutingId={selectedRoutingId}
          onSelect={handleSelectRevision}
          loadError={
            revisionList.isError ? (
              <LoadErrorBanner
                error={revisionList.error}
                onRetry={() => void revisionList.refetch()}
              />
            ) : null
          }
        />

        <div className="pane-stack">
          {renderHeaderPane()}

          <OperationsPane
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
            onCancel={() => {
              operationsWrite.reset();
              setDraftState((prev) => (prev === null ? prev : { ...prev, drafts: prev.baseline }));
            }}
          />
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
    </>
  );
};
