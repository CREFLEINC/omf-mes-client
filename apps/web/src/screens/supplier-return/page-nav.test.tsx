import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';

const t = messages.supplierReturn;

const view = (overrides: Partial<PageView> = {}): PageView => ({
  page: 2,
  totalPages: 3,
  rangeLabel: t.pageNav.range(51, 100, 120),
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

describe('PageNav', () => {
  it('지금 보고 있는 범위를 밝힌다', () => {
    render(<PageNav view={view()} isLocked={false} onChange={vi.fn()} />);

    expect(screen.getByText(t.pageNav.range(51, 100, 120))).toBeInTheDocument();
  });

  it('이전·다음이 옮길 쪽을 알린다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<PageNav view={view()} isLocked={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(onChange.mock.calls).toEqual([[1], [3]]);
  });

  it('갈 곳이 없으면 잠긴다', () => {
    render(<PageNav view={view({ canPrev: false, canNext: false })} isLocked={false} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  /*
   * **M33(첫째 겹)** — 쪽 이동도 대상을 바꾸는 길이다. 쪽이 바뀌면 고른 전표가 풀리므로,
   * 전송 중에 열어 두면 앞 요청의 결과가 다른 전표 맥락에 나타난다.
   */
  it('전송 중에는 갈 곳이 있어도 잠긴다', () => {
    render(<PageNav view={view()} isLocked onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  it('쪽 이동 묶음에 이름이 있다', () => {
    render(<PageNav view={view()} isLocked={false} onChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});
