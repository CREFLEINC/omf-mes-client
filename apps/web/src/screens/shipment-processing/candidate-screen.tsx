import { AlertBanner, Button, EmptyState, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useReducer, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import {
  isCandidateVisible,
  shipmentGateBlockers,
  type ShipmentGateBlocker,
} from './candidate-gate';
import { ShipmentProcessingCandidateListPane } from './candidate-list-pane';
import {
  createShipmentProcessingCandidateScreenState,
  reduceShipmentProcessingCandidateScreen,
  toShipmentProcessingCandidateFilters,
  type ShipmentProcessingCandidateSnapshot,
} from './candidate-screen-model';
import { ShipmentProcessingFilterBar } from './filter-bar';
import {
  createLineAllocationDrafts,
  lineAllocationIssues,
  addAllocation,
  removeAllocation,
  setAllocationLot,
  setAllocationQty,
  setShippedQty,
  type LineAllocationDraft,
} from './line-allocation-draft';
import {
  EMPTY_LOADING_INFO_DRAFT,
  LoadingInfoPane,
  resolveWarehouse,
  resolvedWarehouseId,
  toWarehouseOptions,
  useActiveWarehouses,
  type LoadingInfoDraft,
} from './loading-info-pane';
import { lookupLabel, usePartnerLookup, useWorkerLookup } from './lookups';
import { useLotCandidatesByItem } from './lot-candidates';
import { toPageView } from './pagination';
import { useShipmentRequestCandidates, useShipmentRequestDetail } from './queries';
import { useShipmentProcessingMutation } from './mutations';
import { OutcomePane } from './outcome-pane';
import { ShipmentLinesPane } from './shipment-lines-pane';
import { withOccurrence, type ShipmentCreate } from './occurrence';
import { toShipmentCreatePayload } from './shipment-request-payload';
import { SubmitConfirmDialog } from './submit-confirm-dialog';
import type { ShipmentRequestCandidate } from './types';

const t = messages.shipmentProcessing;

/** 후보 목록 조회 스냅샷 — `CLEAR_MISSING_SELECTION`이 선택이 결과에 남아 있는지 판정한다. */
export const toShipmentProcessingCandidateSnapshot = (source: {
  enabled: boolean;
  isFetching: boolean;
  isError: boolean;
  candidateIds: readonly number[] | undefined;
}): ShipmentProcessingCandidateSnapshot => {
  if (!source.enabled) return { kind: 'ABSENT' };
  if (source.isFetching) return { kind: 'PENDING' };
  if (source.isError) return { kind: 'FAILED' };
  if (source.candidateIds === undefined) return { kind: 'ABSENT' };
  return { kind: 'SETTLED', candidateIds: source.candidateIds };
};

export type ShipmentDetailScreenState =
  | { kind: 'NOT_SELECTED' }
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE' }
  | { kind: 'RESOLVED'; detail: ShipmentRequestCandidate };

export const toShipmentDetailScreenState = (source: {
  selectedShipmentRequestId: number | null;
  isFetching: boolean;
  isError: boolean;
  detail: ShipmentRequestCandidate | undefined;
}): ShipmentDetailScreenState => {
  if (source.selectedShipmentRequestId === null) return { kind: 'NOT_SELECTED' };
  if (source.isFetching) return { kind: 'CHECKING' };
  if (source.isError || source.detail === undefined) return { kind: 'UNAVAILABLE' };
  return { kind: 'RESOLVED', detail: source.detail };
};

export type ShipmentSubmitBlocker =
  ShipmentGateBlocker | 'ALLOCATION_UNBALANCED' | 'WAREHOUSE_UNRESOLVED';

export interface SubmitBlockersInput {
  gateBlockers: readonly ShipmentGateBlocker[];
  lineDrafts: readonly LineAllocationDraft[];
  warehouseId: number | null;
}

/** 관문 3종(계획서) — 피킹완료·검사완료(`candidate-gate.ts`) + LOT 배분 합계(`line-allocation-draft.ts`) + 창고 확정. */
export const toSubmitBlockers = ({
  gateBlockers,
  lineDrafts,
  warehouseId,
}: SubmitBlockersInput): ShipmentSubmitBlocker[] => {
  const blockers: ShipmentSubmitBlocker[] = [...gateBlockers];

  if (lineDrafts.length === 0 || lineDrafts.some((line) => lineAllocationIssues(line).length > 0)) {
    blockers.push('ALLOCATION_UNBALANCED');
  }
  if (warehouseId === null) blockers.push('WAREHOUSE_UNRESOLVED');

  return blockers;
};

interface OwnedLineDrafts {
  shipmentRequestId: number | null;
  drafts: LineAllocationDraft[];
}

interface OwnedLoadingInfo {
  shipmentRequestId: number | null;
  draft: LoadingInfoDraft;
}

const toSelectedLineDrafts = (
  owned: OwnedLineDrafts,
  selectedId: number | null,
): LineAllocationDraft[] => (owned.shipmentRequestId === selectedId ? owned.drafts : []);

const toSelectedLoadingInfo = (
  owned: OwnedLoadingInfo,
  selectedId: number | null,
): LoadingInfoDraft =>
  owned.shipmentRequestId === selectedId ? owned.draft : EMPTY_LOADING_INFO_DRAFT;

export const ShipmentProcessingCandidateScreen = () => {
  const toast = useToast();
  const [state, dispatch] = useReducer(
    reduceShipmentProcessingCandidateScreen,
    undefined,
    createShipmentProcessingCandidateScreenState,
  );

  const filters = toShipmentProcessingCandidateFilters(state);
  const candidateQuery = useShipmentRequestCandidates(filters);
  const allCandidates = candidateQuery.data?.items ?? [];
  const visibleCandidates = allCandidates.filter((candidate) =>
    isCandidateVisible(candidate, state.appliedFilters.pickingCompleteOnly),
  );

  const snapshot = toShipmentProcessingCandidateSnapshot({
    enabled: filters.shipDateFrom !== null,
    isFetching: candidateQuery.isFetching,
    isError: candidateQuery.isError,
    candidateIds: candidateQuery.data?.items.map((item) => item.shipmentRequestId),
  });
  useEffect(() => {
    dispatch({ type: 'CLEAR_MISSING_SELECTION', snapshot });
  }, [snapshot]);

  const partnerLookup = usePartnerLookup();
  const workerLookup = useWorkerLookup();
  const warehouseQuery = useActiveWarehouses();
  const warehouseOptions =
    warehouseQuery.data === undefined ? undefined : toWarehouseOptions(warehouseQuery.data.items);
  const warehouseResolution = resolveWarehouse(
    warehouseOptions,
    warehouseQuery.isPending,
    warehouseQuery.isError,
  );

  const detailQuery = useShipmentRequestDetail(state.selectedShipmentRequestId);
  const detailState = toShipmentDetailScreenState({
    selectedShipmentRequestId: state.selectedShipmentRequestId,
    isFetching: detailQuery.isFetching,
    isError: detailQuery.isError,
    detail: detailQuery.data,
  });

  const [ownedLineDrafts, setOwnedLineDrafts] = useState<OwnedLineDrafts>({
    shipmentRequestId: null,
    drafts: [],
  });
  const [ownedLoadingInfo, setOwnedLoadingInfo] = useState<OwnedLoadingInfo>({
    shipmentRequestId: null,
    draft: { ...EMPTY_LOADING_INFO_DRAFT },
  });

  // 선택이 바뀌면 이전 지시서의 초안을 들고 있지 않는다 — 되돌릴 수 없는 쓰기라 잘못 섞이면 안 된다.
  useEffect(() => {
    setOwnedLineDrafts({ shipmentRequestId: state.selectedShipmentRequestId, drafts: [] });
    setOwnedLoadingInfo({
      shipmentRequestId: state.selectedShipmentRequestId,
      draft: { ...EMPTY_LOADING_INFO_DRAFT },
    });
  }, [state.selectedShipmentRequestId]);

  // 상세가 도착하면 라인마다 빈 초안을 세운다. 이미 세워져 있으면(사용자가 입력 중) 덮지 않는다.
  useEffect(() => {
    if (detailState.kind !== 'RESOLVED') return;
    if (detailState.detail.shipmentRequestId !== state.selectedShipmentRequestId) return;
    setOwnedLineDrafts((current) => {
      if (
        current.shipmentRequestId === detailState.detail.shipmentRequestId &&
        current.drafts.length > 0
      ) {
        return current;
      }
      return {
        shipmentRequestId: detailState.detail.shipmentRequestId,
        drafts: createLineAllocationDrafts(detailState.detail.lines ?? []),
      };
    });
  }, [detailState, state.selectedShipmentRequestId]);

  const lineDrafts = toSelectedLineDrafts(ownedLineDrafts, state.selectedShipmentRequestId);
  const loadingInfo = toSelectedLoadingInfo(ownedLoadingInfo, state.selectedShipmentRequestId);
  const itemIds = [...new Set(lineDrafts.map((line) => line.itemId))];
  const lotCandidates = useLotCandidatesByItem(itemIds);

  const updateLineDrafts = (
    update: (drafts: LineAllocationDraft[]) => LineAllocationDraft[],
  ): void => {
    setOwnedLineDrafts((current) => ({
      shipmentRequestId: state.selectedShipmentRequestId,
      drafts: update(toSelectedLineDrafts(current, state.selectedShipmentRequestId)),
    }));
  };
  const updateLine = (
    shipmentRequestLineId: number,
    update: (line: LineAllocationDraft) => LineAllocationDraft,
  ): void => {
    updateLineDrafts((drafts) =>
      drafts.map((line) =>
        line.shipmentRequestLineId === shipmentRequestLineId ? update(line) : line,
      ),
    );
  };

  const warehouseId = resolvedWarehouseId(warehouseResolution, loadingInfo.warehouseId);
  const gateBlockers =
    detailState.kind === 'RESOLVED' ? shipmentGateBlockers(detailState.detail) : [];
  const submitBlockers = toSubmitBlockers({ gateBlockers, lineDrafts, warehouseId });
  const payload =
    detailState.kind === 'RESOLVED'
      ? toShipmentCreatePayload({
          shipmentRequestId: detailState.detail.shipmentRequestId,
          warehouseId,
          loadingInfo,
          lineDrafts,
        })
      : null;
  const canSubmit =
    detailState.kind === 'RESOLVED' && submitBlockers.length === 0 && payload !== null;

  const [confirmation, setConfirmation] = useState<{
    shipmentRequestNo: string;
    /** **시각까지 찍힌 완성본**이다 — 재전송에서 같은 값이어야 멱등 키가 갈리지 않는다. */
    payload: ShipmentCreate;
  } | null>(null);
  const write = useShipmentProcessingMutation({
    onSuccess: () => {
      setConfirmation(null);
      dispatch({ type: 'CLEAR_SELECTION' });
      toast.show({ variant: 'success', description: t.processedToast });
      void candidateQuery.refetch();
    },
  });
  const closeConfirm = (): void => {
    setConfirmation(null);
    write.reset();
  };
  /*
   * 충돌(409)만 재조회로 풀린다(`SaveErrorBanner`의 규칙) — 다른 사용자·외부 동기화·워커가
   * 먼저 처리해 이 초안이 낡았다는 뜻이므로, 선택을 비우고 후보 목록을 다시 받는다.
   * 비운 상세로 그대로 이어가면 이미 처리됐을 수도 있는 지시서에 다시 쓰기를 시도하게 된다.
   */
  const reloadAfterConflict = (): void => {
    closeConfirm();
    dispatch({ type: 'CLEAR_SELECTION' });
    void candidateQuery.refetch();
  };

  const page = toPageView(
    candidateQuery.data?.page ?? { page: state.page, size: 20, total: 0 },
    allCandidates.length,
  );
  const loadError = candidateQuery.isError ? (
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button
          variant="outlined"
          size="sm"
          onClick={() => {
            void candidateQuery.refetch();
          }}
        >
          {messages.common.retry}
        </Button>
      }
    >
      {messages.httpError.description}
    </AlertBanner>
  ) : null;

  const rows = visibleCandidates.map((candidate) => ({
    shipmentRequestId: candidate.shipmentRequestId,
    shipmentRequestNo: candidate.shipmentRequestNo,
    customerLabel: lookupLabel(partnerLookup.entries, candidate.customerId),
    requestedShipDate: candidate.requestedShipDate,
    statusCode: candidate.statusCode,
    blockers: shipmentGateBlockers(candidate),
  }));

  return (
    <>
      <ShipmentProcessingFilterBar
        appliedFilters={state.appliedFilters}
        onSearch={(next) => {
          dispatch({ type: 'SEARCH', filters: next });
        }}
        onReset={() => {
          dispatch({ type: 'RESET' });
        }}
      />
      <ShipmentProcessingCandidateListPane
        rows={rows}
        selectedShipmentRequestId={state.selectedShipmentRequestId}
        isLoading={candidateQuery.isFetching}
        loadError={loadError}
        page={page}
        onSelect={(shipmentRequestId) => {
          dispatch({ type: 'SELECT', shipmentRequestId });
        }}
        onChangePage={(nextPage) => {
          dispatch({ type: 'CHANGE_PAGE', page: nextPage });
        }}
      />

      {detailState.kind === 'NOT_SELECTED' ? (
        <section className="pane" aria-label={t.panes.lines}>
          <EmptyState
            size="sm"
            title={t.detail.selection.title}
            description={t.detail.selection.description}
          />
        </section>
      ) : detailState.kind === 'UNAVAILABLE' ? (
        <section className="pane" aria-label={t.panes.lines}>
          <AlertBanner
            variant="error"
            title={messages.httpError.loadTitle}
            action={
              <Button variant="outlined" size="sm" onClick={() => void detailQuery.refetch()}>
                {messages.common.retry}
              </Button>
            }
          >
            {messages.httpError.description}
          </AlertBanner>
        </section>
      ) : (
        <>
          <ShipmentLinesPane
            lines={lineDrafts}
            lotCandidates={lotCandidates}
            onAddAllocation={(lineId) => {
              updateLine(lineId, addAllocation);
            }}
            onRemoveAllocation={(lineId, draftId) => {
              updateLine(lineId, (line) => removeAllocation(line, draftId));
            }}
            onSetAllocationLot={(lineId, draftId, lotId) => {
              updateLine(lineId, (line) => setAllocationLot(line, draftId, lotId));
            }}
            onSetAllocationQty={(lineId, draftId, qty) => {
              updateLine(lineId, (line) => setAllocationQty(line, draftId, qty));
            }}
            onSetShippedQty={(lineId, qty) => {
              updateLine(lineId, (line) => setShippedQty(line, qty));
            }}
          />
          <LoadingInfoPane
            draft={loadingInfo}
            onChange={(patch) => {
              setOwnedLoadingInfo((current) => ({
                shipmentRequestId: state.selectedShipmentRequestId,
                draft: {
                  ...toSelectedLoadingInfo(current, state.selectedShipmentRequestId),
                  ...patch,
                },
              }));
            }}
            workerLookup={workerLookup}
            carrierLookup={partnerLookup}
            warehouseResolution={warehouseResolution}
          />
          <OutcomePane />

          <section className="pane" aria-label={t.panes.gate}>
            {submitBlockers.length === 0 ? (
              <p aria-live="polite" role="status">
                {t.gate.complete}
              </p>
            ) : (
              <AlertBanner variant="warning">
                <ul>
                  {submitBlockers.map((blocker) => (
                    <li key={blocker}>{t.gate.blockers[blocker]}</li>
                  ))}
                </ul>
              </AlertBanner>
            )}
            <Button
              disabled={!canSubmit || write.isSaving}
              onClick={() => {
                if (payload === null || detailState.kind !== 'RESOLVED') return;
                write.reset();
                setConfirmation({
                  shipmentRequestNo: detailState.detail.shipmentRequestNo,
                  /*
                   * ⭐ 시각은 **확정 창을 여는 순간 한 번만** 찍는다. 보내는 자리에서 찍으면
                   * 실패한 요청을 다시 보낼 때 값이 달라져 **멱등 키가 갈리고 전표가 두 벌
                   * 생긴다.** 본문을 만드는 자리(렌더마다 도는 곳)에서도 찍지 않는다.
                   */
                  payload: withOccurrence(payload, new Date()),
                });
              }}
            >
              {t.submit}
            </Button>
          </section>

          {confirmation === null ? null : (
            <SubmitConfirmDialog
              shipmentRequestNo={confirmation.shipmentRequestNo}
              banner={<SaveErrorBanner error={write.error} onReload={reloadAfterConflict} />}
              isSubmitting={write.isSaving}
              onClose={closeConfirm}
              onConfirm={() => {
                if (write.isSaving) return;
                write.write(confirmation.payload);
              }}
            />
          )}
        </>
      )}
    </>
  );
};
