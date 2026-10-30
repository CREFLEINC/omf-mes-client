import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ReasonChips } from './worklist-chips';

describe('ReasonChips 말풍선', () => {
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
