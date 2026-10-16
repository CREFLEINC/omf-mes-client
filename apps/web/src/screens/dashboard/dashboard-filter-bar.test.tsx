import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DashboardFilterBar, type DashboardFilterBarProps } from './dashboard-filter-bar';
import { DASHBOARD_REFRESH_INTERVAL_MS } from './queries';

const t = messages.dashboard.filters;

const renderBar = (overrides: Partial<DashboardFilterBarProps> = {}) => {
  const onRefresh = vi.fn();
  render(
    <DashboardFilterBar
      filters={{ baseDate: '', plant: '' }}
      plantOptions={[]}
      onChange={() => undefined}
      onRefresh={onRefresh}
      isRefreshing={false}
      lastUpdatedText="09:41"
      isStale={false}
      {...overrides}
    />,
  );

  return { onRefresh };
};

/**
 * 조건 줄 아래 한 줄 — 「N분마다 자동 갱신 · 마지막 갱신 HH:mm」(omf-all-around#115 · 사용자 지시 2026-10-16).
 * 주기는 실제 상수에서 받는다 — 주기를 바꾸고 문구를 두면 화면이 사실과 다른 말을 한다.
 */
describe('DashboardFilterBar — 갱신', () => {
  it('자동 갱신 주기와 마지막 갱신을 한 줄로 적고 「갱신」 단추에 잇는다 — 「기준」이라는 말은 없다', () => {
    renderBar();

    const line = `${t.autoRefresh(DASHBOARD_REFRESH_INTERVAL_MS / 60_000)} · ${t.lastUpdated('09:41')}`;
    expect(line).toBe('1분마다 자동 갱신 · 마지막 갱신 09:41');
    expect(screen.getByRole('button', { name: t.refresh })).toHaveAccessibleDescription(line);
    expect(screen.getByText(line).textContent).not.toContain('기준');
  });

  it('아직 성공한 적이 없으면 시각을 지어내지 않고, 갱신이 실패하면 그 사실을 덧붙인다', () => {
    renderBar({ lastUpdatedText: null, isStale: true });

    expect(
      screen.getByText(
        `${t.autoRefresh(DASHBOARD_REFRESH_INTERVAL_MS / 60_000)} · ${t.refreshFailed}`,
      ),
    ).toBeInTheDocument();
  });

  it('누르면 다시 부른다', async () => {
    const user = userEvent.setup();
    const { onRefresh } = renderBar();
    await user.click(screen.getByRole('button', { name: t.refresh }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('재조회 중(자동 갱신 포함)에는 눌리지 않는다 — 요청을 겹쳐 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { onRefresh } = renderBar({ isRefreshing: true });

    const button = screen.getByRole('button', { name: t.refresh });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
