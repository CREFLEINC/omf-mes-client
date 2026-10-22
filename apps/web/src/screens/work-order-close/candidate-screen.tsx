import { AlertBanner, Button, EmptyState } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useReducer, useState } from 'react';

import { toWorkOrderPageView } from '../work-order/pagination';
import { WorkOrderCloseCandidateListPane } from './candidate-list-pane';
import {
  createWorkOrderCloseCandidateScreenState,
  reduceWorkOrderCloseCandidateScreen,
  toWorkOrderCloseCandidateFilters,
  toWorkOrderCloseCandidateRows,
  type WorkOrderCloseCandidateSnapshot,
} from './candidate-screen-model';
import {
  resolveWorkOrderCloseUomReference,
  useWorkOrderCloseItemNames,
  useWorkOrderCloseUomLookup,
} from './candidate-references';
import {
  WORK_ORDER_CLOSE_CODE_GROUPS,
  toWorkOrderCloseCodeLabel,
  toWorkOrderCloseCodeOptions,
  toWorkOrderCloseProductionOrderOptions,
} from './code-options';
import { WorkOrderCloseFilterBar } from './filter-bar';
import {
  DEFAULT_STATUS_FILTER,
  toWorkOrderCloseFilterInitialization,
} from './filter-initialization';
import type { WorkOrderCloseConfirmDetail } from './close-confirm-dialog';
import { WorkOrderCloseExecution } from './close-execution';
import {
  EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT,
  setWorkOrderCloseRemainderDisposition,
  setWorkOrderCloseRemarks,
  setWorkOrderCloseVarianceReasonCode,
  workOrderCloseReadinessInputFrom,
  type WorkOrderCloseInputDraft,
} from './close-input-draft';
import { WorkOrderCloseInputPane } from './close-input-pane';
import {
  CLOSABLE_WORK_ORDER_STATUSES,
  workOrderCloseBlockers,
  type WorkOrderCloseBlocker,
  type WorkOrderCloseCompletionJudgment,
} from './close-readiness';
import { toWorkOrderCloseRequest } from './close-request';
import { WorkOrderCloseStatusPane, type WorkOrderCloseStatusPaneState } from './close-status-pane';
import {
  WorkOrderCloseDetailSummaryPane,
  type WorkOrderCloseDetailSummaryState,
} from './detail-summary-pane';
import { WorkOrderCloseOutboundItemsPane } from './outbound-items-pane';
import { WorkOrderCloseResultPane } from './close-result-pane';
import { SessionForceEndDialog } from './session-force-end-dialog';
import { WorkOrderResultCorrectionWorkspace } from './result-correction-workspace';
import {
  useWorkOrderCloseCandidates,
  useWorkOrderCloseCodeValues,
  useWorkOrderCloseDetail,
  useWorkOrderCloseOpenLots,
  useWorkOrderCloseOpenSession,
  useWorkOrderCloseOutboundItemSettings,
  useWorkOrderCloseProductionOrders,
  type WorkOrderCloseDetailFact,
  type WorkOrderCloseOpenLots,
  type WorkOrderCloseOpenSessionView,
  type WorkOrderCloseOutboundItemSetting,
} from './queries';

const productionOrderReason = (
  query: ReturnType<typeof useWorkOrderCloseProductionOrders>,
): string | null => {
  if (query.isError) return messages.productionOrder.values.referenceFailed;
  if (query.isPending) return messages.productionOrder.values.referenceLoading;
  if (query.data?.truncated === true) return messages.productionOrder.values.referenceTruncated;
  return null;
};

interface CandidateQuerySnapshotSource {
  enabled: boolean;
  isFetching: boolean;
  isError: boolean;
  candidateIds: readonly number[] | undefined;
}

export const toWorkOrderCloseCandidateSnapshot = ({
  enabled,
  isFetching,
  isError,
  candidateIds,
}: CandidateQuerySnapshotSource): WorkOrderCloseCandidateSnapshot => {
  if (!enabled) return { kind: 'ABSENT' };
  if (isFetching) return { kind: 'PENDING' };
  if (isError) return { kind: 'FAILED' };
  if (candidateIds === undefined) return { kind: 'ABSENT' };
  return { kind: 'SETTLED', candidateIds };
};

interface DetailQuerySnapshotSource {
  selectedWorkOrderId: number | null;
  isFetching: boolean;
  isError: boolean;
  detail: WorkOrderCloseDetailFact | undefined;
  unitLabel: string | null;
}

