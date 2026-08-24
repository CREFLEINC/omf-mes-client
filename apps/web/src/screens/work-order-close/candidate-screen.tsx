import { AlertBanner, Button } from '@crefle/web-ui';
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
import { useWorkOrderCloseItemNames, useWorkOrderCloseUomLookup } from './candidate-references';
import {
  toWorkOrderCloseCodeOptions,
  toWorkOrderCloseProductionOrderOptions,
  WORK_ORDER_CLOSE_CODE_GROUPS,
} from './code-options';
import { WorkOrderCloseFilterBar } from './filter-bar';
import { toWorkOrderCloseFilterInitialization } from './filter-initialization';
import {
  useWorkOrderCloseCandidates,
  useWorkOrderCloseCodeValues,
  useWorkOrderCloseProductionOrders,
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
    </>
  );
};
