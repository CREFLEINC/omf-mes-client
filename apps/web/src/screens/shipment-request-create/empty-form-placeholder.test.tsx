import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmptyFormPlaceholder } from './empty-form-placeholder';

const t = messages.shipmentRequestCreate;

describe('EmptyFormPlaceholder', () => {
  it('안내와 단독 생성 버튼을 낸다', () => {
    render(<EmptyFormPlaceholder onStartStandalone={vi.fn()} />);

    expect(screen.getByText(t.empty.noTargetTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.startStandalone })).toBeInTheDocument();
  });

  it('버튼을 누르면 상위에 알린다', async () => {
    const onStartStandalone = vi.fn<() => void>();
    const user = userEvent.setup();

    render(<EmptyFormPlaceholder onStartStandalone={onStartStandalone} />);
    await user.click(screen.getByRole('button', { name: t.actions.startStandalone }));

    expect(onStartStandalone).toHaveBeenCalledTimes(1);
  });
});
