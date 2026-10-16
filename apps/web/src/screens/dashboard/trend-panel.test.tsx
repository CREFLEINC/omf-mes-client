import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TrendPanel, placeTip, toPointPositions, toTipDate } from './trend-panel';
import type { DashboardTrendView } from './types';

const view: DashboardTrendView = {
  seriesName: '생산량',
  unit: 'EA',
  targetValue: null,
  asOfText: null,
  points: [
    { label: '10-14', value: 1_250_000 },
    { label: '10-15', value: 0 },
    { label: '10-16', value: 32_000 },
  ],
};

/** 점 툴팁(사용자 결정 2026-10-16) — 날짜 · 정확한 생산량(천 단위 · 단위). */
describe('TrendPanel 점 툴팁', () => {
  it('마우스를 올리면 날짜 · 생산량이 보이고, 떠나면 닫힌다', async () => {
    const user = userEvent.setup();
    render(<TrendPanel view={view} baseDate="2026-10-16" isLoading={false} />);

    const hit = screen.getByRole('button', { name: '2026.10.14 1,250,000 EA' });
    await user.hover(hit);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/2026\.10\.14.*1,250,000/);
    await user.unhover(hit);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('키보드 포커스로도 보이고 Esc 로 닫힌다', async () => {
    const user = userEvent.setup();
    render(<TrendPanel view={view} baseDate="2026-10-16" isLoading={false} />);

    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent(/2026\.10\.14.*1,250,000/);
    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent(/2026\.10\.15.*0/);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('누르면(터치 탭) 고정되고, 다른 곳을 누르면 닫힌다', () => {
    render(
      <div>
        <p>바깥</p>
        <TrendPanel view={view} baseDate="2026-10-16" isLoading={false} />
      </div>,
    );
    const hit = screen.getByRole('button', { name: '2026.10.16 32,000 EA' });

    fireEvent.click(hit);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/2026\.10\.16.*32,000/);
    fireEvent.pointerDown(screen.getByText('바깥'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('말풍선은 두 줄 — 날짜(연도 포함) · 수량(천 단위) + 단위', async () => {
    const user = userEvent.setup();
    render(<TrendPanel view={view} baseDate="2026-10-16" isLoading={false} />);

    await user.hover(screen.getByRole('button', { name: '2026.10.14 1,250,000 EA' }));
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('.dash-trend-tip-date')).toHaveTextContent('2026.10.14');
    expect(tip.querySelector('.dash-trend-tip-value')).toHaveTextContent('1,250,000EA');
    expect(tip.querySelector('.dash-trend-tip-unit')).toHaveTextContent('EA');
  });

  it('날짜 연도 — 기준일 연도, 기준일보다 뒤의 월-일이면 지난해, 꼴이 다르면 그대로', () => {
    expect(toTipDate('10-13', '2026-10-16')).toBe('2026.10.13');
    expect(toTipDate('12-30', '2027-01-03')).toBe('2026.12.30');
    expect(toTipDate('기타', '2026-10-16')).toBe('기타');
    expect(toTipDate('10-13', null)).toBe('10-13');
  });

  it('말풍선 자리 — 위가 비면 위, 좌우 끝에서는 안쪽으로만 밀고, 이웃 점을 가리면 아래로', () => {
    const size = { width: 100, height: 40 };
    /* 오른쪽 끝 점 — 위로 열되 영역 안으로 민다. */
    const last = { x: 624, y: 180 };
    expect(placeTip(last, size, [last], 640)).toEqual({ left: 540, top: 128 });
    /* 위에 이웃 점이 있으면 아래로(영역 안일 때). */
    const low = { x: 300, y: 100 };
    const neighbour = { x: 330, y: 70 };
    expect(placeTip(low, size, [low, neighbour], 640).top).toBe(112);
    /* 아래 자리가 없고 위에서 이웃 점을 가리면 그 점보다 더 위로. */
    const end = { x: 624, y: 180 };
    const beside = { x: 560, y: 160 };
    const placed = placeTip(end, size, [beside, end], 640);
    expect(placed.top + size.height).toBeLessThan(beside.y - 6);
    /* 왼쪽 끝 점 — y축 글자를 덮지 않게 그림 영역 앞에서 멈춘다. */
    const first = { x: 40, y: 180 };
    expect(placeTip(first, size, [first], 640).left).toBe(34);
    /* 맨 위 점은 위로 나갈 수 없어 아래로. */
    const top = { x: 300, y: 20 };
    expect(placeTip(top, size, [top], 640).top).toBe(32);
  });

  it('점 위치는 DS 차트와 같은 식 — 좌우 여백 안에 고르게, 0 은 바닥 · 상한은 위 끝', () => {
    const positions = toPointPositions(view.points, 640, 1_500_000);
    expect(positions.map((point) => point.x)).toEqual([40, 332, 624]);
    expect(positions[1]?.y).toBe(188);
    expect(toPointPositions([{ label: 'a', value: 1_500_000 }], 640, 1_500_000)[0]?.y).toBe(16);
  });
});