export type WorkOrderCloseDetailScreenState =
  | { kind: 'NOT_SELECTED' }
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE' }
  | { kind: 'RESOLVED'; detail: WorkOrderCloseDetailFact; unitLabel: string | null };

export const toWorkOrderCloseDetailScreenState = ({
  selectedWorkOrderId,
  isFetching,
  isError,
  detail,
  unitLabel,
}: DetailQuerySnapshotSource): WorkOrderCloseDetailScreenState => {
  if (selectedWorkOrderId === null) return { kind: 'NOT_SELECTED' };
  if (isFetching) return { kind: 'CHECKING' };
  if (isError) return { kind: 'UNAVAILABLE' };
  if (detail === undefined) return { kind: 'UNAVAILABLE' };
  return { kind: 'RESOLVED', detail, unitLabel };
};

interface OutboundQuerySnapshotSource {
  selectedWorkOrderId: number | null;
  isFetching: boolean;
  isError: boolean;
  settings: readonly WorkOrderCloseOutboundItemSetting[] | undefined;
}

export type WorkOrderCloseOutboundScreenState =
  | { kind: 'HIDDEN' }
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE' }
  | { kind: 'READY'; settings: readonly WorkOrderCloseOutboundItemSetting[] };

export const toWorkOrderCloseOutboundScreenState = ({
  selectedWorkOrderId,
  isFetching,
  isError,
  settings,
}: OutboundQuerySnapshotSource): WorkOrderCloseOutboundScreenState => {
  if (selectedWorkOrderId === null) return { kind: 'HIDDEN' };
  if (isFetching) return { kind: 'CHECKING' };
  if (isError || settings === undefined) return { kind: 'UNAVAILABLE' };
  return { kind: 'READY', settings };
};

interface WorkOrderCloseExecutionRequestSource {
  selectedWorkOrderId: number | null;
  detailState: WorkOrderCloseDetailScreenState;
  judgment: WorkOrderCloseCompletionJudgment | null;
  blockers: readonly WorkOrderCloseBlocker[];
  draft: WorkOrderCloseInputDraft;
}
/**
 * 마감 요청 — 상세가 «고른 W/O의 것»으로 서 있고 판정·차단이 풀려야 만든다.
 *
 * ERP 송신 항목 설정은 관문이 아니다 — 전역 설정의 «읽기 표시»이고 마감 본문에 싣지 않는다
 * (`close-request.ts`). 설정 조회가 실패해도 마감 자체는 막지 않는다.
 */
export const toWorkOrderCloseExecutionRequest = (
  source: WorkOrderCloseExecutionRequestSource,
): components['schemas']['WorkOrderClose'] | null => {
  if (
    source.selectedWorkOrderId === null ||
    source.detailState.kind !== 'RESOLVED' ||
    source.detailState.detail.workOrderId !== source.selectedWorkOrderId ||
    source.judgment === null ||
    source.blockers.length > 0
  )
    return null;
  return toWorkOrderCloseRequest({
    completionJudgmentCode: source.judgment,
    remainderDispositionCode: source.draft.remainderDisposition,
    reasonCode: source.draft.varianceReasonCode,
    remarks: source.draft.remarks,
  });
};
export const toWorkOrderCloseSelectedDraft = (
  owned: { workOrderId: number | null; draft: WorkOrderCloseInputDraft },
  selectedWorkOrderId: number | null,
): WorkOrderCloseInputDraft =>
  owned.workOrderId === selectedWorkOrderId ? owned.draft : EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT;

const confirmText = messages.workOrderClose.confirm;

