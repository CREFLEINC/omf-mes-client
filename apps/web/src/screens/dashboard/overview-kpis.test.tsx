import { messages } from '@omf-mes/i18n';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toEquipmentView } from './equipment';
import { OverviewKpis, availabilityBasis, auxInfoOf } from './overview-kpis';
import type { DashboardCardView } from './types';
import { INFO_TIP_CLICK_CLOSE_MS } from './viz';

const k = messages.dashboard.kpi;
const v = messages.dashboard.viz;

const card = (overrides: Partial<DashboardCardView>): DashboardCardView => ({
  cardCode: 'PRODUCTION_QTY',
  label: '생산 수량',
  value: 4321,
  unit: 'EA',
  deltaRatio: null,
  note: null,
  valueStatusCode: 'AVAILABLE',
  excludedCount: null,
  ...overrides,
});

const AVAILABILITY_NOTE = '계획 가동시간 기준입니다(시험 설명). 작업한 설비 7대.';
const OEE_NOTE = '표준 C/T 기준 근사값입니다.';
const ALARM_NOTE = '내가 읽지 않은 알림 기준입니다 — 공장 조건은 적용되지 않습니다.';

const cards = [
  card({ deltaRatio: 0 }),
  card({
    cardCode: 'AVAILABILITY_RATE',
    label: '시간가동률',
    value: 81.2,
    unit: '%',
    note: AVAILABILITY_NOTE,
  }),
  card({ cardCode: 'PERFORMANCE_RATE', label: '성능률', value: 92.5, unit: '%', note: OEE_NOTE }),
  card({ cardCode: 'YIELD_RATE', label: '양품률', value: 96.4, unit: '%' }),
  card({ cardCode: 'OEE', label: 'OEE', value: 47.9, unit: '%', note: OEE_NOTE }),
  card({
    cardCode: 'UNHANDLED_ALARM',
    label: '미처리 알람',
    value: 2,
    unit: '건',
    note: ALARM_NOTE,
  }),
];

const equipment = toEquipmentView({
  asOf: '2026-10-16T03:00:00Z',
  statusCounts: { RUNNING: 5, STOPPED: 1, WAITING: 0, CHANGEOVER: 1, IDLE: 0 },
  items: [],
});

const renderKpis = (
  production: Parameters<typeof OverviewKpis>[0]['production'],
  list: DashboardCardView[] = cards,
) =>
  render(
    <MemoryRouter>
      <OverviewKpis
        cards={list}
        equipment={equipment}
        production={production}
        isLoading={false}
        axes={new URLSearchParams()}
        routes={{}}
      />
    </MemoryRouter>,
  );

const PRODUCTION = { totalQty: 4321, goodQty: 4200, ngQty: 112, holdQty: 9, defectRate: 2.6 };

