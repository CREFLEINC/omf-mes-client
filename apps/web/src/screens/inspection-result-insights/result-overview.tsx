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
import { useLotIdByNo } from './history-queries';
import { useInspectionResults } from './queries';
import { toInspectionResultTreeRows, type InspectionResultTreeRow } from './reinspection-chain';
import { toInspectionListQuery } from './request-queries';
import { SummaryPanels } from './summary-panels';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.inspectionResultInsights.overview;
const EMPTY = t.unknown;
/* 목록의 유형 열은 요약·추이의 모집단 이름과 같은 말을 쓴다. */
const TYPE_LABELS = new Map<string, string>(
  Object.entries(messages.inspectionResultInsights.inspectionTypes),
);

const dateTime = (value: string): string => {
  return formatPlantDateTime(value) ?? value;
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
  /* LOT 번호 → id(omf-all-around#85). 못 풀면 목록을 세우지 않고 그 사유를 말한다. */
  const lotNo = filters.lotNo.trim();
  const hasLot = lotNo !== '';
  const lot = useLotIdByNo(queriesEnabled ? lotNo : '');
  const lotId = hasLot ? (lot.data ?? undefined) : undefined;
  const list = useInspectionResults(filters, sort, page, queriesEnabled, lotId);
  const hasPeriod = filters.from !== '' && filters.to !== '';
  const isBlocked =
    !queriesEnabled ||
    toInspectionListQuery(filters, sort, page, hasLot ? (lotId ?? 0) : undefined) === null;

  if (!isBlocked && hasLot && (lot.isPending || lot.isError || lot.data === null)) {
    return (
      <section
        className="pane inspection-results-pane inspection-results-empty-pane"
        aria-labelledby="inspection-results-title"
      >
        <h2 className="pane-title" id="inspection-results-title">
          {t.pane}
        </h2>
        {lot.isPending && (
          <div role="status" aria-label={t.lotChecking}>
            <SkeletonText lines={1} />
          </div>
        )}
        {lot.isError && (
          <AlertBanner
            variant="error"
            title={t.lotFailed}
            action={
              <Button size="sm" variant="outlined" onClick={() => void lot.refetch()}>
                {t.retry}
              </Button>
            }
          />
        )}
        {lot.data === null && (
          <EmptyState
            size="sm"
            title={t.lotNotFound(lotNo)}
            description={t.lotNotFoundDescription}
          />
        )}
      </section>
    );
  }

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
      key: 'inspector',
      header: t.columns.inspector,
      render: (row) => row.result.inspectorName ?? EMPTY,
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
      {hasLot && <p className="field-note">{t.lotOnlyListNote}</p>}
      {/* 집계는 기간이 필수다 — LOT 만으로 조회하면 요약을 비워 두고 그렇다고 말한다. */}
      {hasPeriod ? (
        <SummaryPanels
          filters={filters}
          queriesEnabled={queriesEnabled}
          onViewExpiredCalibration={onViewExpiredCalibration}
        />
      ) : (
        <p className="field-note">{t.summaryNeedsPeriod}</p>
      )}
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
