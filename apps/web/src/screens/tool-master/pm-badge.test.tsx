import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PmBadge } from './pm-badge';
import type { PmJudgment } from './pm-status';

const t = messages.toolMaster.pm;

const renderBadge = (judgment: PmJudgment) => {
  const { container } = render(<PmBadge judgment={judgment} />);

  return container.firstElementChild as HTMLElement;
};

describe('PmBadge', () => {
  it('네 모양이 서로 다른 문구를 낸다', () => {
    const labels = (
      [
        { status: 'notRequired', axis: null },
        { status: 'due', axis: 'SHOT' },
        { status: 'beforeDue', axis: null },
        { status: 'unknown', axis: null },
      ] as PmJudgment[]
    ).map((judgment) => renderBadge(judgment).textContent);

    expect(new Set(labels).size).toBe(4);
  });

  /*
   * ⛔ **모르는 것은 정상이 아니다**(G-9). 같은 결로 그리면 도래했는지 알 수 없는 툴이
   * 도래 전과 구별되지 않고, 그 툴이 계속 돈다.
   */
  it('「판정 없음」과 「도래 전」을 같은 결로 그리지 않는다', () => {
    const unknown = renderBadge({ status: 'unknown', axis: null }).className;
    const beforeDue = renderBadge({ status: 'beforeDue', axis: null }).className;

    expect(unknown).not.toBe(beforeDue);
    expect(screen.getByText(t.unknown)).toBeInTheDocument();
    expect(screen.getByText(t.beforeDue)).toBeInTheDocument();
  });

  /* 예방보전을 하지 않기로 한 것은 정상이라 눈길을 끌 이유가 없다. */
  it('「대상 아님」을 도래와 다른 결로 그린다', () => {
    const notRequired = renderBadge({ status: 'notRequired', axis: null }).className;
    const due = renderBadge({ status: 'due', axis: null }).className;

    expect(notRequired).not.toBe(due);
  });

  /* 둘 다 쓰는 툴에서 「왜 도래했는가」가 갈린다. */
  it('도래는 축을 함께 말한다', () => {
    expect(renderBadge({ status: 'due', axis: 'SHOT' })).toHaveTextContent(t.axis.shot);
    expect(renderBadge({ status: 'due', axis: 'DATE' })).toHaveTextContent(t.axis.date);
    expect(renderBadge({ status: 'due', axis: 'SHOT' }).textContent).not.toBe(
      renderBadge({ status: 'due', axis: 'DATE' }).textContent,
    );
  });

  it('축이 없으면 축을 붙이지 않는다', () => {
    const label = renderBadge({ status: 'due', axis: null }).textContent;

    expect(label).toBe(t.due);
    expect(label).not.toContain('—');
  });
});
