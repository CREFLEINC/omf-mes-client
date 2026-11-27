import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SummaryBar } from './summary-bar';
import type { WorkOrderListSummary } from './types';

const t = messages.workOrderProgress.summary;

const summary = (overrides: Partial<WorkOrderListSummary> = {}): WorkOrderListSummary => ({
  totalCount: 128,
  statusCounts: { SYN_RUN: 100, SYN_DONE: 28 },
  goodQty: 8050,
  defectQty: 92,
  holdQty: 0,
  scrapQty: 0,
  reworkQty: 0,
  achievementRate: 0.614,
  delayedCount: 4,
  undeterminableDelayCount: 0,
  ...overrides,
});

const renderBar = (...given: [WorkOrderListSummary | undefined] | []) => {
  /* 인자를 주지 않은 것과 `undefined` 를 준 것(요약을 못 받음)을 가른다. */
  render(<SummaryBar summary={given.length === 0 ? summary() : given[0]} />);

  return screen.queryByRole('region', { name: t.label });
};

/** 이름 아래의 값 — 정보 상자는 이름(dt) 다음에 값(dd)을 둔다. */
const valueOf = (label: string): HTMLElement => {
  const value = screen.getByText(label).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`「${label}」 값 칸이 없습니다.`);

  return value;
};

describe('SummaryBar', () => {
  /* ⭐ 조건 전체 기준이다 — 화면이 이 쪽의 줄을 더해 만든 값이 아니다. */
  it('서버가 준 전체 건수 · 수량 · 지연 건수를 보인다', () => {
    renderBar();

    expect(valueOf(t.total)).toHaveTextContent('128');
    expect(valueOf(t.goodQty)).toHaveTextContent('8,050');
    expect(valueOf(t.defectQty)).toHaveTextContent('92');
    expect(valueOf(t.delayed)).toHaveTextContent('4');
  });

  /* ⛔ L-2 — 달성률은 서버가 준 값을 모양만 바꾼다. */
  it('달성률을 막대와 숫자로 보인다', () => {
    renderBar();

    expect(valueOf(t.achievementRate)).toHaveTextContent('61.4%');
    expect(
      within(valueOf(t.achievementRate)).getByRole('progressbar', { name: t.achievementRate }),
    ).toBeInTheDocument();
  });

  it('보류 · 스크랩 · 재작업 · 판정 불가는 값이 있을 때만 연다', () => {
    renderBar();
    for (const label of [t.holdQty, t.scrapQty, t.reworkQty, t.undeterminable]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('값이 있으면 그 칸을 연다', () => {
    renderBar(summary({ holdQty: 4, undeterminableDelayCount: 2 }));

    expect(valueOf(t.holdQty)).toHaveTextContent('4');
    expect(valueOf(t.undeterminable)).toHaveTextContent('2');
    expect(screen.queryByText(t.scrapQty)).not.toBeInTheDocument();
  });

  /* 이 화면에서 빨강은 지연 하나를 가리킨다 — 0 건을 빨갛게 칠하면 없는 문제를 만든다. */
  it('지연이 있을 때만 빨갛게 적는다', () => {
    const { unmount } = render(<SummaryBar summary={summary()} />);
    expect(valueOf(t.delayed).querySelector('.work-order-progress-late')).not.toBeNull();
    unmount();

    render(<SummaryBar summary={summary({ delayedCount: 0 })} />);
    expect(valueOf(t.delayed).querySelector('.work-order-progress-late')).toBeNull();
    expect(valueOf(t.delayed)).toHaveTextContent('0');
  });

  /* ⛔ 빈 칸은 「0」으로 읽힌다 — 못 받았으면 줄째 없다. */
  it('⛔ 요약을 받지 못했으면 줄째 그리지 않는다', () => {
    expect(renderBar(undefined)).toBeNull();
  });

  it('서버가 주지 않은 값의 칸은 만들지 않는다 — 0 으로 메우지 않는다', () => {
    render(<SummaryBar summary={{ totalCount: 3, statusCounts: {} }} />);

    expect(valueOf(t.total)).toHaveTextContent('3');
    for (const label of [t.achievementRate, t.goodQty, t.defectQty, t.delayed]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
