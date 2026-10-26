import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  Icon,
  SkeletonText,
  type SummaryCell,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type JSX } from 'react';

import type { WorkOrderCloseDailyResults } from './queries';

const t = messages.workOrderClose.dailyResults;

type DailyResult = WorkOrderCloseDailyResults['items'][number];

interface DailyQuantities {
  goodQty: number;
  defectQty: number;
  holdQty: number;
  scrapQty: number;
  reworkQty: number;
  resultCount: number;
  correctedCount: number;
}

export type WorkOrderCloseDailyRow =
  | (DailyQuantities & {
      kind: 'day';
      id: string;
      workDate: string;
      /** 교대가 둘 이상일 때만 펼칠 수 있다. 하나뿐이면 날짜 줄과 같은 값이라 펼칠 것이 없다. */
      expandable: boolean;
      isExpanded: boolean;
    })
  | (DailyQuantities & { kind: 'shift'; id: string; shiftName: string });

const quantitiesOf = (source: DailyQuantities): DailyQuantities => ({
  goodQty: source.goodQty,
  defectQty: source.defectQty,
  holdQty: source.holdQty,
  scrapQty: source.scrapQty,
  reworkQty: source.reworkQty,
  resultCount: source.resultCount,
  correctedCount: source.correctedCount,
});

/** 날짜 줄과, 펼친 날의 교대 줄을 서버가 준 순서대로 한 줄로 편다. */
export const toWorkOrderCloseDailyRows = (
  items: readonly DailyResult[],
  expandedDates: ReadonlySet<string>,
): WorkOrderCloseDailyRow[] =>
  items.flatMap((item) => {
    const expandable = item.byShift.length > 1;
    const isExpanded = expandable && expandedDates.has(item.workDate);
    const day: WorkOrderCloseDailyRow = {
      kind: 'day',
      id: item.workDate,
      workDate: item.workDate,
      expandable,
      isExpanded,
      ...quantitiesOf(item),
    };
    if (!isExpanded) return [day];

    return [
      day,
      ...item.byShift.map((shift, index): WorkOrderCloseDailyRow => ({
        kind: 'shift',
        id: `${item.workDate}:${shift.shiftId === null ? 'none' : String(shift.shiftId)}:${String(index)}`,
        shiftName: shift.shiftName,
        ...quantitiesOf(shift),
      })),
    ];
  });

const CorrectedChip = ({ count }: { count: number }) =>
  count > 0 ? (
    <Chip variant="status" status="info" size="sm">
      {t.values.corrected(count)}
    </Chip>
  ) : null;

export type WorkOrderCloseDailyResultsState =
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE'; onRetry: () => void }
  | { kind: 'RESOLVED'; data: WorkOrderCloseDailyResults };

export interface WorkOrderCloseDailyResultsPaneProps {
  state: WorkOrderCloseDailyResultsState;
}

/**
 * 일자별 실적 표 (omf-all-around#81). 읽기 전용 구획이고 마감 판단과 동작은 바꾸지 않는다.
 * 수량은 서버가 정정을 반영해 준 값을 그대로 보인다(정정된 원본 제외). 합계 행은 응답의 `totals`다.
 */
export const WorkOrderCloseDailyResultsPane = ({
  state,
}: WorkOrderCloseDailyResultsPaneProps): JSX.Element => {
  const [expandedDates, setExpandedDates] = useState<ReadonlySet<string>>(() => new Set());

  if (state.kind === 'CHECKING') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-daily-pane">
        <h2 className="pane-title">{t.pane}</h2>
        <div aria-label={t.loading} role="status">
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  if (state.kind === 'UNAVAILABLE') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-daily-pane">
        <h2 className="pane-title">{t.pane}</h2>
        <AlertBanner
          variant="error"
          title={messages.httpError.loadTitle}
          action={
            <Button variant="outlined" size="sm" onClick={state.onRetry}>
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      </section>
    );
  }

  const { data } = state;
  const toggle = (workDate: string): void =>
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(workDate)) next.delete(workDate);
      else next.add(workDate);
      return next;
    });
  const quantityColumn = (
    key: keyof Omit<DailyQuantities, 'correctedCount'>,
  ): Column<WorkOrderCloseDailyRow> => ({
    key,
    header: t.fields[key],
    align: 'end',
    render: (row) => String(row[key]),
  });
  const columns: Column<WorkOrderCloseDailyRow>[] = [
    {
      key: 'workDate',
      header: t.fields.workDate,
      render: (row) =>
        row.kind === 'shift' ? (
          <span className="po-board-tree-cell" data-shift-row="true">
            <span className="po-board-tree-spacer" aria-hidden="true" />
            {row.shiftName}
          </span>
        ) : (
          <span className="po-board-tree-cell">
            {row.expandable ? (
              <button
                type="button"
                className="po-board-tree-toggle"
                aria-expanded={row.isExpanded}
                aria-label={
                  row.isExpanded ? t.actions.collapse(row.workDate) : t.actions.expand(row.workDate)
                }
                onClick={() => {
                  toggle(row.workDate);
                }}
              >
                <Icon name="expand_more" size={20} />
              </button>
            ) : (
              <span className="po-board-tree-spacer" aria-hidden="true" />
            )}
            {row.workDate}
          </span>
        ),
    },
    quantityColumn('goodQty'),
    quantityColumn('defectQty'),
    quantityColumn('holdQty'),
    quantityColumn('scrapQty'),
    quantityColumn('reworkQty'),
    quantityColumn('resultCount'),
    {
      key: 'correctedCount',
      header: t.fields.corrected,
      render: (row) => <CorrectedChip count={row.correctedCount} />,
    },
  ];
  const { totals } = data;
  const summaryRows: SummaryCell[][] =
    data.items.length === 0
      ? []
      : [
          [
            { key: 'label', content: t.values.total, emphasis: true },
            { key: 'goodQty', content: String(totals.goodQty), align: 'end', emphasis: true },
            { key: 'defectQty', content: String(totals.defectQty), align: 'end', emphasis: true },
            { key: 'holdQty', content: String(totals.holdQty), align: 'end', emphasis: true },
            { key: 'scrapQty', content: String(totals.scrapQty), align: 'end', emphasis: true },
            { key: 'reworkQty', content: String(totals.reworkQty), align: 'end', emphasis: true },
            {
              key: 'resultCount',
              content: String(totals.resultCount),
              align: 'end',
              emphasis: true,
            },
            { key: 'corrected', content: <CorrectedChip count={totals.correctedCount} /> },
          ],
          [
            { key: 'label', content: t.values.orderQty },
            { key: 'orderQty', content: String(data.orderQty), align: 'end' },
            { key: 'rest', content: null, colSpan: 6 },
          ],
        ];

  return (
    <section aria-label={t.pane} className="pane work-order-close-daily-pane">
      <div className="work-order-close-daily-head">
        <h2 className="pane-title">{t.pane}</h2>
        <span className="work-order-close-daily-unit">{t.unit(data.uomCode)}</span>
      </div>
      <div className="work-order-close-daily-table">
        <Table
          density="compact"
          caption={<span className="work-order-close-table-caption">{t.pane}</span>}
          columns={columns}
          rows={toWorkOrderCloseDailyRows(data.items, expandedDates)}
          getRowId={(row) => row.id}
          sort={null}
          zebra={false}
          summaryRows={summaryRows}
          empty={<EmptyState size="sm" title={t.empty} />}
        />
      </div>
    </section>
  );
};
