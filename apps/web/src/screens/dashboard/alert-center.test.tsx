import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AlertCenterButton, AlertPanel, NOTIFICATION_CENTER_PATH } from './alert-panel';

const t = messages.dashboard.alerts;

/** 미확인 알림 카드(사용자 지시 2026-10-16) — 머리의 「알림센터 보기 →」, 빈 상태 한 줄. */
describe('미확인 알림 카드', () => {
  it('「알림센터 보기」를 누르면 알림센터로 간다(경로 그대로)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<AlertCenterButton />} />
          <Route path={NOTIFICATION_CENTER_PATH} element={<p>알림센터 도착</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: t.openCenter }));
    expect(screen.getByText('알림센터 도착')).toBeInTheDocument();
  });

  it('알람이 없으면 「미확인 알림이 없습니다.」 한 줄만', () => {
    render(
      <MemoryRouter>
        <AlertPanel views={[]} isLoading={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText(t.empty)).toBeInTheDocument();
    expect(t.empty).toBe('미확인 알림이 없습니다.');
  });
});
