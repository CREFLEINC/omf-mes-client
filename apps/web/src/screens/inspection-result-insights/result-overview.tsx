import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  SkeletonText,
  type SortState,
  Table,
} from '@crefle/web-ui';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import type { InspectionInsightFilters, InspectionResultSort } from './filters';
import { useInspectionResults, type InspectionResult } from './queries';
import { toInspectionResultTreeRows, type InspectionResultTreeRow } from './reinspection-chain';
import { toInspectionListQuery } from './request-queries';
import { SummaryPanels } from './summary-panels';

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
      <EmptyState
        size="sm"
        title={
          queriesEnabled
            ? '기간을 선택하세요'
            : validationPending
              ? '조회 조건 이름을 확인하는 중입니다'
              : '주소의 날짜 또는 코드 조건이 유효하지 않습니다'
        }
        description={
          queriesEnabled
            ? '조회 기간은 필수입니다.'
            : validationPending
              ? '준비가 끝날 때까지 조회 요청을 보내지 않습니다.'
              : '날짜를 확인하고 준비된 검사유형·판정 코드로 다시 조회하세요.'
        }
      />
    );
  }

  const columns: Column<InspectionResultTreeRow>[] = [
    {
      key: 'inspectionRequestNo',
      header: '의뢰번호',
      sortable: true,
      render: (row) => (
        <Button
          size="sm"
          variant="text"
          className="tree-toggle"
          data-depth={row.depth}
          style={{ paddingInlineStart: `${String(row.depth)}rem` }}
          aria-label={`${row.result.inspectionRequestNo ?? EMPTY} 상세 보기`}
          onClick={() => onSelectResult(row.result.inspectionResultId)}
        >
          {row.result.inspectionRequestNo ?? EMPTY}
        </Button>
      ),
    },
    {
      key: 'inspectionTypeCode',
      header: '검사유형',
      render: (row) => TYPE_LABELS.get(row.result.inspectionTypeCode ?? '') ?? EMPTY,
    },
    {
      key: 'item',
      header: '품목',
      render: (row) => lookupDisplayLabelWithInactive(labels.item, row.result.itemId),
    },
    { key: 'lotNo', header: 'LOT', render: (row) => row.result.lotNo ?? EMPTY },
    {
      key: 'rejectedQty',
      header: '검사/합격/불합격',
      sortable: true,
      align: 'end',
      render: (row) =>
        `${number(row.result.inspectedQty)} / ${number(row.result.acceptedQty)} / ${number(row.result.rejectedQty)}`,
    },
    {
      key: 'overallJudgmentCode',
      header: '종합판정',
      render: (row) =>
        lookupDisplayLabelWithInactive(labels.judgment, row.result.overallJudgmentCode),
    },
    {
      key: 'inspectedAt',
      header: '검사시각/회차',
      sortable: true,
      render: (row) => `${dateTime(row.result.inspectedAt)} / ${row.result.inspectionRound}회`,
    },
  ];
  return (
    <section aria-labelledby="inspection-results-title">
      <h2 id="inspection-results-title">검사실적 요약</h2>
      <p className="field-note">
        {filters.finalRoundOnly
          ? '최종 회차만 집계합니다.'
          : '뿌리 결과 기준 페이지에서 재검 사슬 전체를 회차 순서로 표시합니다.'}
      </p>
      <SummaryPanels
        filters={filters}
        queriesEnabled={queriesEnabled}
        onViewExpiredCalibration={onViewExpiredCalibration}
      />
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
            rows={toInspectionResultTreeRows(list.data.items)}
            getRowId={(row) => String(row.result.inspectionResultId)}
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
