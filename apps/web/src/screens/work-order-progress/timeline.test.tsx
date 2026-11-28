import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkOrderRow } from './row-view';
import { WorkOrderTimeline, type WorkOrderTimelineProps } from './timeline';
import { toTimelineAxis } from './timeline-model';

const t = messages.workOrderProgress.timeline;
const list = messages.workOrderProgress.list;

/* 공장 시각 08-01 ~ 08-04, 나흘. 기준 시각은 08-03 12:00 — 축의 62.5% 자리다. */
const AXIS = toTimelineAxis(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
const BASIS = new Date('2026-08-03T12:00:00+07:00');

const row = (overrides: Partial<WorkOrderRow> = {}): WorkOrderRow => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  itemIdText: '5001',
  productionLineIdText: '7',
  processText: '합성 공정',
  orderQtyText: '3,000',
  goodQtyText: '1,950',
  defectQtyText: '10',
  holdQtyText: '0',
  scrapQtyText: '0',
  reworkQtyText: '0',
  hasHoldQty: false,
  hasScrapQty: false,
  hasReworkQty: false,
  achievementRateText: '65%',
  achievementPercent: 65,
  statusCode: 'SYN_RUN',
  plannedStartAt: '2026-08-02T00:00:00+07:00',
  plannedEndAt: '2026-08-03T00:00:00+07:00',
  plannedStartAtText: '2026-08-02 00:00',
  plannedEndAtText: '2026-08-03 00:00',
  isReleased: true,
  isFinished: false,
  delay: 'delayed',
  ...overrides,
});

const renderTimeline = (overrides: Partial<WorkOrderTimelineProps> = {}) => {
  const onSelect = vi.fn();
  const { container } = render(
    <WorkOrderTimeline
      axis={AXIS}
      basisAt={BASIS}
      isError={false}
      isLoading={false}
      itemLabel={(id) => `SYN-ITEM-${id} · 합성 품목`}
      rows={[row()]}
      statusLabel={(code) => (code === 'SYN_RUN' ? '진행중' : code)}
      onSelect={onSelect}
      {...overrides}
    />,
  );

  return {
    onSelect,
    container,
    user: userEvent.setup(),
    region: screen.getByRole('region', { name: t.title }),
    line: () => screen.getByRole('row', { name: /SYN-WO-0007/ }),
  };
};

describe('WorkOrderTimeline', () => {
  it('줄마다 번호 · 품목명 · 공정 · 상태 · 달성률을 보인다', () => {
    const { line } = renderTimeline();

    for (const text of ['SYN-WO-0007', '합성 품목', '합성 공정', '진행중', '65%']) {
      expect(within(line()).getByText(text)).toBeInTheDocument();
    }
  });

  it('조회 기간의 날을 축 머리에 적는다', () => {
    const { region } = renderTimeline();

    for (const day of ['08-01', '08-02', '08-03', '08-04']) {
      expect(within(region).getByText(day)).toBeInTheDocument();
    }
  });

  /* 막대는 그림이라 화면 읽기 도구가 읽지 못한다 — 같은 내용을 글로도 둔다. */
  it('계획 구간을 글로도 읽을 수 있게 둔다 — 지연이면 그 사실까지', () => {
    const { line } = renderTimeline();

    expect(
      within(line()).getByText(
        `${t.planned('2026-08-02 00:00', '2026-08-03 00:00')} ${list.delayed}`,
      ),
    ).toBeInTheDocument();
  });

  it('계획 구간을 날짜 축의 제자리에 그리고, 만든 비율만큼 채운다', () => {
    const { container } = renderTimeline();
    const bar = container.querySelector<HTMLElement>('.work-order-progress-tl-bar');

    expect(bar?.style.left).toBe('25%');
    expect(bar?.style.width).toBe('25%');
    expect(bar?.querySelector<HTMLElement>('.work-order-progress-tl-fill')?.style.width).toBe(
      '65%',
    );
  });

  it('넘긴 만큼 지연 구간이 기준 시각까지 이어진다', () => {
    const { container } = renderTimeline();
    const late = container.querySelector<HTMLElement>('.work-order-progress-tl-late');

    expect(late?.style.left).toBe('50%');
    expect(late?.style.width).toBe('12.5%');
    expect(container.querySelector<HTMLElement>('.work-order-progress-tl-now')?.style.left).toBe(
      '62.5%',
    );
  });

  it('지연이 아니면 지연 구간을 그리지 않는다', () => {
    const { container } = renderTimeline({ rows: [row({ delay: 'onTime' })] });

    expect(container.querySelector('.work-order-progress-tl-late')).toBeNull();
  });

  it('배포 전과 끝난 지시는 막대를 달리 그린다', () => {
    const { container } = renderTimeline({
      rows: [
        row({ workOrderId: 1, isReleased: false, delay: 'onTime' }),
        row({ workOrderId: 2, isFinished: true, delay: 'onTime' }),
      ],
    });
    const bars = [...container.querySelectorAll('.work-order-progress-tl-bar')];

    expect(bars[0]).toHaveClass('is-waiting');
    expect(bars[1]).toHaveClass('is-finished');
  });

  /* ⛔ 없는 일정을 축 어딘가에 그리지 않는다. */
  it('⛔ 계획 시작이 없으면 막대 없이 그 사실을 적는다', () => {
    const { container, line } = renderTimeline({
      rows: [row({ plannedStartAt: undefined, plannedEndAt: undefined, delay: 'unknown' })],
    });

    expect(container.querySelector('.work-order-progress-tl-bar')).toBeNull();
    expect(within(line()).getByText(t.noSchedule)).toBeInTheDocument();
  });

  it('줄의 번호를 눌러 상세를 연다 — 표와 같다', async () => {
    const { onSelect, user } = renderTimeline();

    await user.click(screen.getByRole('button', { name: list.select('SYN-WO-0007') }));

    expect(onSelect).toHaveBeenCalledWith(7001);
  });

  it('고른 줄을 알린다', () => {
    renderTimeline({ selectedWorkOrderId: 7001 });

    expect(screen.getByRole('button', { name: list.select('SYN-WO-0007') })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('범례로 막대의 뜻을 적는다', () => {
    const { region } = renderTimeline();

    for (const label of [t.legendPlan, t.legendDone, t.legendWaiting, t.legendLate, t.legendNow]) {
      expect(within(region).getByText(label)).toBeInTheDocument();
    }
  });

  describe('볼 것이 없을 때', () => {
    it('결과가 0건이면 다음에 할 일을 적는다', () => {
      const { region } = renderTimeline({ rows: [] });

      expect(within(region).getByText(list.empty)).toBeInTheDocument();
    });

    it('⛔ 조회 실패를 「결과 0건」으로 두지 않는다', () => {
      const { region } = renderTimeline({ rows: [], isError: true });

      expect(within(region).getByText(list.loadError)).toBeInTheDocument();
      expect(within(region).queryByText(list.empty)).not.toBeInTheDocument();
    });

    it('받는 중임을 알린다', () => {
      const { region } = renderTimeline({ rows: [], isLoading: true });

      expect(within(region).getByRole('status')).toHaveTextContent(list.loading);
    });
  });

  /* ⛔ 전부 읽기 전용이다 — 막대를 끌어 일정을 고치는 화면이 아니다. */
  it('⛔ 고치는 컨트롤을 두지 않는다', () => {
    const { region } = renderTimeline();

    expect(within(region).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(region).queryByRole('slider')).not.toBeInTheDocument();
  });
});
