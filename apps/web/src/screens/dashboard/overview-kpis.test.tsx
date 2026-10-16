import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { toEquipmentView } from './equipment';
import { OverviewKpis, auxNoteLines } from './overview-kpis';
import type { DashboardCardView } from './types';

const k = messages.dashboard.kpi;

const card = (overrides: Partial<DashboardCardView>): DashboardCardView => ({
  cardCode: 'PRODUCTION_QTY',
  label: '금일 총생산',
  value: 4321,
  unit: 'EA',
  deltaRatio: null,
  note: null,
  valueStatusCode: 'AVAILABLE',
  excludedCount: null,
  ...overrides,
});

const cards = [
  card({}),
  card({ cardCode: 'AVAILABILITY_RATE', label: '가동률', value: 81.2, unit: '%' }),
  card({ cardCode: 'PERFORMANCE_RATE', label: '성능률', value: 92.5, unit: '%' }),
  card({ cardCode: 'YIELD_RATE', label: '양품률', value: 96.4, unit: '%' }),
  card({ cardCode: 'OEE', label: 'OEE', value: 0, unit: '%', valueStatusCode: 'NOT_YET' }),
  card({ cardCode: 'UNHANDLED_ALARM', label: '미처리 알람', value: 2, unit: '건' }),
];

const equipment = toEquipmentView({
  asOf: '2026-10-16T03:00:00Z',
  statusCounts: { RUNNING: 5, STOPPED: 1, WAITING: 0, CHANGEOVER: 1, IDLE: 0 },
  items: [],
});

const renderKpis = (production: Parameters<typeof OverviewKpis>[0]['production']) =>
  render(
    <MemoryRouter>
      <OverviewKpis
        cards={cards}
        equipment={equipment}
        production={production}
        asOfTime="09:20"
        isLoading={false}
        axes={new URLSearchParams()}
        routes={{}}
      />
    </MemoryRouter>,
  );

describe('OverviewKpis', () => {
  it('가동/전체 · 상태 태그 · 가동률 · 총생산(아래 NG) · 종합 불량률은 production 섹션 값', () => {
    renderKpis({ totalQty: 4321, goodQty: 4200, ngQty: 97, holdQty: 24, defectRate: 2.6 });

    expect(screen.getByRole('group', { name: k.runningOfTotal })).toHaveTextContent('5 / 7');
    expect(
      screen.getByText(`${messages.dashboard.equipment.status.STOPPED} 1`),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '가동률' })).toHaveTextContent('81.2');
    expect(screen.getByRole('group', { name: '금일 총생산' })).toHaveTextContent(k.ngLine('97'));
    expect(screen.getByRole('group', { name: k.defectRate })).toHaveTextContent('2.6');
  });

  it('보조 열 — 성능률(표준 C/T 기준) · 양품률 · OEE(값 없음은 0이 아님) · 미처리 알람 · 총 NG · 최근 갱신', () => {
    renderKpis({ totalQty: 4321, goodQty: 4200, ngQty: 97, holdQty: 24, defectRate: 2.6 });

    expect(screen.getByText(k.performance)).toBeInTheDocument();
    expect(screen.getByText(k.performanceNote)).toBeInTheDocument();
    expect(screen.getByText('양품률')).toBeInTheDocument();
    expect(screen.getByText(messages.dashboard.cards.notYet)).toBeInTheDocument();
    expect(screen.getByText('미처리 알람')).toBeInTheDocument();
    expect(screen.getByText(k.totalNg).closest('div')).toHaveTextContent('97');
    expect(screen.getByText('09:20')).toBeInTheDocument();
  });

  it('음수 NG 도 깎지 않고 그대로, production 섹션이 없으면 종합 불량률 · 총 NG 만 「—」', () => {
    const { unmount } = renderKpis({
      totalQty: 10,
      goodQty: 15,
      ngQty: -5,
      holdQty: 0,
      defectRate: null,
    });
    expect(screen.getByText(k.totalNg).closest('div')).toHaveTextContent('-5');
    unmount();

    renderKpis(null);
    expect(screen.getByRole('group', { name: k.defectRate })).toHaveTextContent(k.none);
    expect(screen.getByText(k.totalNg).closest('div')).toHaveTextContent(k.none);
    expect(screen.getByRole('group', { name: '가동률' })).toHaveTextContent('81.2');
  });

  it('성능률의 「표준 C/T 기준」은 서버 설명이 없을 때만 — 서버 설명이 오면 한 번만 보인다', () => {
    const performance = card({ cardCode: 'PERFORMANCE_RATE', label: '성능률', note: null });

    expect(auxNoteLines(performance)).toEqual([k.performanceNote]);
    expect(auxNoteLines({ ...performance, note: '서버 설명' })).toEqual(['서버 설명']);
    expect(auxNoteLines(card({ cardCode: 'OEE', label: 'OEE', note: '서버 설명' }))).toEqual([
      '서버 설명',
    ]);
  });
});
