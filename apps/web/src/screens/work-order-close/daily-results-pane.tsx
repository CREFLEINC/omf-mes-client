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
  Tooltip,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type JSX } from 'react';

import { ApiRequestError, toApiError } from '../../patterns/request';
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
      /** 교대가 하나뿐인 날은 그 교대 이름을 날짜 줄에 보인다. 둘 이상이면 null */
      shiftName: string | null;
      shiftCount: number;
      /** 교대가 둘 이상일 때만 펼칠 수 있다. 하나뿐이면 날짜 줄과 같은 값이라 펼칠 것이 없다. */
      expandable: boolean;
      isExpanded: boolean;
    })
  | (DailyQuantities & { kind: 'shift'; id: string; workDate: string; shiftName: string });

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
      shiftName: item.byShift.length === 1 ? item.byShift[0]!.shiftName : null,
      shiftCount: item.byShift.length,
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
        workDate: item.workDate,
        shiftName: shift.shiftName,
        ...quantitiesOf(shift),
      })),
    ];
  });

export type WorkOrderCloseDailyLoadCause = 'forbidden' | 'offline' | 'other';

/**
 * 불러오기 실패의 원인. 권한 없음은 정규화 전 상태 코드로 본다 — 서버가 403을 오류 봉투(`errors[]`)에
 * 담아 보내면 정규화가 그것을 검증 오류로 접으며 상태 코드를 버리기 때문이다.
 * 연결 끊김은 응답이 없는 실패라 정규화 결과(network)로 판정할 수 있다.
 */
export const toWorkOrderCloseDailyLoadCause = (error: unknown): WorkOrderCloseDailyLoadCause => {
  if (error instanceof ApiRequestError && error.httpStatus === 403) return 'forbidden';
  return toApiError(error).kind === 'network' ? 'offline' : 'other';
};

const CorrectedChip = ({ count }: { count: number }) =>
  count > 0 ? (
    <Chip variant="status" status="info" size="sm">
      <span className="work-order-close-table-caption">{`${t.values.correctedPrefix} `}</span>
      {t.values.corrected(count)}
    </Chip>
  ) : null;

export type WorkOrderCloseDailyResultsState =
  | { kind: 'CHECKING' }
  /** 처음 불러오기 실패. 권한 없음(403)은 다시 시도해도 같은 답이라 조치를 두지 않는다. */
  | { kind: 'UNAVAILABLE'; cause: WorkOrderCloseDailyLoadCause; onRetry: () => void }
  /** 다시 불러오기에 실패해도 이미 받은 표는 그대로 두고 경고만 더한다. */
  | {
      kind: 'RESOLVED';
      data: WorkOrderCloseDailyResults;
      refetchFailed: boolean;
      onRetry: () => void;
    };

export interface WorkOrderCloseDailyResultsPaneProps {
  state: WorkOrderCloseDailyResultsState;
  /** 요약 구획과 같은 단위 표기. 단위 목록에서 찾지 못하면 null이고 응답의 단위 코드를 쓴다. */
  unitLabel: string | null;
}

const PaneTitle = () => <h2 className="pane-title">{t.pane}</h2>;

/**
 * 일자별 실적 표. 읽기 전용 구획이고 마감 판단과 동작은 바꾸지 않는다.
 * 수량은 서버가 정정을 반영해 준 값을 그대로 보인다(정정된 원본 제외). 합계 행은 응답의 `totals`다.
 */
export const WorkOrderCloseDailyResultsPane = ({
  state,
  unitLabel,
}: WorkOrderCloseDailyResultsPaneProps): JSX.Element => {
  const [expandedDates, setExpandedDates] = useState<ReadonlySet<string>>(() => new Set());

  if (state.kind === 'CHECKING') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-daily-pane">
        <PaneTitle />
        <div aria-label={t.loading} role="status">
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  if (state.kind === 'UNAVAILABLE') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-daily-pane">
        <PaneTitle />
        <AlertBanner
          variant="error"
          title={state.cause === 'forbidden' ? messages.httpError.title : t.loadFailedTitle}
          action={
            state.cause === 'forbidden' ? undefined : (
              <Button variant="outlined" size="sm" onClick={state.onRetry}>
                {messages.common.retry}
              </Button>
            )
          }
        >
          {state.cause === 'forbidden'
            ? messages.httpError.forbidden
            : state.cause === 'offline'
              ? `${messages.httpError.offline} ${t.loadFailed}`
              : t.loadFailed}
        </AlertBanner>
      </section>
    );
  }

  const { data } = state;
  const unit = unitLabel ?? data.uomCode;
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
      header: (
        <span className="work-order-close-daily-cell">
          {t.fields.workDate}
          <Tooltip content={t.workDateHint}>
            <button type="button" className="info-mark" aria-label={t.workDateHintLabel}>
              ⓘ
            </button>
          </Tooltip>
        </span>
      ),
      render: (row) =>
        row.kind === 'shift' ? (
          /* 교대 줄은 날짜를 되풀이해 보이지 않되, 보조기기에는 어느 날의 교대인지 읽힌다. */
          <span className="work-order-close-daily-cell" data-shift-row="true">
            <span className="work-order-close-daily-spacer" aria-hidden="true" />
            <span className="work-order-close-table-caption">{row.workDate}</span>
          </span>
        ) : (
          <span className="work-order-close-daily-cell">
            {row.expandable ? (
              <button
                type="button"
                className="work-order-close-daily-toggle"
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
              <span className="work-order-close-daily-spacer" aria-hidden="true" />
            )}
            {row.workDate}
          </span>
        ),
    },
    {
      key: 'shift',
      header: t.fields.shift,
      render: (row) =>
        row.kind === 'shift'
          ? row.shiftName
          : (row.shiftName ?? t.values.shiftCount(row.shiftCount)),
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
  const total = (key: keyof Omit<DailyQuantities, 'correctedCount'>): SummaryCell => ({
    key,
    content: String(totals[key]),
    align: 'end',
    emphasis: true,
  });
  const summaryRows: SummaryCell[][] =
    data.items.length === 0
      ? []
      : [
          [
            { key: 'label', content: t.values.total, colSpan: 2, emphasis: true },
            total('goodQty'),
            total('defectQty'),
            total('holdQty'),
            total('scrapQty'),
            total('reworkQty'),
            total('resultCount'),
            { key: 'corrected', content: <CorrectedChip count={totals.correctedCount} /> },
          ],
        ];

  return (
    <section aria-label={t.pane} className="pane work-order-close-daily-pane">
      <div className="work-order-close-daily-head">
        <PaneTitle />
        <dl className="work-order-close-daily-facts">
          <div>
            <dt>{t.values.orderQty}</dt>
            <dd>{String(data.orderQty)}</dd>
          </div>
          <div>
            <dt>{t.values.unit}</dt>
            <dd>{unit}</dd>
          </div>
        </dl>
      </div>
      <p className="pane-lead">{t.lead}</p>
      {state.refetchFailed ? (
        <AlertBanner
          variant="warning"
          action={
            <Button variant="outlined" size="sm" onClick={state.onRetry}>
              {messages.common.retry}
            </Button>
          }
        >
          {t.refetchFailed}
        </AlertBanner>
      ) : null}
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
