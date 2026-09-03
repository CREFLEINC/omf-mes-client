import { EmptyState, Skeleton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { GroupBy } from './filters';
import { formatCount, formatDecimal, type DistributionRow } from './types';

const t = messages.downtimeSummary;

/** 첫 열의 이름만 탭마다 다르다 — 나머지 넷은 세 탭이 같은 것을 센다. */
const firstHeader = (groupBy: GroupBy): string => {
  switch (groupBy) {
    case 'REASON':
      return t.table.reasonCode;
    case 'EQUIPMENT':
      return t.table.equipmentCode;
    case 'PERIOD':
      return t.table.periodStart;
  }
};

/**
 * 표 아래에 붙는 설명. **탭마다 빠진 것이 다르다.**
 *
 * ⛔ 이것을 툴팁이나 도움말로 밀어 두지 않는다 — 사유별 합이 실제 비가동과 다를 수 있다는
 * 사실은 표를 읽는 내내 참이고, 모르고 읽으면 「합계가 틀렸다」로 결론짓는다.
 */
const captionOf = (groupBy: GroupBy): string => {
  switch (groupBy) {
    case 'REASON':
      return t.table.reasonCaption;
    case 'EQUIPMENT':
      return t.table.equipmentCaption;
    case 'PERIOD':
      return t.table.periodCaption;
  }
};

/** 값이 없는 칸. ⛔ 0으로 채우지 않는다 — 「0이었다」와 「낼 수 없다」는 다른 사실이다. */
const optional = (value: number | null, format: (value: number) => string): string =>
  value === null ? t.table.notAvailable : format(value);

export const columnsOf = (groupBy: GroupBy): Column<DistributionRow>[] => [
  { key: 'label', header: firstHeader(groupBy), render: (row) => row.label },
  {
    key: 'count',
    header: t.table.count,
    align: 'end',
    render: (row) => formatCount(row.count),
    sortable: true,
    sortAccessor: (row) => row.count,
  },
  {
    key: 'totalMinutes',
    header: t.table.totalMinutes,
    align: 'end',
    render: (row) => formatCount(row.totalMinutes),
    sortable: true,
    sortAccessor: (row) => row.totalMinutes,
  },
  {
    key: 'averageMinutes',
    header: t.table.averageMinutes,
    align: 'end',
    render: (row) => optional(row.averageMinutes, formatDecimal),
  },
  {
    key: 'sharePercent',
    header: t.table.sharePercent,
    align: 'end',
    render: (row) =>
      row.sharePercent === null ? t.table.notAvailable : `${formatDecimal(row.sharePercent)}%`,
  },
];

export interface DistributionTableProps {
  rows: DistributionRow[];
  groupBy: GroupBy;
  isLoading: boolean;
  /** 조회 조건이 아직 서지 않았으면 참. 「없다」와 「아직 안 물었다」를 가른다. */
  hasQuery: boolean;
}

/**
 * 분포 표 — **세 탭이 같은 표를 쓴다.**
 *
 * 서버가 요청한 묶음 축의 배열 하나만 채우므로, 화면은 그 줄들을 같은 열 구성으로 그린다.
 * 세 표를 따로 만들면 같은 열 넷을 세 벌 유지하게 되고, 한 벌만 고쳐지는 날이 온다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DistributionTable = ({
  rows,
  groupBy,
  isLoading,
  hasQuery,
}: DistributionTableProps) => {
  if (isLoading) return <Skeleton variant="rect" height="12rem" />;

  if (!hasQuery) return null;

  return (
    <div className="wide-table downtime-summary-table">
      <Table
        columns={columnsOf(groupBy)}
        rows={rows}
        getRowId={(row) => row.key}
        caption={captionOf(groupBy)}
        density="compact"
        empty={<EmptyState size="sm" live title={t.table.emptyTitle} description={t.table.empty} />}
      />
    </div>
  );
};
