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
      filters={{ dateFrom: '', dateTo: '', plant: '' }}
      plantOptions={[]}
      onChange={() => undefined}
      onRefresh={onRefresh}
      isRefreshing={false}
      lastUpdatedText="09:41"
      isStale={false}
      today="2026-10-16"
      isLive
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

  it('지난 기간이면 자동 갱신 안내 대신 「자동 갱신 안 함」', () => {
    renderBar({ isLive: false });

    expect(screen.getByText(`${t.autoRefreshOff} · ${t.lastUpdated('09:41')}`)).toBeInTheDocument();
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

describe('DashboardFilterBar — 기간', () => {
  it('드롭다운 기본은 「오늘」이고 날짜 칸은 꺼져 있다 · 「최근 7일」을 고르면 그 기간으로 바꾼다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ onChange });

    const select = screen.getByRole('combobox', { name: t.period });
    expect(select).toHaveTextContent(t.quick.today);
    expect(screen.getByRole('button', { name: t.customPeriod })).toBeDisabled();

    await user.click(select);
    await user.click(screen.getByRole('option', { name: t.quick.last7 }));
    expect(onChange).toHaveBeenCalledWith({
      dateFrom: '2026-10-10',
      dateTo: '2026-10-16',
      plant: '',
    });
  });

  it('주소 기간이 빠른 항목과 다르면 「직접 지정」이고 날짜 칸이 켜진다', () => {
    renderBar({ filters: { dateFrom: '2026-10-02', dateTo: '2026-10-05', plant: '' } });

    expect(screen.getByRole('combobox', { name: t.period })).toHaveTextContent(t.customPeriod);
    expect(screen.getByRole('button', { name: t.customPeriod })).toBeEnabled();
  });

  it('「직접 지정」을 고르면 지금 기간 그대로 날짜 칸을 켠다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ onChange });

    await user.click(screen.getByRole('combobox', { name: t.period }));
    await user.click(screen.getByRole('option', { name: t.customPeriod }));
    expect(screen.getByRole('button', { name: t.customPeriod })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('서버가 기간을 거절한 이유는 날짜 칸 옆에 선다', () => {
    renderBar({ periodError: '기간이 너무 깁니다.' });

    expect(screen.getByRole('alert')).toHaveTextContent('기간이 너무 깁니다.');
  });

  it('데이터 범위가 공장 하나뿐이면 「전체 공장」을 두지 않는다(omf-all-around#120)', async () => {
    const user = userEvent.setup();
    renderBar({ plantOptions: [{ value: '11', label: 'PL11 · 부품' }], allowAllPlants: false });

    await user.click(screen.getByRole('combobox', { name: t.plant }));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /PL11 · 부품/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: t.allPlants })).not.toBeInTheDocument();
  });
});