/** 확인 창이 되풀이할 값 — 판정과 그 판정이 요구한 입력만 싣는다. */
export const toWorkOrderCloseConfirmDetails = (source: {
  detailState: WorkOrderCloseDetailScreenState;
  judgment: WorkOrderCloseCompletionJudgment | null;
  draft: WorkOrderCloseInputDraft;
  reasonOptions: readonly { value: string; label: string }[];
}): WorkOrderCloseConfirmDetail[] => {
  const { detailState, judgment, draft } = source;
  if (detailState.kind !== 'RESOLVED' || judgment === null) return [];

  const summary = messages.workOrderClose.detailSummary;
  const input = messages.workOrderClose.input;
  const details: WorkOrderCloseConfirmDetail[] = [
    { label: confirmText.fields.judgment, value: summary.judgments[judgment] },
  ];
  const variance = detailState.detail.progress?.varianceQty;
  const unit = detailState.unitLabel ?? summary.values.unitNotConfirmed;
  if (variance !== undefined && variance !== 0) {
    details.push({
      label: variance > 0 ? summary.fields.shortfallQty : summary.fields.overageQty,
      value: `${String(Math.abs(variance))} ${unit}`,
    });
  }
  if (judgment === 'UNDER' && draft.remainderDisposition !== null) {
    details.push({
      label: confirmText.fields.remainder,
      value: input.remainder[draft.remainderDisposition],
    });
  }
  const reason = source.reasonOptions.find((option) => option.value === draft.varianceReasonCode);
  if (judgment !== 'NORMAL' && reason !== undefined) {
    details.push({ label: confirmText.fields.reason, value: reason.label });
  }
  if (
    judgment === 'UNDER' &&
    draft.remainderDisposition === 'WRITE_OFF' &&
    draft.remarks.trim() !== ''
  ) {
    details.push({ label: confirmText.fields.remarks, value: draft.remarks.trim() });
  }

  return details;
};

/** 마감과 함께 일어나는 일. 진행 중 LOT 을 모르면 없다고 단정하지 않는다. */
export const toWorkOrderCloseWarnings = (source: {
  detailState: WorkOrderCloseDetailScreenState;
  openLots: WorkOrderCloseOpenLots | 'UNKNOWN' | 'CHECKING' | undefined;
}): string[] => {
  if (source.detailState.kind !== 'RESOLVED') return [];

  const warnings: string[] = [];
  const voided = source.detailState.detail.preIssuedLots?.withoutResultCount ?? 0;
  if (voided > 0) warnings.push(confirmText.voidedSlots(voided));

  const openLots = source.openLots;
  if (openLots === 'UNKNOWN') {
    warnings.push(confirmText.openLotsUnknown);
  } else if (openLots === 'CHECKING') {
    warnings.push(confirmText.openLotsChecking);
  } else if (openLots !== undefined) {
    if (openLots.lotNos.length > 0) {
      warnings.push(confirmText.openLots(openLots.lotNos.length, openLots.lotNos.join(', ')));
    }
    if (openLots.uncheckedCount > 0) {
      warnings.push(confirmText.uncheckedLots(openLots.uncheckedCount));
    }
  }

  return warnings;
};

