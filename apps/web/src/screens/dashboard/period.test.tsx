import { messages } from '@omf-mes/i18n';
import { render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { toEquipmentView } from './equipment';
import { OverviewKpis } from './overview-kpis';
import { periodRangeTitle, SingleDayContext, usePeriodTags } from './period';
import type { DashboardCardView } from './types';

const k = messages.dashboard.kpi;
const c = messages.dashboard.cards;
const q = messages.dashboard.quality;

const withPeriod =
  (single: boolean) =>
  ({ children }: { children: ReactNode }) => (
    <SingleDayContext.Provider value={single}>{children}</SingleDayContext.Provider>
  );

const production: DashboardCardView = {
  cardCode: 'PRODUCTION_QTY',
  label: '생산 수량',
  value: 100,
  unit: 'EA',
  deltaRatio: 0.125,
  note: null,
  valueStatusCode: 'AVAILABLE',
  excludedCount: null,
  notYetReasonCode: null,
};

const renderKpis = (single: boolean) =>
  render(
    <MemoryRouter>
      <SingleDayContext.Provider value={single}>
        <OverviewKpis
          cards={[production]}
          equipment={toEquipmentView({
            asOf: '2026-10-16T03:00:00Z',
            statusCounts: { RUNNING: 1, STOPPED: 0, WAITING: 0, CHANGEOVER: 0, IDLE: 0 },
            items: [],
          })}
          production={null}
          isLoading={false}
          axes={new URLSearchParams()}
          routes={{}}
        />
      </SingleDayContext.Provider>
    </MemoryRouter>,
  );

/** 기간 조회 표기(사용자 확정 2026-10-16) — 하루면 지금 그대로, 이틀 이상이면 「선택 기간」 · 「직전 기간」. */
describe('기간 표기', () => {
  it('KPI 띠 — 하루면 「금일」 · 「전일 대비」', () => {
    renderKpis(true);

    expect(screen.getAllByText(k.tagToday).length).toBeGreaterThan(0);
    expect(screen.getByRole('group', { name: '생산 수량' })).toHaveTextContent(c.deltaUp('12.5%'));
  });

  it('KPI 띠 — 이틀 이상이면 「선택 기간」 · 「직전 기간 대비」, 가동 설비는 「실시간」 그대로', () => {
    renderKpis(false);

    expect(screen.queryByText(k.tagToday)).not.toBeInTheDocument();
    expect(screen.getAllByText(k.tagPeriod).length).toBeGreaterThan(0);
    expect(screen.getByText(k.tagLive)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '생산 수량' })).toHaveTextContent(
      '직전 기간 대비 ↑ 12.5%',
    );
  });

  it('품질 · 부적합 — 하루면 「당월」 · 「전월」, 이틀 이상이면 「선택 기간」 · 「직전 기간」', () => {
    const single = renderHook(() => usePeriodTags(), { wrapper: withPeriod(true) }).result.current;
    expect(single.month).toBe(q.tagMonth);
    expect(single.prev('90%')).toBe('전월 90%');
    expect(single.flat).toBe('전월과 동일');

    const period = renderHook(() => usePeriodTags(), { wrapper: withPeriod(false) }).result.current;
    expect(period.month).toBe('선택 기간');
    expect(period.monthTotal).toBe('선택 기간');
    expect(period.prev('90%')).toBe('직전 기간 90%');
    expect(period.flat).toBe('직전 기간과 동일');
  });
});

/* 품질 종합 기간 이름표 — 마우스 올림 글에 실제 날짜 범위(사용자 지시 2026-10-19). */
describe('periodRangeTitle', () => {
  it('하루 조회 — 금일 · 당월 · 최근 9일, 기간 조회 — 선택 기간, 모르는 이름표는 null', () => {
    const day = { baseDate: '2026-10-19', dateFrom: null, dateTo: null };
    expect(periodRangeTitle(q.tagToday, day)).toBe('금일: 2026.10.19');
    expect(periodRangeTitle(q.tagMonth, day)).toBe('당월: 2026.10.01 ~ 2026.10.19');
    expect(periodRangeTitle(q.dailyRecent, day)).toBe('최근 9일: 2026.10.11 ~ 2026.10.19');
    /* 달이 바뀌는 9일. */
    expect(periodRangeTitle(q.dailyRecent, { ...day, baseDate: '2026-10-03' })).toBe(
      '최근 9일: 2026.09.25 ~ 2026.10.03',
    );
    const span = { baseDate: '2026-10-19', dateFrom: '2026-10-13', dateTo: '2026-10-19' };
    expect(periodRangeTitle(q.tagPeriod, span)).toBe('선택 기간: 2026.10.13 ~ 2026.10.19');
    expect(periodRangeTitle('현재', day)).toBeNull();
  });
});
