import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';

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
import { useBulkRelease } from './bulk-release';
import { BulkReleaseBar } from './bulk-release-bar';

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
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<number>>(new Set());
  const bulk = useBulkRelease();
  /* 목록이 바뀌면 보이지 않는 W/O 가 일괄 배포에 남지 않게 지금 목록에 있는 것만 남긴다. */
  const visibleChecked = new Set(
    [...checkedIds].filter((id) => candidates.some((candidate) => candidate.workOrderId === id)),
  );
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
        <div className="work-order-release-list-column">
          <BulkReleaseBar
            selectedCount={visibleChecked.size}
            isRunning={bulk.isRunning}
            outcomes={bulk.outcomes}
            onRun={() => {
              const targets = rows
                .filter((row) => visibleChecked.has(row.workOrderId))
                .map((row) => ({ workOrderId: row.workOrderId, workOrderNo: row.workOrderNo }));
              void bulk.run(targets).then(() => setCheckedIds(new Set()));
            }}
            onCloseResult={bulk.clear}
          />
          <WorkOrderReleaseCandidateListPane
            rows={rows}
            checkedIds={visibleChecked}
            onToggleChecked={(ids, checked) =>
              setCheckedIds((current) => {
                const next = new Set(current);
                for (const id of ids) {
                  if (checked) next.add(id);
                  else next.delete(id);
                }
                return next;
              })
            }
            selectedWorkOrderId={state.selectedWorkOrderId}
            isLoading={candidatesQuery.isFetching || itemNames.isLoading}
            loadError={loadError}
            page={page}
            hasSearched={filters.statusCode !== null}
            onSelect={(workOrderId) => {
              dispatch({ type: 'SELECT', workOrderId });
            }}
            onChangePage={(nextPage) => {
              dispatch({ type: 'CHANGE_PAGE', page: nextPage });
            }}
          />
        </div>
        <div className="work-order-release-detail">{selection}</div>
      </div>
    </div>
  );
};
