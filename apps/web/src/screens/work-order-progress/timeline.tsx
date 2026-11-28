import { AlertBanner, Button, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type CSSProperties, useLayoutEffect, useRef } from 'react';

import { ROW_PICK_CLASS, rowPickHandlers } from '../../patterns/row-pick';
import { splitCodeName } from '../../patterns/split-code-name';

import type { WorkOrderRow } from './row-view';
import { StatusChip } from './status-chips';
import {
  basisPosition,
  centeringShift,
  dayLabel,
  type TimelineAxis,
  type TimelineSpan,
  toTimelineBar,
} from './timeline-model';

const t = messages.workOrderProgress.timeline;
const list = messages.workOrderProgress.list;

export interface WorkOrderTimelineProps {
  rows: WorkOrderRow[];
  /** 날짜 축 — 조회 기간의 날들. `null` 이면 기간이 막힌 것이라 그릴 것이 없다. */
  axis: TimelineAxis | null;
  /** 화면이 보이고 있는 기준 시각 — 기준선과 지연 구간의 끝이다(L-5). */
  basisAt: Date;
  isLoading: boolean;
  isError: boolean;
  itemLabel: (itemIdText: string) => string;
  statusLabel: (statusCode: string) => string;
  onSelect: (workOrderId: number) => void;
  selectedWorkOrderId?: number | null;
}

const spanStyle = (span: TimelineSpan): CSSProperties => ({
  left: `${String(span.left)}%`,
  width: `${String(span.width)}%`,
});

/** 막대를 글로 읽는 말 — 화면 읽기 도구가 읽고, 마우스를 올리면 보인다. */
const scheduleText = (row: WorkOrderRow): string => {
  if (row.plannedStartAt === undefined) return t.noSchedule;

  return row.plannedEndAt === undefined
    ? t.plannedFrom(row.plannedStartAtText)
    : t.planned(row.plannedStartAtText, row.plannedEndAtText);
};

const barClass = (row: WorkOrderRow): string => {
  if (row.isFinished) return 'work-order-progress-tl-bar is-finished';

  return row.isReleased ? 'work-order-progress-tl-bar' : 'work-order-progress-tl-bar is-waiting';
};

const LEGEND = [
  { key: 'plan', label: t.legendPlan },
  { key: 'done', label: t.legendDone },
  { key: 'waiting', label: t.legendWaiting },
  { key: 'late', label: t.legendLate },
  { key: 'now', label: t.legendNow },
] as const;

/**
 * 일정 보기 — 표와 같은 조회 결과를 날짜 축에 그린다.
 *
 * - **계획 구간**이 막대, **만든 비율**(달성률)이 막대 안의 진한 부분이다.
 * - **계획 종료를 넘긴** 지시는 넘긴 만큼 빗금이 기준 시각까지 이어진다.
 * - **배포 전** 지시는 점선 막대다 — 아직 현장에 나가지 않았다.
 * - 줄 순서는 계획 시작 순이다(조회가 그 순서로 받는다).
 *
 * ⛔ **전부 읽기 전용이다.** 막대를 끌어 일정을 고치지 않는다 — 줄을 누르면 표와 같은 상세 창이 열린다.
 *
 * 날 하나의 폭에는 아랫값이 있다. 기간이 길어 화면에 다 들어가지 않으면 축이 옆으로 구르고,
 * W/O 번호부터 달성률까지는 왼쪽에 붙어 남는다. 열면 기준 시각이 보이는 축의 가운데에 오게 옮겨 둔다
 * (사용자 지시 2026-11-28).
 *
 * 표로 그린다(`<table>`) — 줄 고르기(`rowPickHandlers`)와 고른 줄 칠하기를 표와 똑같이 쓴다.
 */
