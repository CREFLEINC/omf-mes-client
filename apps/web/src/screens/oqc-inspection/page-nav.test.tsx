import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';

const t = messages.oqcInspection.pageNav;

describe('PageNav', () => {
  it('지금 위치와 이전·다음을 그린다', async () => {
    const onChange = vi.fn();

    renderWithProviders(
      <PageNav view={toPageView({ page: 2, size: 50, total: 120 }, 50)} onChange={onChange} />,
    );

    expect(screen.getByRole('navigation', { name: t.label })).toBeInTheDocument();
    expect(screen.getByText('51–100 / 전체 120건')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.next }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('저장이 나가 있는 동안에는 쪽을 옮길 수 없다 — 목록이 갈리면 성공이 무엇에 대한 것인지 읽을 수 없다', () => {
    renderWithProviders(
      <PageNav
        view={toPageView({ page: 2, size: 50, total: 120 }, 50)}
        disabled
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: t.previous })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.next })).toBeDisabled();
  });
});
