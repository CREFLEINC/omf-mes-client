import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CalibrationBadge } from './calibration-badge';
import type { CalibrationJudgment } from './calibration-status';

const t = messages.gaugeMaster.calibration;

const renderBadge = (judgment: CalibrationJudgment) => {
  const { container } = render(<CalibrationBadge judgment={judgment} />);
  return container.firstElementChild as HTMLElement;
};

describe('CalibrationBadge', () => {
  it('네 모양이 서로 다른 문구를 낸다', () => {
    const labels = (
      [
        { status: 'notRequired', days: null },
        { status: 'never', days: null },
        { status: 'valid', days: 3 },
        { status: 'expired', days: 3 },
      ] as CalibrationJudgment[]
    ).map((judgment) => renderBadge(judgment).textContent);

    expect(new Set(labels).size).toBe(4);
  });

  /*
   * ⛔ **앞은 채워야 할 것이고 뒤는 정상이다.** 같은 결로 그리면 채워야 할 것이 정상으로
   * 보이고, 그 계측기로 검사가 나간다(스펙 §5-5 · 공유계약 G-9).
   */
  it('「아직 안 함」과 「대상 아님」을 같은 결로 그리지 않는다', () => {
    const never = renderBadge({ status: 'never', days: null }).className;
    const notRequired = renderBadge({ status: 'notRequired', days: null }).className;

    expect(never).not.toBe(notRequired);
    expect(screen.getByText(t.never)).toBeInTheDocument();
    expect(screen.getByText(t.notRequired)).toBeInTheDocument();
  });

  it('만료는 유효와 다른 결로 그린다', () => {
    const expired = renderBadge({ status: 'expired', days: 3 }).className;
    const valid = renderBadge({ status: 'valid', days: 3 }).className;

    expect(expired).not.toBe(valid);
  });

  /* 「유효」만으로는 내일 만료인 것과 반년 남은 것이 같아 보인다. */
  it('유효와 만료는 날수를 함께 말한다', () => {
    expect(renderBadge({ status: 'valid', days: 12 })).toHaveTextContent('12');
    expect(renderBadge({ status: 'expired', days: 5 })).toHaveTextContent('5');
  });

  /* 오늘까지인 것을 「0일 남음」으로 말하면 이미 지난 것처럼 읽힌다. */
  it('오늘까지 유효한 것은 날수 대신 그 사실을 말한다', () => {
    expect(renderBadge({ status: 'valid', days: 0 })).toHaveTextContent(t.valid(0));
    expect(renderBadge({ status: 'valid', days: 0 }).textContent).not.toContain('0일 남음');
  });
});
