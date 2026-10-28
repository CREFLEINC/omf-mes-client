import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { ErpSendChips } from './send-chips';

const SETTINGS = { sendEnabled: true, items: [] };

const renderChips = (permissions: string[]) =>
  renderWithProviders(
    <>
      <div id="hub-actions" data-testid="hub-actions" />
      <ErpSendChips linkToTab />
    </>,
    {
      fetch: createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname === '/integration/outbound-item-settings',
          respond: () => jsonResponse(SETTINGS),
        },
        {
          match: (request) => new URL(request.url).pathname === '/integration/messages',
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 1, total: 2 } }),
        },
      ]),
      session: { ...SYNTHETIC_SESSION, permissions },
    },
  );

describe('ErpSendChips — 연동 현황·이력의 링크', () => {
  it('ERP 송신 탭(W-06-12)을 볼 수 있으면 칩 묶음이 그 탭 링크이고, 이름은 칩 글자 그대로다', async () => {
    renderChips(['W-06-10', 'W-06-12']);

    const hub = within(screen.getByTestId('hub-actions'));
    await hub.findByText('송신 켜짐');
    const link = hub.getByRole('link');
    expect(link).toHaveAttribute('href', '/master-data/erp-outbound');
    // 접근 이름을 덮지 않는다 — 켜짐 · 건수가 읽힌다.
    expect(link).toHaveAccessibleName(/송신 켜짐.*송신 대기/);
  });

  it('볼 수 없으면 링크로 세우지 않는다 — 누르면 막힌 탭으로 간다', async () => {
    renderChips(['W-06-10']);

    const hub = within(screen.getByTestId('hub-actions'));
    await hub.findByText('송신 켜짐');
    expect(hub.queryByRole('link')).toBeNull();
  });
});
