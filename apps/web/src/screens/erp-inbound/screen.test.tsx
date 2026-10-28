import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { syncTable } from './sync-table-fixtures';
import { ErpInboundScreen } from './screen';
import { SYNC_POLL_MS, type SyncTableStatus, type SyncTablesResult } from './sync-tables';

const STATUS_PATH = '/integration/erp-sync/tables';
const RUN_PATH = '/integration/erp-sync/tables/IF-ERP-ITEM-RECV:run';

const ITEM = syncTable();
const BOM = syncTable({
  interfaceCode: 'IF-ERP-BOM-RECV',
  name: 'BOM',
  lastStatusCode: 'FAILED',
  lastErrorMessage: '모품목을 찾지 못했습니다',
});

interface Recorded {
  method: string;
  pathname: string;
}

/**
 * 서버를 흉내 낸다 — 상태 응답은 `states` 를 차례로 내고 마지막 것을 되풀이한다.
 * 「지금 읽기」를 받기 전까지는 첫 상태만 낸다(요청이 서버에 닿기 전에 상태가 바뀌지 않는다).
 */
const createServer = (
  states: SyncTablesResult[],
  run: () => Response = () =>
    jsonResponse(
      { interfaceCode: 'IF-ERP-ITEM-RECV', requestedAt: '2026-10-20T08:00:00Z' },
      { status: 202 },
    ),
): { fetch: StubFetch; requests: Recorded[] } => {
  const requests: Recorded[] = [];
  let accepted = false;
  let cursor = 0;

  const fetch: StubFetch = async (request) => {
    const { pathname } = new URL(request.url);
    requests.push({ method: request.method, pathname });

    if (request.method === 'GET' && pathname === STATUS_PATH) {
      const body = states[Math.min(cursor, states.length - 1)];
      if (accepted) cursor += 1;
      return jsonResponse(body);
    }

    if (request.method === 'POST' && pathname === RUN_PATH) {
      const response = run();
      if (response.ok) {
        accepted = true;
        cursor = 1;
      }
      return response;
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  return { fetch, requests };
};

const result = (items: SyncTableStatus[], enabled = true): SyncTablesResult => ({ enabled, items });

const panel = () => within(screen.getByRole('region', { name: 'ERP 수신 표' }));

afterEach(() => {
  vi.useRealTimers();
});

describe('ErpInboundScreen — 표시', () => {
  it('표마다 한 줄 — 상태·마지막 읽음·건수·다음 예정·지금 읽기를 낸다', async () => {
    const { fetch } = createServer([result([ITEM, BOM])]);
    renderWithProviders(<ErpInboundScreen />, { fetch });

    expect(await panel().findByText('품목')).toBeInTheDocument();
    const headers = panel()
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      '표',
      '상태',
      '마지막 읽음',
      '읽음',
      '반영',
      '실패',
      '보류',
      '다음 예정',
      '지금 읽기',
    ]);
    // 주기 설명 같은 안내문은 두지 않는다(사용자 지시 2026-10-27).
    expect(screen.queryByText(/12시간/)).toBeNull();

    const itemRow = panel().getByRole('row', { name: /^품목/ });
    // 시각은 공장 시각(UTC+7)으로 낸다.
    expect(within(itemRow).getByText('2026-10-20 14:00')).toBeInTheDocument();
    expect(within(itemRow).getByText('성공')).toBeInTheDocument();
    expect(within(itemRow).getByText('11')).toBeInTheDocument();

    const bomRow = panel().getByRole('row', { name: /^BOM/ });
    expect(within(bomRow).getByText('모품목을 찾지 못했습니다')).toBeInTheDocument();
  });

  it('ERP 연동이 꺼진 서버면 버튼을 잠그고 사유를 보이는 글자로 낸다', async () => {
    const { fetch } = createServer([result([ITEM], false)]);
    renderWithProviders(<ErpInboundScreen />, { fetch });

    const button = await panel().findByRole('button', { name: '품목 지금 읽기' });
    expect(button).toBeDisabled();
    expect(
      panel().getByText('지금 읽기는 이 서버에서 ERP 연동이 꺼져 있어 쓸 수 없습니다.'),
    ).toBeVisible();
  });

  it('상태를 읽지 못하면 표 대신 오류 배너와 다시 시도가 나온다', async () => {
    const fetch: StubFetch = async () => jsonResponse({ message: '' }, { status: 500 });
    renderWithProviders(<ErpInboundScreen />, { fetch });

    expect(await panel().findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(panel().getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(panel().queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('ErpInboundScreen — 탭 막대 칩', () => {
  it.each([
    [true, '수신 켜짐'],
    [false, '수신 꺼짐'],
  ])('수신 켜짐(%s)을 탭 막대 오른쪽 칩으로 낸다', async (enabled, label) => {
    const { fetch } = createServer([result([ITEM], enabled)]);
    renderWithProviders(
      <>
        <div id="hub-actions" data-testid="hub-actions" />
        <ErpInboundScreen />
      </>,
      { fetch },
    );

    expect(await within(screen.getByTestId('hub-actions')).findByText(label)).toBeInTheDocument();
  });
});

describe('ErpInboundScreen — 지금 읽기', () => {
  it('누르면 그 표의 경로로 요청하고, 다 읽을 때까지 다시 읽은 뒤 결과를 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const requested = syncTable({ requestedAt: '2026-10-20T08:00:00Z' });
    const running = syncTable({
      requestedAt: '2026-10-20T08:00:00Z',
      running: true,
      lastStartedAt: '2026-10-20T08:00:03Z',
    });
    const finished = syncTable({
      lastStartedAt: '2026-10-20T08:00:03Z',
      lastFinishedAt: '2026-10-20T08:00:05Z',
      lastAppliedCount: 4,
    });
    const { fetch, requests } = createServer([
      result([ITEM]),
      result([requested]),
      result([running]),
      result([finished]),
    ]);
    renderWithProviders(<ErpInboundScreen />, { fetch });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    await user.click(await panel().findByRole('button', { name: '품목 지금 읽기' }));

    expect(requests).toContainEqual({ method: 'POST', pathname: RUN_PATH });
    // 받은 뒤 목록을 다시 읽어 요청이 걸린 것을 보인다. 그동안 버튼은 잠긴다.
    expect(await panel().findByText('대기 중')).toBeInTheDocument();
    expect(panel().getByRole('button', { name: '품목 지금 읽기' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS);
    });
    expect(await panel().findByText('읽는 중')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS);
    });
    expect(
      await screen.findByText('품목 읽기를 마쳤습니다. 4건을 반영했습니다.'),
    ).toBeInTheDocument();
    expect(panel().getByText('성공')).toBeInTheDocument();
    expect(panel().getByRole('button', { name: '품목 지금 읽기' })).toBeEnabled();

    // 다 읽었으면 더 다시 읽지 않는다.
    const reads = requests.filter((request) => request.method === 'GET').length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS * 3);
    });
    expect(requests.filter((request) => request.method === 'GET')).toHaveLength(reads);
  });

  it('바쁜 표가 없으면 목록을 다시 읽지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fetch, requests } = createServer([result([ITEM, BOM])]);
    renderWithProviders(<ErpInboundScreen />, { fetch });
    await panel().findByText('품목');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS * 3);
    });

    expect(requests).toHaveLength(1);
  });

  it('들어왔을 때 이미 도는 표가 있으면 그것을 따라 다시 읽는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fetch, requests } = createServer([result([syncTable({ running: true })])]);
    renderWithProviders(<ErpInboundScreen />, { fetch });
    await panel().findByText('읽는 중');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS);
    });

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(1);
    });
  });

  it('요청이 거절되면 서버의 사유를 배너로 낸다', async () => {
    const { fetch } = createServer([result([ITEM])], () =>
      jsonResponse(
        {
          errors: [
            {
              scope: 'screen',
              code: 'STATE_LOCKED',
              message: '이 서버는 ERP 연동이 꺼져 있어 읽어 올 수 없습니다.',
            },
          ],
        },
        { status: 400 },
      ),
    );
    renderWithProviders(<ErpInboundScreen />, { fetch });
    const user = userEvent.setup();

    await user.click(await panel().findByRole('button', { name: '품목 지금 읽기' }));

    expect(await panel().findByText('읽기를 요청하지 못했습니다')).toBeInTheDocument();
    expect(
      panel().getByText('이 서버는 ERP 연동이 꺼져 있어 읽어 올 수 없습니다.'),
    ).toBeInTheDocument();
  });
});
