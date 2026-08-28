import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  type SortState as TableSortState,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PeriodInput } from './period';
import type { WorkOrderRow } from './row-view';
import { isSortKeyAllowed, type SortKey, type SortState } from './sort';

export interface WorkOrderTableProps {
  rows: WorkOrderRow[];
  sort: SortState;
  /** 지금 걸린 기간 — 어느 열로 정렬할 수 있는지가 여기에 걸린다. */
  period: PeriodInput;
  isLoading: boolean;
  isError: boolean;
  /** 식별자를 사람이 읽는 이름으로. 이름표를 만드는 일은 화면이 맡는다. */
  itemLabel: (itemIdText: string) => string;
  /**
   * 상태 코드를 마스터의 표시명으로.
   *
   * ⚠ 품목과 달리 **못 찾으면 코드를 그대로 둔다** — 상태 코드는 그 자체가 사람이 읽을 수
   * 있는 말이라, 감추면 오히려 정보가 준다. 그 판단은 이름표가 갖는다.
   */
  statusLabel: (statusCode: string) => string;
  onSort: (key: SortKey) => void;
  onSelect: (workOrderId: number) => void;
}

/** DS 의 정렬 표기와 이 화면의 표기를 잇는다 — 방향 낱말이 서로 다르다. */
const toTableSort = (sort: SortState): TableSortState => ({
  key: sort.key,
  direction: sort.direction === 'desc' ? 'descending' : 'ascending',
});

/**
 * 진행현황 목록.
 *
 * ⛔ **전부 읽기 전용이다.** 이 화면에는 저장 액션이 없다 — 줄을 누르는 것은 상세를 여는
 * 일이지 고치는 일이 아니다.
 *
 * ⛔ **정렬을 서버에 맡긴다.** 화면이 이 페이지만 다시 늘어놓으면 **서버 전체를 정렬한 것처럼
 * 보이면서 결과가 틀린다** — 50건 안에서의 1등이 128건의 1등은 아니다. 그래서 표의 내부
 * 정렬을 끄고(`sort` 를 제어 값으로 준다) 누름을 밖으로 넘긴다.
 *
 * ⛔ **정렬할 수 없는 열은 머리를 누를 수 없게 둔다.** 눌러도 안 되는 머리를 두면 사용자가
 * 고장으로 읽는다 — 기간이 넓을 때의 달성률이 그렇다(L-4).
 *
 * ⚠ **P/O·공정 열이 없다.** 응답이 식별자만 주어 이름을 얻으려면 줄마다 서버를 다시 불러야
 * 한다(omf-mes#265). 없는 이유를 목록 머리에 적는다(A-11).
 */
export const WorkOrderTable = ({
  rows,
  sort,
  period,
  isLoading,
  isError,
  itemLabel,
  statusLabel,
  onSort,
  onSelect,
}: WorkOrderTableProps) => {
  const t = messages.workOrderProgress.list;

  const sortable = (key: SortKey): boolean => isSortKeyAllowed(key, period);

  const columns: Column<WorkOrderRow>[] = [
    {
      key: 'workOrderNo',
      header: t.columns.workOrderNo,
      sortable: sortable('workOrderNo'),
      render: (row) => (
        <Button
          variant="text"
          onClick={() => {
            onSelect(row.workOrderId);
          }}
        >
          {t.select(row.workOrderNo)}
        </Button>
      ),
    },
    { key: 'itemId', header: t.columns.itemId, render: (row) => itemLabel(row.itemIdText) },
    {
      key: 'orderQty',
      header: t.columns.orderQty,
      align: 'end',
      render: (row) => row.orderQtyText,
    },
    { key: 'goodQty', header: t.columns.goodQty, align: 'end', render: (row) => row.goodQtyText },
    {
      key: 'defectQty',
      header: t.columns.defectQty,
      align: 'end',
      render: (row) => row.defectQtyText,
    },
    { key: 'holdQty', header: t.columns.holdQty, align: 'end', render: (row) => row.holdQtyText },
    {
      key: 'scrapQty',
      header: t.columns.scrapQty,
      align: 'end',
      render: (row) => row.scrapQtyText,
    },
    {
      key: 'reworkQty',
      header: t.columns.reworkQty,
      align: 'end',
      render: (row) => row.reworkQtyText,
    },
    {
      key: 'achievementRate',
      header: t.columns.achievementRate,
      align: 'end',
      sortable: sortable('achievementRate'),
      render: (row) => row.achievementRateText,
    },
    {
      key: 'statusCode',
      header: t.columns.statusCode,
      sortable: sortable('statusCode'),
      render: (row) => statusLabel(row.statusCode),
    },
    {
      key: 'plannedEndAt',
      header: t.columns.plannedEndAt,
      render: (row) => row.plannedEndAtText,
    },
    {
      key: 'delay',
      header: t.columns.delay,
      /*
       * ⛔ 「모름」을 빈칸으로 두지 않는다. 빈칸은 「정상」으로 읽히는데, 계획 종료가 없는
       * 지시는 늦었는지 아닌지 **판정할 수 없는** 것이다(스펙 §5-3).
       */
      render: (row) => {
        if (row.delay === 'unknown') return t.delayUnknown;
        return row.delay === 'delayed' ? t.delayed : t.blank;
      },
    },
  ];

  if (isError) {
    return (
      <section aria-label={t.title}>
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadError}</AlertBanner>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t.title}>
      {isLoading && <p role="status">{t.loading}</p>}

      <p>{t.joinedColumnsNote}</p>
      <p>{t.quantityNote}</p>
      {/* ⛔ 지연이 서버 판정이 아니라는 사실을 값 옆에 상시 둔다(omf-mes#265). */}
      <p>{t.delayReference}</p>

      <Table
        density="compact"
        caption={t.title}
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.workOrderId)}
        sort={toTableSort(sort)}
        onSortChange={(next) => {
          if (next !== null) onSort(next.key as SortKey);
        }}
        empty={<EmptyState title={t.empty} />}
      />
    </section>
  );
};
