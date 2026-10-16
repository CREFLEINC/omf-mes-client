import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TrendPanel, toPointPositions } from './trend-panel';
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
    render(<TrendPanel view={view} isLoading={false} />);

    const hit = screen.getByRole('button', { name: '10-14 · 1,250,000 EA' });
    await user.hover(hit);
    expect(screen.getByRole('tooltip')).toHaveTextContent('10-14 · 1,250,000 EA');
    await user.unhover(hit);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('키보드 포커스로도 보이고 Esc 로 닫힌다', async () => {
    const user = userEvent.setup();
    render(<TrendPanel view={view} isLoading={false} />);

    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('10-14 · 1,250,000 EA');
    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('10-15 · 0 EA');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('누르면(터치 탭) 고정되고, 다른 곳을 누르면 닫힌다', () => {
    render(
      <div>
        <p>바깥</p>
        <TrendPanel view={view} isLoading={false} />
      </div>,
    );
    const hit = screen.getByRole('button', { name: '10-16 · 32,000 EA' });

    fireEvent.click(hit);
    expect(screen.getByRole('tooltip')).toHaveTextContent('10-16 · 32,000 EA');
    fireEvent.pointerDown(screen.getByText('바깥'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('점 위치는 DS 차트와 같은 식 — 좌우 여백 안에 고르게, 0 은 바닥 · 상한은 위 끝', () => {
    const positions = toPointPositions(view.points, 640, 1_500_000);
    expect(positions.map((point) => point.x)).toEqual([40, 332, 624]);
    expect(positions[1]?.y).toBe(188);
    expect(toPointPositions([{ label: 'a', value: 1_500_000 }], 640, 1_500_000)[0]?.y).toBe(16);
  });
});
