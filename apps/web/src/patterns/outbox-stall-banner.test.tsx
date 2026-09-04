import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OutboxStallBanner } from './outbox-stall-banner';

describe('OutboxStallBanner — 멈춤을 말하되 「사라졌다」로 읽히지 않게', () => {
  it('무엇이 멈췄는지와 담긴 것이 남아 있다는 사실을 함께 말한다', () => {
    render(<OutboxStallBanner onRetry={vi.fn()} />);

    expect(screen.getByText(messages.common.connection.stalledTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.common.connection.stalledBody)).toBeInTheDocument();
  });

  /* 자동 재전송이 멈춘 자리라, 사람이 다시 보낼 길이 없으면 큐는 영영 서 있다. */
  it('다시 보낼 길을 준다', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<OutboxStallBanner onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: messages.common.connection.stalledRetry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
