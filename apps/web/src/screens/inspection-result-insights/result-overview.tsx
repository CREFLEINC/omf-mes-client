import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  SkeletonText,
  type SortState,
  StatCard,
  Table,
} from '@crefle/web-ui';

import type { InspectionInsightFilters, InspectionResultSort } from './filters';
import { useInspectionResults, useInspectionSummary, type InspectionResult } from './queries';
import { toInspectionSummaryQuery } from './request-queries';

const EMPTY = '미확인';
const TYPE_LABELS = new Map([
  ['IQC', '수입검사'],
  ['PQC', '공정검사'],
  ['OQC', '출하검사'],
]);

const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const number = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

export interface ResultLabels {
  item: ReadonlyMap<number, string>;
  judgment: ReadonlyMap<string, string>;
}

interface ResultOverviewProps {
  filters: InspectionInsightFilters;
  queriesEnabled?: boolean;
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
  sort,
  page,
  labels,
  onSortChange,
  onPageChange,
  onSelectResult,
  onViewExpiredCalibration,
}: ResultOverviewProps) => {
  const list = useInspectionResults(filters, sort, page, queriesEnabled);
  const summary = useInspectionSummary(filters, queriesEnabled);
  const isBlocked = !queriesEnabled || toInspectionSummaryQuery(filters) === null;

  if (isBlocked) {
    return (
      <EmptyState
        size="sm"
        title={
          queriesEnabled
            ? '기간과 검사유형을 선택하세요'
            : '주소의 날짜 또는 코드 조건이 유효하지 않습니다'
        }
        description={
          queriesEnabled
            ? '검사유형별 집계 기준이 확정된 조건만 조회합니다.'
            : '날짜를 확인하고 준비된 검사유형·판정 코드로 다시 조회하세요.'
        }
      />
    );
  }

  const columns: Column<InspectionResult>[] = [
    {
      key: 'inspectionRequestNo',
      header: '의뢰번호',
      sortable: true,
      render: (row) => (
        <Button
          size="sm"
          variant="text"
          aria-label={`${row.inspectionRequestNo ?? EMPTY} 상세 보기`}
          onClick={() => onSelectResult(row.inspectionResultId)}
        >
          {row.inspectionRequestNo ?? EMPTY}
        </Button>
      ),
    },
    {
      key: 'inspectionTypeCode',
      header: '검사유형',
      render: (row) => TYPE_LABELS.get(row.inspectionTypeCode ?? '') ?? EMPTY,
    },
    {
      key: 'item',
      header: '품목',
      render: (row) => (row.itemId === undefined ? EMPTY : (labels.item.get(row.itemId) ?? EMPTY)),
    },
    { key: 'lotNo', header: 'LOT', render: (row) => row.lotNo ?? EMPTY },
    {
      key: 'rejectedQty',
      header: '검사/합격/불합격',
      sortable: true,
      align: 'end',
      render: (row) =>
        `${number(row.inspectedQty)} / ${number(row.acceptedQty)} / ${number(row.rejectedQty)}`,
    },
    {
      key: 'overallJudgmentCode',
      header: '종합판정',
      render: (row) => labels.judgment.get(row.overallJudgmentCode) ?? EMPTY,
    },
    {
      key: 'inspectedAt',
      header: '검사시각/회차',
      sortable: true,
      render: (row) => `${dateTime(row.inspectedAt)} / ${row.inspectionRound}회`,
    },
  ];
  const cards =
    summary.data === undefined
      ? []
      : ([
          ['검사건수', summary.data.inspectionCount, '건'],
          ['검사수량', summary.data.inspectedQty, ''],
          ['합격수량', summary.data.acceptedQty, ''],
          ['불합격수량', summary.data.rejectedQty, ''],
          ['불량률', summary.data.defectRate, '%'],
        ] as const);

  return (
    <section aria-labelledby="inspection-results-title">
      <h2 id="inspection-results-title">검사실적 요약</h2>
      <p className="field-note">최종 회차만 집계합니다.</p>
      {summary.isPending && <SkeletonText lines={1} />}
      {summary.isError && (
        <AlertBanner
          variant="error"
          title="검사 요약을 불러오지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={() => void summary.refetch()}>
              다시 시도
            </Button>
          }
        />
      )}
      {!summary.isError && summary.data !== undefined && (
        <>
          <div className="filter-bar" role="group" aria-label="검사실적 요약 카드">
            {cards.map(([label, value, unit]) => (
              <StatCard key={label} label={label} value={number(value)} unit={unit} />
            ))}
          </div>
          <p className="field-note">기준 {dateTime(summary.data.asOf)}</p>
          <p className="field-note">불량률의 분모는 검사수량이며 생산 수율과 다를 수 있습니다.</p>
          {filters.calibrationExpired === '' && (summary.data.calibrationExpiredCount ?? 0) > 0 && (
            <AlertBanner
              variant="warning"
              title={`검교정 만료 장비 측정 건수 ${summary.data.calibrationExpiredCount}건이 기본 집계에 포함되어 있습니다.`}
              action={
                <Button size="sm" variant="outlined" onClick={onViewExpiredCalibration}>
                  검교정 만료만 분리해 보기
                </Button>
              }
            >
              기본 조회는 검교정 만료 장비로 측정된 건을 자동 제외하지 않습니다.
            </AlertBanner>
          )}
        </>
      )}
      <h3>검사 결과</h3>
      {(list.isPending || list.isPlaceholderData) && (
        <div role="status" aria-label="검사 결과 페이지를 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      )}
      {list.isError && (
        <AlertBanner
          variant="error"
          title="검사 결과를 불러오지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={() => void list.refetch()}>
              다시 시도
            </Button>
          }
        />
      )}
      {!list.isError && !list.isPlaceholderData && list.data !== undefined && (
        <>
          <Table
            density="compact"
            caption="검사 결과 목록"
            columns={columns}
            rows={[...list.data.items]}
            getRowId={(row) => String(row.inspectionResultId)}
            sort={toTableSort(sort)}
            onSortChange={(next) => onSortChange(toServerSort(next))}
            empty={<EmptyState size="sm" title="조건에 맞는 검사 결과가 없습니다" />}
          />
          <nav className="form-actions" aria-label="검사 결과 쪽 이동">
            <Button
              variant="outlined"
              size="sm"
              disabled={list.data.page.page <= 1}
              onClick={() => onPageChange(list.data.page.page - 1)}
            >
              이전 쪽
            </Button>
            <Button
              variant="outlined"
              size="sm"
              disabled={list.data.page.page * list.data.page.size >= list.data.page.total}
              onClick={() => onPageChange(list.data.page.page + 1)}
            >
              다음 쪽
            </Button>
          </nav>
        </>
      )}
    </section>
  );
};
