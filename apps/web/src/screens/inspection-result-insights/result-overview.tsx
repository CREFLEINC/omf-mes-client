import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  SkeletonText,
  type SortState,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import type { InspectionInsightFilters, InspectionResultSort } from './filters';
import { useInspectionResults, type InspectionResult } from './queries';
import { toInspectionResultTreeRows, type InspectionResultTreeRow } from './reinspection-chain';
import { toInspectionListQuery } from './request-queries';
import { SummaryPanels } from './summary-panels';

const t = messages.inspectionResultInsights.overview;
const EMPTY = t.unknown;
/* 목록의 유형 열은 요약·추이의 모집단 이름과 같은 말을 쓴다. */
const TYPE_LABELS = new Map<string, string>(
  Object.entries(messages.inspectionResultInsights.inspectionTypes),
);

const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const number = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

export interface ResultLabels {
  item: LookupSource;
  judgment: LookupSource;
}

interface ResultOverviewProps {
  filters: InspectionInsightFilters;
  queriesEnabled?: boolean;
  validationPending?: boolean;
  sort: InspectionResultSort;
  page: number;
  labels: ResultLabels;
  onSortChange: (sort: InspectionResultSort) => void;
  onPageChange: (page: number) => void;
  onSelectResult: (inspectionResultId: number) => void;
  onViewExpiredCalibration: () => void;
}

const TABLE_SORTS: Record<InspectionResultSort, SortState> = {
  'inspectionRequestNo,asc': { key: 'inspectionRequestNo', direction: 'ascending' },
  'inspectionRequestNo,desc': { key: 'inspectionRequestNo', direction: 'descending' },
  'inspectedAt,asc': { key: 'inspectedAt', direction: 'ascending' },
  'inspectedAt,desc': { key: 'inspectedAt', direction: 'descending' },
  'rejectedQty,asc': { key: 'rejectedQty', direction: 'ascending' },
  'rejectedQty,desc': { key: 'rejectedQty', direction: 'descending' },
};

const toTableSort = (sort: InspectionResultSort): SortState => TABLE_SORTS[sort];

const toServerSort = (sort: SortState | null): InspectionResultSort => {
  if (sort === null || !['inspectionRequestNo', 'inspectedAt', 'rejectedQty'].includes(sort.key))
    return 'inspectedAt,desc';
  return `${sort.key},${sort.direction === 'ascending' ? 'asc' : 'desc'}` as InspectionResultSort;
};

export const ResultOverview = ({
  filters,
  queriesEnabled = true,
  validationPending = false,
  sort,
  page,
  labels,
  onSortChange,
  onPageChange,
  onSelectResult,
  onViewExpiredCalibration,
}: ResultOverviewProps) => {
  const list = useInspectionResults(filters, sort, page, queriesEnabled);
  const isBlocked = !queriesEnabled || toInspectionListQuery(filters, sort, page) === null;

  if (isBlocked) {
    return (
      <section
        className="pane inspection-results-pane inspection-results-empty-pane"
        aria-labelledby="inspection-results-title"
      >
        <h2 className="pane-title" id="inspection-results-title">
          {t.pane}
        </h2>
        <EmptyState
          size="sm"
          title={
            queriesEnabled
              ? t.blockedPeriod
              : validationPending
                ? t.blockedPending
                : t.blockedInvalid
          }
          description={
            queriesEnabled
              ? t.blockedPeriodDescription
              : validationPending
                ? t.blockedPendingDescription
                : t.blockedInvalidDescription
          }
        />
      </section>
    );
  }

  const columns: Column<InspectionResultTreeRow>[] = [
    {
      key: 'inspectionRequestNo',
      header: t.columns.inspectionRequestNo,
      sortable: true,
      render: (row) => (
        <Button
          size="sm"
          variant="text"
          className="tree-toggle"
          data-depth={row.depth}
          style={{ paddingInlineStart: `${String(row.depth)}rem` }}
          aria-label={t.detailOf(row.result.inspectionRequestNo ?? EMPTY)}
          onClick={() => onSelectResult(row.result.inspectionResultId)}
        >
          {row.result.inspectionRequestNo ?? EMPTY}
        </Button>
      ),
    },
    {
      key: 'inspectionTypeCode',
      header: t.columns.inspectionType,
      render: (row) => TYPE_LABELS.get(row.result.inspectionTypeCode ?? '') ?? EMPTY,
    },
    {
      key: 'item',
      header: t.columns.item,
      render: (row) => lookupDisplayLabelWithInactive(labels.item, row.result.itemId),
    },
    { key: 'lotNo', header: t.columns.lotNo, render: (row) => row.result.lotNo ?? EMPTY },
    {
      key: 'rejectedQty',
      header: t.columns.quantities,
      sortable: true,
      align: 'end',
      render: (row) =>
        `${number(row.result.inspectedQty)} / ${number(row.result.acceptedQty)} / ${number(row.result.rejectedQty)}`,
    },
    {
      key: 'overallJudgmentCode',
      header: t.columns.judgment,
      render: (row) =>
        lookupDisplayLabelWithInactive(labels.judgment, row.result.overallJudgmentCode),
    },
    {
      key: 'inspectedAt',
      header: t.columns.inspectedAt,
      sortable: true,
      render: (row) =>
        t.inspectedAtWithRound(dateTime(row.result.inspectedAt), row.result.inspectionRound),
    },
  ];
  return (
    <section className="pane inspection-results-pane" aria-labelledby="inspection-results-title">
      <h2 className="pane-title" id="inspection-results-title">
        {t.pane}
      </h2>
      <p className="field-note">{filters.finalRoundOnly ? t.finalRoundNote : t.allRoundsNote}</p>
      <SummaryPanels
        filters={filters}
        queriesEnabled={queriesEnabled}
        onViewExpiredCalibration={onViewExpiredCalibration}
      />
      <h3 className="inspection-results-subtitle">{t.listTitle}</h3>
      {(list.isPending || list.isPlaceholderData) && (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {list.isError && (
        <AlertBanner
          variant="error"
          title={t.failed}
          action={
            <Button size="sm" variant="outlined" onClick={() => void list.refetch()}>
              {t.retry}
            </Button>
          }
        />
      )}
      {!list.isError && !list.isPlaceholderData && list.data !== undefined && (
        <>
          <div className="wide-table inspection-results-table" aria-busy={list.isFetching}>
            <Table
              density="compact"
              caption={t.caption}
              columns={columns}
              rows={toInspectionResultTreeRows(list.data.items)}
              getRowId={(row) => String(row.result.inspectionResultId)}
              sort={toTableSort(sort)}
              onSortChange={(next) => onSortChange(toServerSort(next))}
              empty={<EmptyState size="sm" title={t.empty} />}
            />
          </div>
          <div className="inspection-results-list-footer">
            <p className="field-note">
              {t.pageSummary(
                number(list.data.page.total),
                list.data.page.page,
                Math.max(1, Math.ceil(list.data.page.total / Math.max(1, list.data.page.size))),
              )}
            </p>
            <nav className="form-actions" aria-label={t.pagination}>
              <Button
                variant="outlined"
                size="sm"
                disabled={list.data.page.page <= 1}
                onClick={() => onPageChange(list.data.page.page - 1)}
              >
                {t.previous}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={list.data.page.page * list.data.page.size >= list.data.page.total}
                onClick={() => onPageChange(list.data.page.page + 1)}
              >
                {t.next}
              </Button>
            </nav>
          </div>
        </>
      )}
    </section>
  );
};
