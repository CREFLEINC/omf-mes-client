import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';

import type { HistoryFilters } from './filters';
import { validateHistoryPeriod } from './period';
import { useLotHoldEvents } from './queries';
import type { LotHoldEventView } from './types';

const EMPTY = '—';
const HISTORY_SCOPE_NOTICE = '보류 등록·해제 이력만 표시하며 전체 상태 전이는 기록되지 않습니다.';

const formatDateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

const eventLabel = (eventType: LotHoldEventView['eventTypeCode']): string =>
  eventType === 'HELD' ? '보류 등록' : '보류 해제';

const quantity = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

const eventKey = (event: LotHoldEventView): string =>
  `${event.lotHoldId}:${event.eventTypeCode}:${event.occurredAt}`;

const actorName = (event: LotHoldEventView): string => event.actorName?.trim() || '이름 미확인';

interface HistoryResultsProps {
  filters: HistoryFilters;
  page: number;
  offsetMinutes: number;
  onPageChange: (page: number) => void;
}

export const HistoryResults = ({
  filters,
  page,
  offsetMinutes,
  onPageChange,
}: HistoryResultsProps) => {
  const history = useLotHoldEvents(filters, page, offsetMinutes);
  const hasValidPeriod = validateHistoryPeriod({ from: filters.from, to: filters.to }) === null;
  const columns: Column<LotHoldEventView>[] = [
    {
      key: 'occurredAt',
      header: '일시',
      width: '164px',
      render: (event) => formatDateTime(event.occurredAt),
    },
    { key: 'lotNo', header: 'LOT', render: (event) => event.lotNo },
    {
      key: 'eventTypeCode',
      header: '전이/사건',
      width: '140px',
      render: (event) => (
        <Chip variant="status" size="sm">
          {eventLabel(event.eventTypeCode)}
        </Chip>
      ),
    },
    {
      key: 'actorName',
      header: '행위자',
      render: actorName,
    },
    { key: 'reasonCode', header: '사유', render: (event) => event.reasonCode ?? EMPTY },
  ];

  const retry = (
    <Button
      variant="outlined"
      size="sm"
      aria-label="보류 사건 이력 다시 시도"
      onClick={() => void history.refetch()}
    >
      다시 시도
    </Button>
  );
  const rows = [...(history.data?.rows ?? [])];
  const meta = history.data?.page;
  const currentPage = meta !== undefined && meta.page > 0 ? meta.page : page;
  const pageSize = meta !== undefined && meta.size > 0 ? meta.size : 1;
  const totalPages = Math.ceil((meta?.total ?? 0) / pageSize);
  const start = (currentPage - 1) * pageSize + 1;
  const rangeLabel =
    meta === undefined
      ? ''
      : rows.length === 0
        ? `전체 ${quantity(meta.total)}건`
        : `${quantity(start)}–${quantity(start + rows.length - 1)} / 전체 ${quantity(meta.total)}건`;

  return (
    <section aria-labelledby="lot-hold-history-title">
      <h2 id="lot-hold-history-title">보류 사건 이력</h2>
      <AlertBanner variant="info">{HISTORY_SCOPE_NOTICE}</AlertBanner>
      {!hasValidPeriod && (
        <EmptyState
          size="sm"
          title="기간을 선택하고 조회하세요"
          description="조회 기간을 모두 적용하면 보류 사건 이력이 표시됩니다."
        />
      )}
      {hasValidPeriod && history.isPending && (
        <div role="status" aria-label="보류 사건 이력을 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      )}
      {hasValidPeriod && history.isError && (
        <AlertBanner variant="error" title="보류 사건 이력을 불러오지 못했습니다." action={retry} />
      )}
      {hasValidPeriod && history.isFetching && history.data !== undefined && (
        <p className="field-note" role="status" aria-label="보류 사건 이력 갱신 중">
          보류 사건 이력을 갱신하는 중입니다.
        </p>
      )}
      {hasValidPeriod && history.data !== undefined && (
        <>
          <div className="wide-table" aria-busy={history.isFetching}>
            <Table
              density="compact"
              caption="보류 사건 이력"
              columns={columns}
              rows={rows}
              getRowId={eventKey}
              empty={
                <EmptyState
                  size="sm"
                  live
                  title="이 기간의 보류 사건이 없습니다"
                  description="현재 LOT 상태와 일치하지 않아도 오류가 아닙니다."
                />
              }
            />
          </div>
          {meta !== undefined && (
            <nav className="form-actions" aria-label="보류 사건 이력 쪽 이동">
              <p className="field-note form-actions-secondary">{rangeLabel}</p>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                이전 쪽
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                다음 쪽
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
};
