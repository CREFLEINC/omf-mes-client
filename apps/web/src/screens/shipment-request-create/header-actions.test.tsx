import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HeaderActions } from './header-actions';

const t = messages.shipmentRequestCreate;

describe('HeaderActions', () => {
  it('막힌 사유가 없으면 버튼이 열려 있다', () => {
    render(
      <HeaderActions submitBlockReason={null} banner={null} created={null} onSubmit={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: t.actions.submit })).toBeEnabled();
  });

  it('막힌 사유가 있으면 잠기고 사유를 보인다', () => {
    render(
      <HeaderActions
        submitBlockReason="필수 항목을 입력하세요."
        banner={null}
        created={null}
        onSubmit={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: t.actions.submit });

    expect(button).toBeDisabled();
    expect(screen.getByText('필수 항목을 입력하세요.')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-describedby');
  });

  it('누르면 상위에 알린다', async () => {
    const onSubmit = vi.fn<() => void>();
    const user = userEvent.setup();

    render(
      <HeaderActions submitBlockReason={null} banner={null} created={null} onSubmit={onSubmit} />,
    );
    await user.click(screen.getByRole('button', { name: t.actions.submit }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('성공하면 작업지시번호와 라인 수를 보인다 — 되돌릴 경로가 없어 계속 남긴다', () => {
    render(
      <HeaderActions
        submitBlockReason={t.actionReasons.alreadySubmitted}
        banner={null}
        created={{ shipmentRequestNo: 'SAMPLE-SR-0001', statusCode: 'SAMPLE_S', lineCount: 2 }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(t.result.title)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE-SR-0001/)).toBeInTheDocument();
    expect(screen.getByText(/2건/)).toBeInTheDocument();
  });
});
