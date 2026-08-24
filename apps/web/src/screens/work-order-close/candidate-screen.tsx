import { AlertBanner, Button, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useReducer } from 'react';

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
  toWorkOrderCloseCodeOptions,
  toWorkOrderCloseProductionOrderOptions,
  WORK_ORDER_CLOSE_CODE_GROUPS,
} from './code-options';
import { WorkOrderCloseFilterBar } from './filter-bar';
import { toWorkOrderCloseFilterInitialization } from './filter-initialization';
import {
  WorkOrderCloseDetailSummaryPane,
  type WorkOrderCloseDetailSummaryState,
} from './detail-summary-pane';
import {
  useWorkOrderCloseCandidates,
  useWorkOrderCloseCodeValues,
  useWorkOrderCloseDetail,
  useWorkOrderCloseProductionOrders,
  type WorkOrderCloseDetailFact,
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

export const WorkOrderCloseCandidateScreen = () => {
  const status = useWorkOrderCloseCodeValues(WORK_ORDER_CLOSE_CODE_GROUPS.status);
  const productionOrders = useWorkOrderCloseProductionOrders();
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
  useEffect(() => {
    dispatch({ type: 'SYNCHRONIZE_INITIALIZATION', initialization });
  }, [initialization]);

  const filters = toWorkOrderCloseCandidateFilters(state);
  const candidate = useWorkOrderCloseCandidates(filters);
  const candidates = candidate.data?.items ?? [];
  const itemNames = useWorkOrderCloseItemNames(candidates.map((item) => item.itemId));
  const uoms = useWorkOrderCloseUomLookup();
  const detail = useWorkOrderCloseDetail(state.selectedWorkOrderId);
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
    selectedWorkOrderId: state.selectedWorkOrderId,
    isFetching: detail.isFetching,
    isError: detail.isError,
    detail: detail.data,
    unitLabel: detailUom?.kind === 'named' ? detailUom.label : null,
  });
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

  return (
    <>
      <WorkOrderCloseFilterBar
        appliedFilters={state.appliedFilters}
        productionOrderOptions={toWorkOrderCloseProductionOrderOptions(
          productionOrders.data?.items ?? [],
        )}
        statusOptions={toWorkOrderCloseCodeOptions(status.data?.items ?? [])}
        productionOrderUnavailableReason={productionOrderReason(productionOrders)}
        statusUnavailableReason={initialization.statusUnavailableReason}
        onSearch={(next) => dispatch({ type: 'SEARCH', filters: next })}
        onReset={() => dispatch({ type: 'RESET' })}
      />
      <WorkOrderCloseCandidateListPane
        rows={toWorkOrderCloseCandidateRows(candidates, itemNames.items, uoms)}
        selectedWorkOrderId={state.selectedWorkOrderId}
        isLoading={initialization.kind === 'CHECKING' || candidate.isFetching}
        loadError={loadError}
        page={page}
        onSelect={(workOrderId) => dispatch({ type: 'SELECT', workOrderId })}
        onChangePage={(nextPage) => dispatch({ type: 'CHANGE_PAGE', page: nextPage })}
      />
      <WorkOrderCloseDetailSummaryPane state={detailPaneState} />
    </>
  );
};
