import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BasisBar } from './basis-bar';

const t = messages.workOrderProgress.basis;

const BASIS_AT = new Date('2026-07-15T09:00:00+09:00');

const renderBar = (basisAt = BASIS_AT) => {
  const onRefresh = vi.fn();

  render(<BasisBar basisAt={basisAt} onRefresh={onRefresh} />);

  return { onRefresh, user: userEvent.setup() };
};

describe('BasisBar', () => {
  /* L-5 — 화면에 보이는 수가 언제 것인지 모르면 그 수로 판단할 수 없다. */
  it('받아 낸 시각을 보인다', () => {
    renderBar();

    expect(screen.getByText(t.label(BASIS_AT.toLocaleString()))).toBeInTheDocument();
  });

  it('⛔ 다른 시각을 받으면 보이는 값도 바뀐다 — 굳어 있지 않다', () => {
    const other = new Date('2026-07-16T10:30:00+09:00');
    renderBar(other);

    expect(screen.getByText(t.label(other.toLocaleString()))).toBeInTheDocument();
    expect(screen.queryByText(t.label(BASIS_AT.toLocaleString()))).not.toBeInTheDocument();
  });

  /*
   * ⛔ L-6 — 적지 않으면 화면에 떠 있는 수를 「지금」으로 읽는다. 조회 화면에서 가장 비싼
   * 오해다.
   */
  it('⛔ 자동으로 갱신되지 않는다는 사실을 적는다', () => {
    renderBar();

    expect(screen.getByText(t.note)).toBeInTheDocument();
  });

  /* 새로고침이 유일한 갱신 수단이다 — 시각 바로 옆에 둔다. */
  it('새로고침을 누르면 알린다', async () => {
    const { onRefresh, user } = renderBar();

    await user.click(screen.getByRole('button', { name: t.refresh }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  /* 이 자리는 읽는 자리다 — 조건을 고치는 컨트롤을 두지 않는다. */
  it('⛔ 고치는 컨트롤을 두지 않는다', () => {
    renderBar();

    for (const role of ['textbox', 'combobox', 'checkbox'] as const) {
      expect(screen.queryAllByRole(role)).toHaveLength(0);
    }
  });
});
