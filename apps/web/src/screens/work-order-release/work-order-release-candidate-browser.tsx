import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { useProductionOrderItemNames } from '../production-order/item-lookups';
import { useUomReferenceLookup } from '../production-order/reference-lookups';
import { toWorkOrderPageView } from '../work-order/pagination';
import {
  toWorkOrderReleaseCandidateRows,
  toWorkOrderReleaseCandidateSnapshot,
} from './work-order-release-candidate-view';
import { WorkOrderReleaseCandidateListPane } from './work-order-release-candidate-list-pane';
import { WorkOrderReleaseFilterBar } from './work-order-release-filter-bar';
import {
  toWorkOrderReleaseFilterLookups,
  useWorkOrderReleaseProductionLines,
  useWorkOrderReleaseStatusValues,
} from './work-order-release-filter-lookups';
import {
  createWorkOrderReleaseScreenState,
  reduceWorkOrderReleaseScreen,
  toWorkOrderReleaseFilters,
} from './work-order-release-screen-model';
import { useWorkOrderReleaseCandidates } from './queries';

export interface WorkOrderReleaseSelectionContext {
  selectedWorkOrderId: number | null;
  clearSelection: () => void;
}

export interface WorkOrderReleaseCandidateBrowserProps {
  renderSelection?: (context: WorkOrderReleaseSelectionContext) => ReactNode;
  /** 기본은 브라우저 시간대. 테스트나 셸이 명시하면 그 오프셋으로 날짜 경계를 만든다. */
  timezoneOffsetMinutes?: number;
}

export const WorkOrderReleaseCandidateBrowser = ({
  renderSelection,
  timezoneOffsetMinutes = -new Date().getTimezoneOffset(),
}: WorkOrderReleaseCandidateBrowserProps) => {
  const statusValues = useWorkOrderReleaseStatusValues();
  const productionLines = useWorkOrderReleaseProductionLines();
  const lookups = useMemo(
    () =>
      toWorkOrderReleaseFilterLookups(
        {
          data: statusValues.data,
          isError: statusValues.isError,
          isPending: statusValues.isPending,
        },
        {
          data: productionLines.data,
          isError: productionLines.isError,
          isPending: productionLines.isPending,
        },
      ),
    [
      productionLines.data,
      productionLines.isError,
      productionLines.isPending,
      statusValues.data,
      statusValues.isError,
      statusValues.isPending,
    ],
  );
  const [state, dispatch] = useReducer(
    reduceWorkOrderReleaseScreen,
    undefined,
    createWorkOrderReleaseScreenState,
  );
  const filters = toWorkOrderReleaseFilters(state, timezoneOffsetMinutes);
  const candidatesQuery = useWorkOrderReleaseCandidates(filters);
  const candidates = candidatesQuery.data?.items ?? [];
  const itemNames = useProductionOrderItemNames(candidates.map((candidate) => candidate.itemId));
  const uoms = useUomReferenceLookup();
  const rows = toWorkOrderReleaseCandidateRows(candidates, itemNames.items, uoms);
  const snapshot = useMemo(
    () =>
      toWorkOrderReleaseCandidateSnapshot({
        enabled: filters.statusCode !== null,
        isFetching: candidatesQuery.isFetching,
        isError: candidatesQuery.isError,
        candidateIds: candidatesQuery.data?.items.map((candidate) => candidate.workOrderId),
      }),
    [candidatesQuery.data, candidatesQuery.isError, candidatesQuery.isFetching, filters.statusCode],
  );

  useEffect(() => {
    dispatch({ type: 'CLEAR_MISSING_SELECTION', snapshot });
  }, [snapshot]);

  const page = toWorkOrderPageView(
    candidatesQuery.data?.page ?? { page: state.page, size: 20, total: 0 },
    candidates.length,
  );
  const loadError = candidatesQuery.isError ? (
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button
          variant="outlined"
          size="sm"
          onClick={() => {
            void candidatesQuery.refetch();
          }}
        >
          {messages.common.retry}
        </Button>
      }
    >
      {messages.httpError.description}
    </AlertBanner>
  ) : null;
  const selection = renderSelection?.({
    selectedWorkOrderId: state.selectedWorkOrderId,
    clearSelection: () => {
      dispatch({ type: 'CLEAR_SELECTION' });
    },
  });

  return (
    <div className="work-order-release-workspace">
      <WorkOrderReleaseFilterBar
        appliedFilters={state.appliedFilters}
        productionLineOptions={lookups.productionLineOptions}
        statusOptions={lookups.statusOptions}
        productionLineUnavailableReason={lookups.productionLineUnavailableReason}
        statusUnavailableReason={lookups.statusUnavailableReason}
        onSearch={(appliedFilters) => {
          dispatch({ type: 'SEARCH', filters: appliedFilters });
        }}
        onReset={() => {
          dispatch({ type: 'RESET' });
        }}
      />
      <div
        className={`work-order-release-content${state.selectedWorkOrderId === null ? '' : ' has-selection'}`}
      >
        <WorkOrderReleaseCandidateListPane
          rows={rows}
          selectedWorkOrderId={state.selectedWorkOrderId}
          isLoading={candidatesQuery.isFetching || itemNames.isLoading}
          loadError={loadError}
          page={page}
          onSelect={(workOrderId) => {
            dispatch({ type: 'SELECT', workOrderId });
          }}
          onChangePage={(nextPage) => {
            dispatch({ type: 'CHANGE_PAGE', page: nextPage });
          }}
        />
        <div className="work-order-release-detail">{selection}</div>
      </div>
    </div>
  );
};
