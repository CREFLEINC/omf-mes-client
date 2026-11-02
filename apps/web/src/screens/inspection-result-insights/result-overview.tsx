import {
  AlertBanner,
  Button,
  EmptyState,
  Icon,
  SkeletonText,
  type SortState,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import type { LookupSource } from '../../patterns/lookup-display';
import {
  DEFAULT_INSPECTION_RESULT_PAGE_SIZE,
  type InspectionInsightFilters,
  type InspectionResultSort,
} from './filters';
import { useLotIdByNo } from './history-queries';
import { AggregationBasis } from './aggregation-basis';
import { useInspectionResults } from './queries';
import { RefreshStatus } from './refresh-status';
import { toInspectionResultTreeRows } from './reinspection-chain';
import { toInspectionListQuery } from './request-queries';
import { ResultTable } from './result-table';
import { SUMMARY_ALL, SummaryPanels } from './summary-panels';
import { PAGE_SIZES, PageNav, type PageSize } from '../../patterns/page-nav';

const t = messages.inspectionResultInsights.overview;

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
  /** 한 쪽 결과 수(20 · 50 · 100) — 바꾸면 첫 쪽으로 간다. */
  pageSize?: PageSize;
  onPageSizeChange?: (size: PageSize) => void;
  /** 지금 상세에 연 검사 결과. */
  selectedId?: number | null;
  /** 좌우 배치 — 목록 열을 줄이지 않고 표 안에서 가로로 구른다. */
  scrollX?: boolean;
  onSelectResult: (inspectionResultId: number) => void;
  onViewExpiredCalibration: () => void;
  /** 요약 유형 탭(SUMMARY_ALL · IQC · PQC · OQC) — 불량 분석과 함께 쓴다. */
  summaryType?: string;
  onSummaryTypeChange?: (type: string) => void;
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
  pageSize = DEFAULT_INSPECTION_RESULT_PAGE_SIZE,
  onPageSizeChange,
  selectedId = null,
  scrollX = false,
  onSelectResult,
  onViewExpiredCalibration,
  summaryType,
  onSummaryTypeChange,
}: ResultOverviewProps) => {
  /* 화면이 탭을 쥐지 않으면(단독으로 그릴 때) 여기서 쥔다. */
  const [ownSummaryType, setOwnSummaryType] = useState(SUMMARY_ALL);
  /* LOT 번호 → id(omf-all-around#85). 못 풀면 목록을 세우지 않고 그 사유를 말한다. */
  const lotNo = filters.lotNo.trim();
  const hasLot = lotNo !== '';
  const lot = useLotIdByNo(queriesEnabled ? lotNo : '');
  const lotId = hasLot ? (lot.data ?? undefined) : undefined;
  const list = useInspectionResults(filters, sort, page, queriesEnabled, lotId, pageSize);
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
          /* 기간 · LOT 이 비었을 때는 아이콘 + 한 줄(사용자 시안 · omf-all-around#217). */
          icon={queriesEnabled ? <Icon name="search" size={32} /> : undefined}
          description={
            queriesEnabled
              ? undefined
              : validationPending
                ? t.blockedPendingDescription
                : t.blockedInvalidDescription
          }
        />
      </section>
    );
  }

  return (
    <section className="pane inspection-results-pane" aria-labelledby="inspection-results-title">
      {/* 머리 — 제목 · 「ⓘ 집계 기준」 왼쪽, 「마지막 갱신 …」 + [갱신] 오른쪽 끝(사용자 2026-10-30). */}
      <div className="inspection-results-pane-head">
        <h2 className="pane-title" id="inspection-results-title">
          {t.pane}
        </h2>
        {hasPeriod && <AggregationBasis />}
        <RefreshStatus updatedAt={list.dataUpdatedAt} />
      </div>
      {/* 회차 · LOT 조건 안내 줄은 뺐다(사용자 2026-10-30 · 2026-11-02). */}
      {/* 집계는 기간이 필수다 — LOT 만으로 조회하면 요약을 비워 두고 그렇다고 말한다. */}
      {hasPeriod ? (
        <SummaryPanels
          filters={filters}
          queriesEnabled={queriesEnabled}
          onViewExpiredCalibration={onViewExpiredCalibration}
          activeType={summaryType ?? ownSummaryType}
          onActiveTypeChange={onSummaryTypeChange ?? setOwnSummaryType}
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
          <ResultTable
            rows={toInspectionResultTreeRows(list.data.items)}
            labels={labels}
            sort={toTableSort(sort)}
            onSortChange={(next) => onSortChange(toServerSort(next))}
            selectedId={selectedId}
            onSelect={onSelectResult}
            scrollX={scrollX}
            isBusy={list.isFetching}
          />
          {/* 표 아래 쪽 이동 줄 — 총 건수 · 쪽 크기 · 처음/이전/n·N/다음/마지막(공용 부품 · 사용자 2026-10-30). */}
          <PageNav
            meta={{
              page: list.data.page.page,
              size: PAGE_SIZES.find((size) => size === list.data.page.size) ?? pageSize,
              total: list.data.page.total,
            }}
            onChangePage={onPageChange}
            onChangeSize={onPageSizeChange}
            /* 건수 선택칸은 작게, 처음 · 이전 … 단추는 종전 크기(사용자 2026-11-02). */
            controlSize="sm"
            buttonSize="md"
          />
        </>
      )}
    </section>
  );
};