export const WorkOrderCloseCandidateScreen = () => {
  const status = useWorkOrderCloseCodeValues(WORK_ORDER_CLOSE_CODE_GROUPS.status);
  const productionOrders = useWorkOrderCloseProductionOrders();
  const reasons = useWorkOrderCloseCodeValues(WORK_ORDER_CLOSE_CODE_GROUPS.varianceReason);
  const outboundSettings = useWorkOrderCloseOutboundItemSettings();
  const initialization = useMemo(
    () =>
      toWorkOrderCloseFilterInitialization({
        data: status.data,
        isError: status.isError,
        isPending: status.isPending,
      }),
    [status.data, status.isError, status.isPending],
  );
  const [state, dispatch] = useReducer(
    reduceWorkOrderCloseCandidateScreen,
    initialization,
    createWorkOrderCloseCandidateScreenState,
  );
  const [ownedDraft, setOwnedDraft] = useState(() => ({
    workOrderId: state.selectedWorkOrderId,
    draft: { ...EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT },
  }));
  const draft = toWorkOrderCloseSelectedDraft(ownedDraft, state.selectedWorkOrderId);
  useEffect(() => {
    dispatch({ type: 'SYNCHRONIZE_INITIALIZATION', initialization });
  }, [initialization]);
  useEffect(() => {
    setOwnedDraft({
      workOrderId: state.selectedWorkOrderId,
      draft: { ...EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT },
    });
  }, [state.selectedWorkOrderId]);

  const filters = toWorkOrderCloseCandidateFilters(state);
  const correctionMode = state.appliedFilters.statusCode === 'CLOSED';
  const closeSelectedWorkOrderId = correctionMode ? null : state.selectedWorkOrderId;
  const candidate = useWorkOrderCloseCandidates(filters);
  const candidates = candidate.data?.items ?? [];
  const itemNames = useWorkOrderCloseItemNames(candidates.map((item) => item.itemId));
  const uoms = useWorkOrderCloseUomLookup();
  const detail = useWorkOrderCloseDetail(state.selectedWorkOrderId);
  const openSession = useWorkOrderCloseOpenSession(closeSelectedWorkOrderId);
  const openLots = useWorkOrderCloseOpenLots(closeSelectedWorkOrderId);
  const [forceEndTarget, setForceEndTarget] = useState<WorkOrderCloseOpenSessionView | null>(null);
  const snapshot = useMemo(
    () =>
      toWorkOrderCloseCandidateSnapshot({
        enabled: filters.statusCode !== null,
        isFetching: candidate.isFetching,
        isError: candidate.isError,
        candidateIds: candidate.data?.items.map((item) => item.workOrderId),
      }),
    [candidate.data, candidate.isError, candidate.isFetching, filters.statusCode],
  );
  useEffect(() => {
    dispatch({ type: 'CLEAR_MISSING_SELECTION', snapshot });
  }, [snapshot]);

  const page = toWorkOrderPageView(
    candidate.data?.page ?? { page: state.page, size: 20, total: 0 },
    candidates.length,
  );
  const loadError = candidate.isError ? (
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button
          variant="outlined"
          size="sm"
          onClick={() => {
            void candidate.refetch();
          }}
        >
          {messages.common.retry}
        </Button>
      }
    >
      {messages.httpError.description}
    </AlertBanner>
  ) : initialization.kind === 'UNAVAILABLE' ? (
    <AlertBanner variant="warning">{initialization.statusUnavailableReason}</AlertBanner>
  ) : null;
  const detailUom =
    detail.data === undefined ? null : resolveWorkOrderCloseUomReference(uoms, detail.data.uomId);
  const detailState = toWorkOrderCloseDetailScreenState({
    selectedWorkOrderId: closeSelectedWorkOrderId,
    isFetching: detail.isFetching,
    isError: detail.isError,
    detail: detail.data,
    unitLabel: detailUom?.kind === 'named' ? detailUom.label : null,
  });
  const outboundState = toWorkOrderCloseOutboundScreenState({
    selectedWorkOrderId: closeSelectedWorkOrderId,
    isFetching: outboundSettings.isFetching,
    isError: outboundSettings.isError,
    settings: outboundSettings.data,
  });
  const readyOutboundSettings = outboundState.kind === 'READY' ? outboundState.settings : [];
  const detailPaneState: WorkOrderCloseDetailSummaryState =
    detailState.kind === 'NOT_SELECTED'
      ? {
          kind: 'UNAVAILABLE',
          content: (
            <EmptyState
              size="sm"
              title={messages.workOrderClose.detailSummary.selection.title}
              description={messages.workOrderClose.detailSummary.selection.description}
            />
          ),
        }
      : detailState.kind === 'UNAVAILABLE'
        ? {
            kind: 'UNAVAILABLE',
            content: (
              <AlertBanner
                variant="error"
                title={messages.httpError.loadTitle}
                action={
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      void detail.refetch();
                    }}
                  >
                    {messages.common.retry}
                  </Button>
                }
              >
                {messages.httpError.description}
              </AlertBanner>
            ),
          }
        : detailState;
  const reasonOptions = useMemo(
    () =>
      (reasons.data?.items ?? [])
        .filter((reason) => reason.isActive && reason.codeName.trim() !== '')
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((reason) => ({ value: reason.code, label: toWorkOrderCloseCodeLabel(reason) })),
    [reasons.data],
  );
  let judgment: WorkOrderCloseCompletionJudgment | null = null;
  let hasOpenSession = false;
  let checking = false;
  let unavailable: [message: string, retry: () => unknown] | null = null;
  if (detailState.kind === 'RESOLVED') {
    const progress = detailState.detail.progress;
    const completionJudgment = progress?.completionJudgmentCode;
    if (completionJudgment === undefined) {
      unavailable = [messages.workOrderClose.readState.progressUnavailable, detail.refetch];
    } else if (openSession.isFetching) checking = true;
    else if (openSession.isError || openSession.data === undefined) {
      unavailable = [messages.workOrderClose.readState.openSessionFailed, openSession.refetch];
    } else if (completionJudgment === 'NORMAL') {
      judgment = completionJudgment;
      hasOpenSession = openSession.data.hasOpenSession;
    } else if (reasons.isFetching) checking = true;
    else if (reasons.isError || reasons.data === undefined) {
      unavailable = [messages.workOrderClose.readState.reasonFailed, reasons.refetch];
    } else if (reasons.data.truncated) {
      unavailable = [messages.workOrderClose.readState.reasonTruncated, reasons.refetch];
    } else if (reasonOptions.length === 0) {
      unavailable = [messages.workOrderClose.input.reason.empty, reasons.refetch];
    } else {
      judgment = completionJudgment;
      hasOpenSession = openSession.data.hasOpenSession;
    }
  }
  /* LOT 을 미달로 마감할 때 고른 사유가 W/O 에 실려 있다 — 같은 것을 다시 고르게 하지 않는다. */
  const savedReasonCode =
    detailState.kind === 'RESOLVED' ? detailState.detail.completionVarianceReasonCode : null;
  const isReasonPrefilled =
    judgment !== null &&
    judgment !== 'NORMAL' &&
    draft.varianceReasonCode === '' &&
    savedReasonCode !== null &&
    reasonOptions.some((option) => option.value === savedReasonCode);
  const seededDraft =
    isReasonPrefilled && savedReasonCode !== null
      ? setWorkOrderCloseVarianceReasonCode(draft, savedReasonCode)
      : draft;
  const inputDraft =
    judgment === 'NORMAL' ||
    seededDraft.varianceReasonCode === '' ||
    reasonOptions.some((option) => option.value === seededDraft.varianceReasonCode)
      ? seededDraft
      : setWorkOrderCloseVarianceReasonCode(seededDraft, '');
  const unavailableState = unavailable;
  const readinessInput = workOrderCloseReadinessInputFrom;
  const blockers =
    judgment === null
      ? []
      : workOrderCloseBlockers(
          readinessInput(
            inputDraft,
            judgment,
            hasOpenSession,
            detailState.kind === 'RESOLVED' &&
              CLOSABLE_WORK_ORDER_STATUSES.includes(detailState.detail.statusCode),
          ),
        );
  let readinessState: WorkOrderCloseStatusPaneState | null = null;
  if (checking) readinessState = { kind: 'CHECKING' };
  else if (unavailableState !== null)
    readinessState = {
      kind: 'UNAVAILABLE',
      content: (
        <AlertBanner
          variant="error"
          action={
            <Button onClick={() => void unavailableState[1]()}>{messages.common.retry}</Button>
          }
        >
          {unavailableState[0]}
        </AlertBanner>
      ),
    };
  else if (judgment !== null)
    readinessState = {
      kind: 'RESOLVED',
      blockers,
    };
  /* 그대로 남는 LOT 을 알리기 전에는 마감을 열지 않는다 — 확인 창이 그 사실을 빼고 묻게 된다. */
  const isCheckingOpenLots = closeSelectedWorkOrderId !== null && openLots.isPending;
  const executionCandidate = toWorkOrderCloseExecutionRequest({
    selectedWorkOrderId: state.selectedWorkOrderId,
    detailState,
    judgment,
    blockers,
    draft: inputDraft,
  });
  const executionRequest = isCheckingOpenLots ? null : executionCandidate;
  const confirmDetails = toWorkOrderCloseConfirmDetails({
    detailState,
    judgment,
    draft: inputDraft,
    reasonOptions,
  });
  const closeWarnings = toWorkOrderCloseWarnings({
    detailState,
    openLots: openLots.isError ? 'UNKNOWN' : openLots.isPending ? 'CHECKING' : openLots.data,
  });
  const updateDraft = (
    update: (current: WorkOrderCloseInputDraft) => WorkOrderCloseInputDraft,
  ): void =>
    setOwnedDraft((current) => ({
      workOrderId: state.selectedWorkOrderId,
      draft: update(toWorkOrderCloseSelectedDraft(current, state.selectedWorkOrderId)),
    }));

  return (
    <div className="work-order-close-workspace">
      <WorkOrderCloseFilterBar
        appliedFilters={state.appliedFilters}
        productionOrderOptions={toWorkOrderCloseProductionOrderOptions(
          productionOrders.data?.items ?? [],
        )}
        statusOptions={[
          { value: DEFAULT_STATUS_FILTER, label: messages.workOrderClose.filter.closableStatuses },
          ...toWorkOrderCloseCodeOptions(status.data?.items ?? []),
        ]}
        productionOrderUnavailableReason={productionOrderReason(productionOrders)}
        statusUnavailableReason={initialization.statusUnavailableReason}
        onSearch={(next) => dispatch({ type: 'SEARCH', filters: next })}
        onReset={() => dispatch({ type: 'RESET' })}
      />
      <div className="work-order-close-content">
        <WorkOrderCloseCandidateListPane
          rows={toWorkOrderCloseCandidateRows(candidates, itemNames.items, uoms, (code) => {
            const value = status.data?.items.find((item) => item.code === code);
            return value === undefined ? code : toWorkOrderCloseCodeLabel(value);
          })}
          selectedWorkOrderId={state.selectedWorkOrderId}
          isLoading={initialization.kind === 'CHECKING' || candidate.isFetching}
          loadError={loadError}
          page={page}
          variant={correctionMode ? 'correction' : 'close'}
          onSelect={(workOrderId) => dispatch({ type: 'SELECT', workOrderId })}
          onChangePage={(nextPage) => dispatch({ type: 'CHANGE_PAGE', page: nextPage })}
        />
        {correctionMode ? (
          <div className="work-order-close-detail">
            {state.selectedWorkOrderId === null ? null : (
              <WorkOrderCloseResultPane
                state={
                  detail.isPending
                    ? { kind: 'CHECKING' }
                    : detail.isError || detail.data === undefined
                      ? { kind: 'UNAVAILABLE', onRetry: () => void detail.refetch() }
                      : {
                          kind: 'RESOLVED',
                          detail: detail.data,
                          reasonLabel: (code) => {
                            const reason = reasons.data?.items.find((item) => item.code === code);
                            return reason === undefined ? code : toWorkOrderCloseCodeLabel(reason);
                          },
                        }
                }
              />
            )}
            <WorkOrderResultCorrectionWorkspace
              workOrderId={state.selectedWorkOrderId}
              workOrderNo={
                candidates.find((item) => item.workOrderId === state.selectedWorkOrderId)
                  ?.workOrderNo ?? ''
              }
            />
          </div>
        ) : (
          <div className="work-order-close-detail">
            <WorkOrderCloseDetailSummaryPane state={detailPaneState} />
            {judgment === null ? null : (
              <WorkOrderCloseInputPane
                completionJudgment={judgment}
                draft={inputDraft}
                reasonOptions={reasonOptions}
                reasonUnavailableReason={null}
                isReasonPrefilled={isReasonPrefilled}
                onRemainderDispositionChange={(value) =>
                  updateDraft((current) => setWorkOrderCloseRemainderDisposition(current, value))
                }
                onVarianceReasonCodeChange={(value) =>
                  updateDraft((current) => setWorkOrderCloseVarianceReasonCode(current, value))
                }
                onRemarksChange={(value) =>
                  updateDraft((current) => setWorkOrderCloseRemarks(current, value))
                }
              />
            )}
            {readinessState === null ? null : (
              <WorkOrderCloseStatusPane
                state={readinessState}
                openSessions={openSession.data?.sessions ?? []}
                onRecheckSessions={() => void openSession.refetch()}
                onForceEnd={setForceEndTarget}
              />
            )}
            {outboundState.kind === 'HIDDEN' ? null : (
              <WorkOrderCloseOutboundItemsPane
                settings={readyOutboundSettings}
                isLoading={outboundState.kind === 'CHECKING'}
                loadError={
                  outboundState.kind === 'UNAVAILABLE' ? (
                    <AlertBanner
                      variant="error"
                      title={messages.httpError.loadTitle}
                      action={
                        <Button onClick={() => void outboundSettings.refetch()}>
                          {messages.common.retry}
                        </Button>
                      }
                    >
                      {messages.httpError.description}
                    </AlertBanner>
                  ) : null
                }
              />
            )}
            {state.selectedWorkOrderId === null ? null : (
              <WorkOrderCloseExecution
                key={state.selectedWorkOrderId}
                workOrderId={state.selectedWorkOrderId}
                workOrderNo={detailState.kind === 'RESOLVED' ? detailState.detail.workOrderNo : ''}
                request={executionRequest}
                details={confirmDetails}
                warnings={closeWarnings}
                onClearSelection={() => dispatch({ type: 'CLEAR_SELECTION' })}
                onReloadCandidates={candidate.refetch}
                onReloadDetail={detail.refetch}
                onReloadSessions={openSession.refetch}
              />
            )}
          </div>
        )}
      </div>
      {forceEndTarget === null ? null : (
        <SessionForceEndDialog
          key={forceEndTarget.workSessionId}
          session={forceEndTarget}
          onClose={() => setForceEndTarget(null)}
        />
      )}
    </div>
  );
};
