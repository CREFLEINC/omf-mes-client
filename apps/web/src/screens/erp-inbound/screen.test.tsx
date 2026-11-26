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

/** 받는 표 목록 — 상세 상자는 없다. 「지금 읽기」는 목록 줄마다 있다(#358). */
const list = () => within(screen.getByRole('region', { name: 'ERP 수신 목록' }));

afterEach(() => {
  vi.useRealTimers();
});

describe('ErpInboundScreen — 표시', () => {
  it('목록은 표마다 한 줄 — 수신 항목 · 구분 · 상태(칩만) · 일시 · 건수를 낸다(#358)', async () => {
    const { fetch } = createServer([result([ITEM, BOM])]);
    renderWithProviders(<ErpInboundScreen />, { fetch });

    expect(await list().findByText('품목')).toBeInTheDocument();
    const headers = list()
      .getAllByRole('columnheader')
      /* 열 순서 끌기 손잡이(아이콘 글자 `drag_indicator`)는 빼고 이름만 본다(#358). */
      .map((cell) => cell.textContent?.replace('drag_indicator', ''));
    expect(headers).toEqual([
      '수신 항목',
      '구분',
      '상태',
      '최근 수신 일시',
      '다음 수신 예정 일시',
      '읽음',
      '반영',
      '실패',
      '보류',
      '오류 내용',
      '지금 읽기',
    ]);
    // 주기 설명 같은 안내문은 두지 않는다(사용자 지시 2026-10-27).
    expect(screen.queryByText(/12시간/)).toBeNull();

    const itemRow = list().getByRole('row', { name: /^품목/ });
    // 시각은 공장 시각(UTC+7)으로 낸다.
    expect(within(itemRow).getByText('2026-10-20 14:00')).toBeInTheDocument();
    expect(within(itemRow).getByText('성공')).toBeInTheDocument();

    const bomRow = list().getByRole('row', { name: /^BOM/ });
    // 실패 사유는 「오류 내용」 열에 한 줄로 낸다 — 상세 상자는 없다(#358).
    expect(within(bomRow).getByText('실패')).toBeInTheDocument();
    expect(within(bomRow).getByText('모품목을 찾지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '받는 표 상세' })).toBeNull();
  });

  it('줄마다 「지금 읽기」가 있다(#358)', async () => {
    const { fetch } = createServer([result([ITEM, BOM])]);
    renderWithProviders(<ErpInboundScreen />, { fetch });

    expect(await list().findByRole('button', { name: '품목 지금 읽기' })).toBeEnabled();
    expect(list().getByRole('button', { name: 'BOM 지금 읽기' })).toBeEnabled();
  });

  it('ERP 연동이 꺼진 서버면 버튼을 잠그고 사유를 보이는 글자로 낸다', async () => {
    const { fetch } = createServer([result([ITEM], false)]);
    renderWithProviders(<ErpInboundScreen />, { fetch });

    const button = await list().findByRole('button', { name: '품목 지금 읽기' });
    expect(button).toBeDisabled();
    expect(screen.getByText('ERP 연동이 꺼져 있어 지금 읽기를 쓸 수 없습니다.')).toBeVisible();
  });

  it('상태를 읽지 못하면 표 대신 오류 배너와 다시 시도가 나온다', async () => {
    const fetch: StubFetch = async () => jsonResponse({ message: '' }, { status: 500 });
    renderWithProviders(<ErpInboundScreen />, { fetch });

    expect(await list().findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(list().getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(list().queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('ErpInboundScreen — 배치(#358)', () => {
  it('조회 상자 · 쪽 넘김 없이 받는 표를 한 목록에 다 낸다(사용자 지시 2026-11-24)', async () => {
    const { fetch } = createServer([result([ITEM, BOM])]);
    renderWithProviders(<ErpInboundScreen />, { fetch });

    expect(await list().findByText('품목')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '조회 조건' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '처음' })).toBeNull();
    expect(list().getByRole('heading', { name: 'ERP 수신 목록' })).toBeInTheDocument();
  });

  it('탭 줄 오른쪽에 수신 칩이 선다 — 상세가 없어 배치 「⋯」 메뉴는 두지 않는다', async () => {
    const { fetch } = createServer([result([ITEM])]);
    renderWithProviders(
      <>
        <div id="hub-actions" data-testid="hub-actions" />
        <ErpInboundScreen />
      </>,
      { fetch },
    );

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText('수신 ON')).toBeInTheDocument();
    expect(hub.queryByRole('button', { name: '더보기' })).toBeNull();
  });
});

describe('ErpInboundScreen — 탭 막대 칩', () => {
  it('받는 표 전체의 반영 · 보류 건수를 칩으로 내고, 0건(실패)은 세우지 않는다(#358)', async () => {
    const { fetch } = createServer([
      result([ITEM, syncTable({ interfaceCode: 'IF-B', name: '거래처' })]),
    ]);
    renderWithProviders(
      <>
        <div id="hub-actions" data-testid="hub-actions" />
        <ErpInboundScreen />
      </>,
      { fetch },
    );

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText('수신 반영 22')).toBeInTheDocument();
    expect(hub.getByText('수신 보류 2')).toBeInTheDocument();
    expect(hub.queryByText(/^수신 실패 /)).toBeNull();
  });

  it.each([
    [true, '수신 ON'],
    [false, '수신 OFF'],
  ])('수신 ON(%s)을 탭 막대 오른쪽 칩으로 낸다', async (enabled, label) => {
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
    await user.click(await list().findByRole('button', { name: '품목 지금 읽기' }));

    expect(requests).toContainEqual({ method: 'POST', pathname: RUN_PATH });
    // 받은 뒤 목록을 다시 읽어 요청이 걸린 것을 보인다. 그동안 버튼은 잠긴다.
    expect(await list().findByText('대기 중')).toBeInTheDocument();
    expect(list().getByRole('button', { name: '품목 지금 읽기' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS);
    });
    expect(await list().findByText('읽는 중')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS);
    });
    expect(
      await screen.findByText('품목 읽기를 마쳤습니다. 4건을 반영했습니다.'),
    ).toBeInTheDocument();
    expect(list().getByText('성공')).toBeInTheDocument();
    expect(list().getByRole('button', { name: '품목 지금 읽기' })).toBeEnabled();

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
    await list().findByText('품목');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS * 3);
    });

    expect(requests).toHaveLength(1);
  });

  it('들어왔을 때 이미 도는 표가 있으면 그것을 따라 다시 읽는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fetch, requests } = createServer([result([syncTable({ running: true })])]);
    renderWithProviders(<ErpInboundScreen />, { fetch });
    await list().findByText('읽는 중');

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
    await user.click(await list().findByRole('button', { name: '품목 지금 읽기' }));

    expect(await screen.findByText('읽기를 요청하지 못했습니다')).toBeInTheDocument();
    expect(
      screen.getByText('이 서버는 ERP 연동이 꺼져 있어 읽어 올 수 없습니다.'),
    ).toBeInTheDocument();
  });
});
