import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { ErpSendChips } from './send-chips';

const item = (pendingMessageCount: number, failedMessageCount: number) => ({
  outboundItemCode: 'GOODS_RECEIPT',
  outboundItemName: '입고 (G/R)',
  enabled: true,
  locked: false,
  interfaceCode: 'IF-GR-SEND',
  pendingMessageCount,
  failedMessageCount,
});

const SETTINGS: { sendEnabled?: boolean; items: ReturnType<typeof item>[] } = {
  sendEnabled: true,
  items: [item(2, 1)],
};

const renderChips = (permissions: string[], settings = SETTINGS) =>
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
          respond: () => jsonResponse(settings),
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
    await hub.findByText('송신 ON');
    const link = hub.getByRole('link');
    expect(link).toHaveAttribute('href', '/master-data/erp-outbound');
    // 접근 이름을 덮지 않는다 — 건수가 읽힌다. ON · OFF 는 링크 밖 점 + 글자다(#358).
    expect(link).toHaveAccessibleName(/송신 대기 2.*송신 실패 1/);
    expect(hub.getByText('송신 ON')).toHaveClass('erp-link-state');
  });

  it('볼 수 없으면 링크로 세우지 않는다 — 누르면 막힌 탭으로 간다', async () => {
    renderChips(['W-06-10']);

    const hub = within(screen.getByTestId('hub-actions'));
    await hub.findByText('송신 ON');
    expect(hub.queryByRole('link')).toBeNull();
  });
});

describe('ErpSendChips — 0건 칩', () => {
  it('송신 대기가 0건이면 대기 칩을 세우지 않는다 — 실패 칩은 선다', async () => {
    renderChips(['W-06-10', 'W-06-12'], { sendEnabled: true, items: [item(0, 3)] });

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText('송신 실패 3')).toBeInTheDocument();
    expect(hub.queryByText(/^송신 대기 /)).toBeNull();
  });

  it('송신 실패가 0건이면 실패 칩을 세우지 않는다 — 대기 칩은 선다', async () => {
    renderChips(['W-06-10', 'W-06-12'], { sendEnabled: true, items: [item(4, 0)] });

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText('송신 대기 4')).toBeInTheDocument();
    expect(hub.queryByText(/^송신 실패 /)).toBeNull();
  });

  it('켜짐을 모르고 건수가 모두 0건이면 빈 자리도 두지 않는다', async () => {
    renderChips(['W-06-10', 'W-06-12'], { items: [item(0, 0)] });

    const hub = screen.getByTestId('hub-actions');
    /* 설정 응답이 올 때까지 기다린 뒤에도 비어 있다. */
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hub).toBeEmptyDOMElement();
  });
});
