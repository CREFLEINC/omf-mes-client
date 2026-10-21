import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChoiceCard } from './choice-card';

describe('고르는 카드', () => {
  /* 아이콘은 이름에 섞이지 않는다 - 「receipt_long PO-…」로 읽히면 번호로 찾지 못한다. */
  it('번호로 시작하는 이름의 단추이고 한 번 누르면 고른다', async () => {
    const user = userEvent.setup();
    const pick = vi.fn();
    render(
      <ChoiceCard icon="receipt_long" title="PO-2026-000123" onClick={pick}>
        <span>발주일 2026-10-10</span>
      </ChoiceCard>,
    );

    await user.click(screen.getByRole('button', { name: /^PO-2026-000123/ }));

    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('고른 카드는 눌린 상태로 알린다', () => {
    render(<ChoiceCard icon="inventory_2" title="품목코드 ABC-123" selected onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /ABC-123/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('오른쪽 수는 값과 이름을 함께 보인다', () => {
    render(
      <ChoiceCard
        icon="inventory_2"
        title="PT-2026-000512"
        aside={{ value: '200 EA', label: '잔여' }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('button')).toHaveTextContent('200 EA잔여');
  });
});