export const WorkOrderTimeline = ({
  rows,
  axis,
  basisAt,
  isLoading,
  isError,
  itemLabel,
  statusLabel,
  onSelect,
  selectedWorkOrderId = null,
}: WorkOrderTimelineProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const basisMs = basisAt.getTime();
  const nowAt = axis === null ? null : basisPosition(axis, basisMs);
  const dayCount = axis?.days.length ?? 0;

  /* 기준 시각을 보이는 축의 가운데로 — 앞뒤 일정을 같은 폭으로 본다. */
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    /* 붙어 남는 마지막 칸(달성률)의 오른쪽 끝이 보이는 축의 왼쪽 끝이다. */
    const lastInfo = scroller?.querySelector(
      'thead .work-order-progress-tl-track',
    )?.previousElementSibling;
    const basisLine = scroller?.querySelector('.work-order-progress-tl-now');
    if (scroller == null || lastInfo == null || basisLine == null) return;

    const shift = centeringShift(
      basisLine.getBoundingClientRect().left,
      lastInfo.getBoundingClientRect().right,
      scroller.getBoundingClientRect().right,
    );
    scroller.scrollLeft = Math.max(0, scroller.scrollLeft + shift);
  }, [nowAt, dayCount, rows.length]);

  if (isError) {
    return (
      <section className="pane work-order-progress-pane" aria-label={t.title}>
        <div className="banner-slot">
          <AlertBanner variant="error">{list.loadError}</AlertBanner>
        </div>
      </section>
    );
  }

  const nowLine =
    nowAt === null ? null : (
      <span
        aria-hidden="true"
        className="work-order-progress-tl-now"
        style={{ left: `${String(nowAt)}%` }}
      />
    );

  return (
    <section className="pane work-order-progress-pane" aria-label={t.title}>
      <ul className="work-order-progress-legend">
        {LEGEND.map((entry) => (
          <li key={entry.key}>
            <span
              aria-hidden="true"
              className={`work-order-progress-legend-mark is-${entry.key}`}
            />
            {entry.label}
          </li>
        ))}
      </ul>

      {isLoading && <p role="status">{list.loading}</p>}

      {axis === null || rows.length === 0 ? (
        <EmptyState title={list.empty} />
      ) : (
        <div className="work-order-progress-tl-scroll" ref={scrollRef} {...rowPickHandlers}>
          <table
            className="work-order-progress-tl"
            style={{ '--work-order-progress-days': dayCount } as CSSProperties}
          >
            <caption>{t.title}</caption>
            <thead>
              <tr>
                <th scope="col">{list.columns.workOrderNo}</th>
                <th scope="col">{list.columns.itemName}</th>
                <th scope="col">{list.columns.process}</th>
                <th scope="col">{list.columns.statusCode}</th>
                <th scope="col">{list.columns.achievementRate}</th>
                <th className="work-order-progress-tl-track" scope="col">
                  <span className="visually-hidden">{t.schedule}</span>
                  <span aria-hidden="true" className="work-order-progress-tl-days">
                    {axis.days.map((day) => (
                      <span key={day}>{dayLabel(day)}</span>
                    ))}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const bar = toTimelineBar(row, axis, basisMs);
                const text = scheduleText(row);

                return (
                  <tr key={row.workOrderId}>
                    <td>
                      <Button
                        aria-current={row.workOrderId === selectedWorkOrderId ? 'true' : undefined}
                        aria-label={list.select(row.workOrderNo)}
                        className={ROW_PICK_CLASS}
                        variant="text"
                        onClick={() => {
                          onSelect(row.workOrderId);
                        }}
                      >
                        {row.workOrderNo}
                      </Button>
                    </td>
                    <td>
                      <span className="work-order-progress-tl-text">
                        {splitCodeName(itemLabel(row.itemIdText), list.blank).name}
                      </span>
                    </td>
                    <td>{row.processText}</td>
                    <td>
                      <StatusChip label={statusLabel(row.statusCode)} statusCode={row.statusCode} />
                    </td>
                    <td>{row.achievementRateText}</td>
                    <td className="work-order-progress-tl-track" title={text}>
                      <span className="visually-hidden">
                        {row.delay === 'delayed' ? `${text} ${list.delayed}` : text}
                      </span>
                      {bar !== null && (
                        <>
                          <span
                            aria-hidden="true"
                            className={barClass(row)}
                            style={spanStyle(bar.plan)}
                          >
                            <span
                              className="work-order-progress-tl-fill"
                              style={{ width: `${String(row.achievementPercent ?? 0)}%` }}
                            />
                          </span>
                          {bar.late !== null && (
                            <span
                              aria-hidden="true"
                              className="work-order-progress-tl-late"
                              style={spanStyle(bar.late)}
                            />
                          )}
                        </>
                      )}
                      {nowLine}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
