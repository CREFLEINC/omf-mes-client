import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DayBadge } from './day-badge';
import { statusLabel } from './day-badge';
import { byDate, dayStatusOf, partialHours, type WorkCalendarDay } from './day-status';
import {
  buildMonthWeeks,
  dayOfMonth,
  shiftMonth,
  type MonthWeek,
  type YearMonth,
} from './month-grid';

const t = messages.workCalendar.grid;
const bulkText = messages.workCalendar.bulk;

export interface MonthGridPaneProps {
  /** 고른 캘린더의 이름. 아직 안 골랐으면 `null` */
  calendarName: string | null;
  /** 고른 캘린더의 이름·코드를 고치러 간다. 아직 안 골랐으면 부를 자리가 없다 */
  onEditCalendar: () => void;
  yearMonth: YearMonth;
  onChangeMonth: (next: YearMonth) => void;
  /** 이 달의 일자 설정. **설정이 있는 날만 온다** */
  days: readonly WorkCalendarDay[];
  isLoading: boolean;
  /** 그 날의 설정을 고치러 간다. **칸이 곧 손잡이다** */
  onPickDay: (date: string) => void;
  /** 여러 날을 한 번에 고치러 간다. **규칙이 아니라 날짜 목록을 보내는 자리다** */
  onBulkApply: () => void;
  loadError: ReactNode;
}

/**
 * 한 달을 펼친 그리드.
 *
 * ⭐ **날짜 선택기가 아니다**(스펙 §5). 칸마다 상태가 칠해지고, 뒤 슬라이스에서 그 칸을 눌러
 * 고치게 된다 — 그래서 「고른 날 하나」가 아니라 **한 달 전체가 늘 보이는** 모양이다.
 *
 * ⭐ **주를 행으로, 요일을 열로 둔다.** 디자인 시스템 `Table` 7열에 셀 렌더를 붙이는 것이
 * 새 부품을 만드는 것보다 낫다 — 머리글·스크롤·빈 상태를 이미 갖고 있다.
 */
export const MonthGridPane = ({
  calendarName,
  onEditCalendar,
  yearMonth,
  onChangeMonth,
  days,
  isLoading,
  onPickDay,
  onBulkApply,
  loadError,
}: MonthGridPaneProps) => {
  const byDay = byDate(days);

  const columns: Column<MonthWeek>[] = t.weekdays.map((label, index) => ({
    key: `weekday-${String(index)}`,
    header: label,
    render: (week) => {
      const cell = week.cells[index];
      const date = cell?.date ?? null;

      /*
       * ⭐ **이웃 달의 날짜를 그리지 않는다.** 흐리게라도 그리면 그 칸을 눌러 고칠 수 있다고
       * 읽히는데, 이 화면은 한 달만 받아 오므로 그 날의 지금 설정을 모른다.
       */
      if (date === null) return null;

      const day = byDay.get(date);
      const hours = partialHours(day);

      /*
       * ⭐ **칸 전체가 손잡이다** — 날짜 숫자만 누를 수 있게 두면 표적이 작아 잘못 누르기 쉽고,
       * 「이 칸을 고칠 수 있다」는 사실도 드러나지 않는다.
       * 접근 이름에 날짜와 지금 상태를 함께 담는다 — 눌러 보지 않고도 무엇을 여는지 알아야 한다.
       */
      return (
        <button
          type="button"
          className="calendar-cell"
          aria-label={t.pickDay(date, statusLabel(dayStatusOf(day)))}
          onClick={() => onPickDay(date)}
        >
          <span className="calendar-cell-date">{dayOfMonth(date)}</span>
          <DayBadge status={dayStatusOf(day)} />
          {/* 부분 가동의 시각은 상태만으로 알 수 없는 사실이라 함께 낸다. */}
          {hours !== null && <span className="field-note">{hours}</span>}
        </button>
      );
    },
  }));

  const gridSlot = (): ReactNode => {
    if (calendarName === null) {
      return <EmptyState size="sm" live title={t.title} description={t.pickCalendar} />;
    }

    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={5} />
        </div>
      );
    }

    return (
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={buildMonthWeeks(yearMonth)}
          getRowId={(week) => week.key}
        />
      </div>
    );
  };

  return (
    <section className="pane" aria-label={t.title}>
      <div className="filter-bar">
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button variant="outlined" onClick={() => onChangeMonth(shiftMonth(yearMonth, -1))}>
              {t.previousMonth}
            </Button>
            <Button variant="outlined" onClick={() => onChangeMonth(shiftMonth(yearMonth, 1))}>
              {t.nextMonth}
            </Button>
          </div>
        </div>
        {/* 지금 무슨 달을 보고 있는지 — 앞뒤로 옮기다 보면 금세 잃는다. */}
        <div className="field-cell field-cell-unlabeled">
          <strong>{t.monthLabel(yearMonth.year, yearMonth.month)}</strong>
        </div>
        {calendarName !== null && (
          <div className="field-cell field-cell-unlabeled">
            <span className="field-note">{calendarName}</span>
          </div>
        )}
        {/*
         * ⭐ **수정은 고른 캘린더의 것이다** — 목록 줄마다 단추를 세우지 않고 여기 한 자리에
         * 둔다. 무엇을 고치는지가 옆의 이름으로 드러난다.
         */}
        {calendarName !== null && (
          <div className="field-cell field-cell-unlabeled">
            <div className="filter-actions">
              <Button variant="outlined" onClick={onBulkApply}>
                {bulkText.open}
              </Button>
              <Button variant="outlined" onClick={onEditCalendar}>
                {messages.workCalendar.actions.editCalendar}
              </Button>
            </div>
          </div>
        )}
      </div>

      {gridSlot()}
    </section>
  );
};
