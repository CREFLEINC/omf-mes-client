import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardFilterBar } from './dashboard-filter-bar';
import { DASHBOARD_REFRESH_INTERVAL_MS } from './queries';

/**
 * 조건 줄의 갱신 안내는 **실제 주기에서 숫자를 받는다**(omf-all-around#115). 주기를 바꾸고 문구를
 * 두면 화면이 사실과 다른 말을 한다 — 자동 갱신 전에는 「자동으로 갱신되지 않습니다」가 그렇게 남았다.
 */
describe('DashboardFilterBar — 갱신 안내', () => {
  it('자동 갱신 주기를 분 단위로 적고 「갱신」 단추에 잇는다', () => {
    render(
      <DashboardFilterBar
        filters={{ baseDate: '', plant: '' }}
        plantOptions={[]}
        onChange={() => undefined}
        onRefresh={() => undefined}
        isRefreshing={false}
      />,
    );

    const note = messages.dashboard.filters.autoRefresh(DASHBOARD_REFRESH_INTERVAL_MS / 60_000);
    expect(note).toContain('1분마다');
    expect(
      screen.getByRole('button', { name: messages.dashboard.filters.refresh }),
    ).toHaveAccessibleDescription(note);
  });
});
