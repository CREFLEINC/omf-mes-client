import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { reasonLabel, reasonHelpText, ReasonChips } from './worklist-chips';

describe('ReasonChips 말풍선', () => {
  it('새 작업계획 사유를 업무 문구와 생산계획 안내로 표시한다', () => {
    expect(reasonLabel('DRAFT_PLAN_PENDING')).toBe('작성중 계획 검토 필요');
    expect(reasonLabel('PLAN_QTY_REMAINING')).toBe('남은 수량 계획 필요');
    const help = reasonHelpText([{ code: 'DRAFT_PLAN_PENDING' }, { code: 'PLAN_QTY_REMAINING' }]);
    expect(help).toContain('작성중 생산계획');
    expect(help).toContain('생산계획 단계');
    expect(help).not.toContain('자동 전개 다시 실행');
  });
  it('초점을 두면 body에 열리고 Esc로 닫힌다 — 표 안에 그리면 가려진다', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ReasonChips reasons={[{ code: 'BOM_MISSING' }, { code: 'LINE_UNKNOWN' }]} />,
    );

    await user.tab();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('기본 BOM');
    expect(tip).toHaveTextContent('생산 라인');
    expect(container).not.toContainElement(tip);
    expect(document.body).toContainElement(tip);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('마우스를 올렸다 떼면 열렸다 닫힌다', async () => {
    const user = userEvent.setup();
    render(<ReasonChips reasons={[{ code: 'BOM_MISSING' }]} />);
    const chips = screen.getByRole('button');

    await user.hover(chips);
    expect(await screen.findByRole('tooltip')).toBeVisible();
    await user.unhover(chips);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