/** KPI 띠 문구 · 밀도(사용자 지시 2026-10-16) — 긴 설명은 툴팁, 칸에는 짧은 한 줄. 「NG」를 쓰지 않는다. */
describe('OverviewKpis', () => {
  it('가동 설비 · 상태 태그 · 시간가동률(짧은 기준 줄) · 생산 수량(불량 · 전일 대비) · 종합 불량률', () => {
    renderKpis(PRODUCTION);

    expect(screen.getByRole('group', { name: k.runningOfTotal })).toHaveTextContent('5 / 7');
    expect(
      screen.getByText(`${messages.dashboard.equipment.status.STOPPED} 1`),
    ).toBeInTheDocument();
    const availability = screen.getByRole('group', { name: '시간가동률' });
    /* 이름과 숫자 사이는 붙는 칸(U+00A0) — 화면 글자를 비교할 때는 보통 칸으로 본다. */
    expect(availability).toHaveTextContent(
      `${k.availabilityBasis} · ${k.workedEquipment('7')}`.replace(/\u00a0/g, ' '),
    );
    /* 서버 설명 원문은 칸에 펼치지 않는다(툴팁으로). 「금일 누계」는 「금일」 표시와 겹쳐 없앴다. */
    expect(availability).not.toHaveTextContent('시험 설명');
    expect(availability).not.toHaveTextContent('누계');
    const production = screen.getByRole('group', { name: '생산 수량' });
    expect(production).toHaveTextContent(k.defectLine('112'));
    expect(production).toHaveTextContent(messages.dashboard.cards.deltaFlat);
    expect(screen.getByRole('group', { name: k.defectRate })).toHaveTextContent(k.defectRateNote);
  });

  it('⛔ KPI 띠에는 「NG」 · 「최근 갱신」이 없다', () => {
    const { container } = renderKpis(PRODUCTION);

    expect(container.textContent).not.toContain('NG');
    expect(container.textContent).not.toContain('최근 갱신');
  });

  it('보조 목록 — 성능률 · 양품률 · OEE(설비종합효율) · 미확인 알림(전체 공장) · 총 불량, 근사값엔 「추정」', () => {
    renderKpis(PRODUCTION);

    expect(screen.getByText(k.performance)).toBeInTheDocument();
    expect(screen.getByText(k.oee)).toBeInTheDocument();
    expect(screen.getAllByText(k.estimated)).toHaveLength(2);
    expect(screen.getByText(k.myUnreadAlerts)).toBeInTheDocument();
    expect(screen.getByText(k.allPlants)).toBeInTheDocument();
    expect(screen.getByText(k.totalDefect).closest('div')).toHaveTextContent('112');
  });

  it('설명 단추를 올리면 서버 설명 원문이 툴팁으로 나온다 — 정보가 사라지지 않는다', async () => {
    const user = userEvent.setup();
    renderKpis(PRODUCTION);

    await user.hover(screen.getByRole('button', { name: v.infoLabel(k.myUnreadAlerts) }));
    /* 문장마다 한 줄로 선다 — 글은 그대로 이어진다. */
    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toBe(k.myUnreadAlertsTip.replace(/(?<=\.)\s+/g, ''));
    expect(tip.querySelectorAll('.dash-tip-line')).toHaveLength(2);
  });

  describe('설명 단추를 누르면', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('열리고 3초 뒤 스스로 닫힌다 · 열려 있을 때 다시 누르면 바로 닫힌다', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      renderKpis(PRODUCTION);
      const button = screen.getByRole('button', { name: v.infoLabel(k.oee) });

      await user.click(button);
      expect(await screen.findByText(k.oeeTip)).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(INFO_TIP_CLICK_CLOSE_MS));
      expect(screen.queryByText(k.oeeTip)).not.toBeInTheDocument();

      await user.click(button);
      expect(await screen.findByText(k.oeeTip)).toBeInTheDocument();
      await user.click(button);
      expect(screen.queryByText(k.oeeTip)).not.toBeInTheDocument();
    });
  });

  it('시간가동률 · 종합 불량률 툴팁은 사용자 지정 문구 — 서버 설명 원문 · 계산식이 아니다', async () => {
    const user = userEvent.setup();
    renderKpis(PRODUCTION);

    await user.hover(screen.getByRole('button', { name: v.infoLabel('시간가동률') }));
    expect(await screen.findByText(k.availabilityTip)).toBeInTheDocument();
    expect(screen.queryByText(AVAILABILITY_NOTE)).not.toBeInTheDocument();
    await user.unhover(screen.getByRole('button', { name: v.infoLabel('시간가동률') }));

    await user.hover(screen.getByRole('button', { name: v.infoLabel(k.defectRate) }));
    expect(await screen.findByText(k.defectRateTip)).toBeInTheDocument();
  });

  it('설명 원문 · 기준 줄 계산', () => {
    /* ⭐ 성능률 · OEE · 미확인 알림은 사용자 지정 문구, 그 밖은 서버 원문. */
    expect(auxInfoOf(card({ cardCode: 'PERFORMANCE_RATE', note: null }))).toBe(k.performanceTip);
    expect(auxInfoOf(card({ cardCode: 'OEE', note: OEE_NOTE }))).toBe(k.oeeTip);
    expect(auxInfoOf(card({ cardCode: 'UNHANDLED_ALARM', note: ALARM_NOTE }))).toBe(
      k.myUnreadAlertsTip,
    );
    expect(auxInfoOf(card({ cardCode: 'YIELD_RATE', note: '서버 설명' }))).toBe('서버 설명');
    expect(availabilityBasis(card({ note: null }))).toBeUndefined();
    expect(availabilityBasis(card({ note: '대수 없는 설명' }))).toBe(k.availabilityBasis);
  });

  it('음수 불량도 깎지 않고 그대로, production 섹션이 없으면 종합 불량률 · 총 불량만 「—」', () => {
    const { unmount } = renderKpis({ ...PRODUCTION, ngQty: -5, defectRate: null });
    expect(screen.getByText(k.totalDefect).closest('div')).toHaveTextContent('-5');
    unmount();

    renderKpis(null);
    expect(screen.getByRole('group', { name: k.defectRate })).toHaveTextContent(k.none);
    expect(screen.getByText(k.totalDefect).closest('div')).toHaveTextContent(k.none);
    expect(
      within(screen.getByRole('group', { name: '시간가동률' })).getByText('81.2'),
    ).toBeInTheDocument();
  });
});
