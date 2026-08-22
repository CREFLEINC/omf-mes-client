import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DayBadge } from './day-badge';
import type { DayStatus } from './day-status';

const t = messages.workCalendar.grid.status;

const renderBadge = (status: DayStatus) => {
  const { container } = render(<DayBadge status={status} />);

  return container.firstElementChild as HTMLElement;
};

describe('DayBadge', () => {
  it('네 모양이 서로 다른 문구를 낸다', () => {
    const labels = (['unset', 'working', 'holiday', 'partial'] as DayStatus[]).map(
      (status) => renderBadge(status).textContent,
    );

    expect(new Set(labels).size).toBe(4);
  });

  /*
   * ⛔ **「미설정」과 「가동」을 같은 결로 그리지 않는다.** 계약이 설정 있는 날만 내려 주므로,
   * 둘이 같아 보이면 아직 정하지 않은 날이 일하기로 정한 날로 읽힌다(G-9).
   */
  it('「미설정」과 「가동」을 같은 결로 그리지 않는다', () => {
    expect(renderBadge('unset').className).not.toBe(renderBadge('working').className);
    expect(screen.getByText(t.unset)).toBeInTheDocument();
  });

  it('네 결이 서로 다르다', () => {
    const classes = (['unset', 'working', 'holiday', 'partial'] as DayStatus[]).map(
      (status) => renderBadge(status).className,
    );

    expect(new Set(classes).size).toBe(4);
  });

  /* 반일 근무라 눈에 띄어야 한다 — 휴무로 처리하면 조업시간이 통째로 빠진다. */
  it('부분 가동을 휴무와 다른 결로 그린다', () => {
    expect(renderBadge('partial').className).not.toBe(renderBadge('holiday').className);
  });
});
