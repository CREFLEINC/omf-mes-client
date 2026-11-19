import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderWithProviders,
} from '../../test/api-harness';
import { OUTBOX_KEY, useOutbox, type OutboxEntry } from '../../patterns/outbox';
import { useWorkerSession, type Worker } from '../../patterns/worker-session';
import { PutawayHistoryScreen } from './screen';

const t = messages.putawayHistory;

const store = vi.hoisted(() => new Map<string, string>());

/* 기기 토큰 — 「이 기기」 코드를 묻는 단말 번호(sub)가 여기서 나온다. 기본은 없음. */
const token = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('../../patterns/device-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/device-token')>()),
  currentDeviceToken: () => token.value,
}));

/** 단말 번호(sub)만 든 합성 토큰. 서명은 보지 않는다. */
const tokenFor = (terminalId: number): string =>
  `x.${btoa(JSON.stringify({ sub: String(terminalId) })).replaceAll('=', '')}.y`;

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

/** 공장 시각 2026-11-18 21:44(UTC+7). 영업일 「오늘」이 이 날이다. */
const NOW = new Date('2026-11-18T14:44:00.000Z');

const KIM: Worker = { workerNo: '90901', workerName: 'V9 적치 작업자' };
const LEE: Worker = { workerNo: '90902', workerName: 'V9 오후 작업자' };

type Row = Record<string, unknown>;

const record = (overrides: Row = {}): Row => ({
  recordType: 'DIRECT',
  recordId: 6,
  putawayModeCode: 'UNDESIGNATED',
  sourceCode: 'PURCHASE',
  recordedAt: '2026-11-18T14:39:30.000Z',
  documentNo: 'GR-20261118-0002',
  lot: { lotId: 2, lotNo: 'V9-X|10|261118|V9-S1|0002' },
  item: { itemId: 1, itemCode: 'V9-X', itemName: 'V9 적치자재 X' },
  qty: '10',
  uomCode: 'EA',
  qualityStatusCode: 'NORMAL',
  warehouse: { warehouseId: 1, warehouseCode: 'V9-WHA', warehouseName: 'V9 창고 A' },
  location: { locationId: 4, locationCode: 'V9-R2', path: 'V9 창고 A › Z01 구역 › R2 랙' },
  worker: { workerNo: KIM.workerNo, workerName: KIM.workerName },
  terminalCode: 'V9-MOB1',
  receiptStatusCode: 'POSTED',
  ...overrides,
});

const OTHER_WORKER_ROW = record({
  recordId: 9,
  documentNo: 'GR-20261118-0006',
  lot: { lotId: 9, lotNo: 'V9-Z|10|261118|V9-S5|0001' },
  worker: { workerNo: LEE.workerNo, workerName: LEE.workerName },
  recordedAt: '2026-11-18T13:05:00.000Z',
});

interface Seen {
  scope: string | null;
  businessDate: string | null;
  page: string | null;
  workerNo: string | null;
}

interface BackendOptions {
  /** 기준 · 날짜 · 쪽마다 돌려줄 줄. 주지 않으면 「내 기록」은 한 줄, 「이 단말」은 두 줄. */
  rows?: (seen: Seen) => Row[];
  total?: (seen: Seen) => number;
}

const backend = (options: BackendOptions = {}) => {
  const state = { down: false, sendable: false, seen: [] as Seen[] };
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/logistics/putaway-records',
      respond: (request) => {
        if (state.down) {
          throw new TypeError('Failed to fetch');
        }

        const query = new URL(request.url).searchParams;
        const seen: Seen = {
          scope: query.get('scope'),
          businessDate: query.get('businessDate'),
          page: query.get('page'),
          workerNo: request.headers.get('X-Worker-No'),
        };
        state.seen.push(seen);

        const rows =
          options.rows?.(seen) ??
          (seen.scope === 'TERMINAL' ? [record(), OTHER_WORKER_ROW] : [record()]);

        return jsonResponse({
          items: rows,
          page: {
            page: Number(seen.page ?? '1'),
            size: 50,
            total: options.total?.(seen) ?? rows.length,
          },
        });
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/terminals/9001',
      respond: () =>
        jsonResponse({
          terminalId: 9001,
          terminalCode: 'V11-MOB1',
          plantId: 1,
          terminalTypeCode: 'MOBILE',
          statusCode: 'RUNNING',
          isActive: true,
          versionNo: 1,
        }),
    },
    /* 셸이 큐를 읽자마자 보내 본다. 닿지 않게 두어야 대기 건이 남는다. */
    {
      match: (request) => new URL(request.url).pathname.startsWith('/logistics/putaway-tasks/'),
      respond: () => {
        if (!state.sendable) {
          throw new TypeError('Failed to fetch');
        }

        return jsonResponse({}, { status: 200 });
      },
    },
  ]);

  return { state, fetch };
};

const SignedIn = ({ as = KIM, children }: { as?: Worker; children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn(as);
    }
  }, [as, signIn, worker]);

  return worker === null ? null : children;
};

/** 교대 — 셸의 「사용자 전환」 뒤 다른 사번으로 들어온 것과 같다. */
const SwitchWorker = ({ to }: { to: Worker }) => {
  const { signIn } = useWorkerSession();

  return (
    <button type="button" onClick={() => signIn(to)}>
      교대
    </button>
  );
};

/** 셸이 연결이 돌아왔을 때 큐를 보내는 것과 같다. */
const SendNow = () => {
  const { flush } = useOutbox();

  return (
    <button type="button" onClick={() => void flush()}>
      지금 보내기
    </button>
  );
};

const Where = () => {
  const routed = useLocation();

  return <p data-testid="where">{routed.pathname}</p>;
};

const render = (
  fetch: ReturnType<typeof backend>['fetch'],
  queryClient = createTestQueryClient(),
) =>
  renderWithProviders(
    <MemoryRouter initialEntries={['/putaway-history']}>
      <SignedIn>
        <SwitchWorker to={LEE} />
        <SendNow />
        <Routes>
          <Route path="/putaway-history" element={<PutawayHistoryScreen />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </SignedIn>
    </MemoryRouter>,
    { fetch, queryClient },
  );

const listOf = () => screen.getByRole('list', { name: t.listLabel });

beforeEach(() => {
  store.clear();
  token.value = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('적치 기록 화면', () => {
  it('US1-1 기본은 「내 기록」 오늘이고 줄마다 LOT · 위치 · 품목 · 경로 · 방식 · 번호 · 시각 · 작업자가 보인다', async () => {
    const { state, fetch } = backend();
    render(fetch);

    const row = await screen.findByText('V9-X|10|261118|V9-S1|0002', { exact: false });
    const item = row.closest('li');
    expect(item).not.toBeNull();
    const card = within(item as HTMLElement);

    expect(card.getByText('V9-R2')).toBeInTheDocument();
    expect(card.getByText('V9-X V9 적치자재 X')).toBeInTheDocument();
    expect(card.getByText('V9 창고 A › Z01 구역 › R2 랙')).toBeInTheDocument();
    expect(card.getByText(t.mode.UNDESIGNATED)).toBeInTheDocument();
    expect(card.getByText('GR-20261118-0002, 21:39, 90901 V9 적치 작업자')).toBeInTheDocument();
    expect(item).toHaveTextContent('10 EA');

    expect(state.seen[0]).toEqual({
      scope: 'WORKER',
      businessDate: '2026-11-18',
      page: '1',
      workerNo: KIM.workerNo,
    });
    expect(screen.getByRole('tab', { name: t.tabs.mine })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(t.dateLabel('2026-11-18', t.weekdays[3]!, true))).toBeInTheDocument();
    expect(screen.getByText(t.basis.mine(KIM.workerNo, KIM.workerName, 1))).toBeInTheDocument();
  });

  it('US1-3 「이 단말」 탭은 scope=TERMINAL 로 다시 불러 다른 작업자의 적치도 보인다', async () => {
    const { state, fetch } = backend();
    const user = userEvent.setup();
    render(fetch);
    await screen.findByText('GR-20261118-0002', { exact: false });

    await user.click(screen.getByRole('tab', { name: t.tabs.terminal }));

    expect(await screen.findByText('GR-20261118-0006', { exact: false })).toBeInTheDocument();
    const terminal = state.seen.find((each) => each.scope === 'TERMINAL');
    expect(terminal).toMatchObject({ businessDate: '2026-11-18', workerNo: null });
    /* 기기 코드는 줄이 아니라 기기 등록에서 읽는다(T032) — 토큰이 없는 시험이라 코드 없이. */
    expect(screen.getByText(t.basis.terminal(null, 2))).toBeInTheDocument();
  });

  it('US1-4 기록이 없는 날은 빈 상태 문구와 함께 기준과 날짜가 보인다', async () => {
    const { fetch } = backend({ rows: () => [] });
    render(fetch);

    expect(await screen.findByText(t.empty.title)).toBeInTheDocument();
    expect(screen.getByText(t.empty.mine)).toBeInTheDocument();
    expect(screen.getByText(t.basis.mine(KIM.workerNo, KIM.workerName, 0))).toBeInTheDocument();
    expect(screen.getByText(t.dateLabel('2026-11-18', t.weekdays[3]!, true))).toBeInTheDocument();
  });

  it('US1-4 빈 날에도 이 기기 코드를 보인다', async () => {
    token.value = tokenFor(9001);
    const { fetch } = backend({ rows: () => [] });
    const user = userEvent.setup();
    render(fetch);
    await screen.findByText(t.empty.title);

    await user.click(screen.getByRole('tab', { name: t.tabs.terminal }));

    expect(await screen.findByText(t.basis.terminal('V11-MOB1', 0))).toBeInTheDocument();
  });

  it('FR-006 ‹ 로 6일 전까지 가고 거기서 막히며, › 는 오늘에서 막힌다', async () => {
    const { state, fetch } = backend();
    const user = userEvent.setup();
    render(fetch);
    await screen.findByText('GR-20261118-0002', { exact: false });

    const prev = screen.getByRole('button', { name: t.prevDay });
    const next = screen.getByRole('button', { name: t.nextDay });
    expect(next).toBeDisabled();

    for (let day = 0; day < 6; day += 1) {
      await user.click(prev);
    }

    await waitFor(() => {
      expect(state.seen.at(-1)?.businessDate).toBe('2026-11-12');
    });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByText(t.dateLabel('2026-11-12', t.weekdays[4]!, false))).toBeInTheDocument();
    expect(state.seen.some((each) => each.businessDate === '2026-11-11')).toBe(false);

    await user.click(next);
    await waitFor(() => {
      expect(state.seen.at(-1)?.businessDate).toBe('2026-11-13');
    });
  });

  it('FR-012 50건이 넘으면 「더 보기」로 다음 쪽을 이어 붙인다', async () => {
    const pageOf = (seen: Seen) =>
      Array.from({ length: seen.page === '2' ? 10 : 50 }, (_, index) =>
        record({
          recordId: (seen.page === '2' ? 50 : 0) + index + 1,
          documentNo: `GR-20261118-${String((seen.page === '2' ? 50 : 0) + index + 1).padStart(4, '0')}`,
        }),
      );
    const { state, fetch } = backend({ rows: pageOf, total: () => 60 });
    const user = userEvent.setup();
    render(fetch);

    await screen.findByText('GR-20261118-0001', { exact: false });
    expect(within(listOf()).getAllByRole('listitem')).toHaveLength(50);

    await user.click(screen.getByRole('button', { name: t.more(50, 60) }));

    await waitFor(() => {
      expect(within(listOf()).getAllByRole('listitem')).toHaveLength(60);
    });
    expect(state.seen.at(-1)).toMatchObject({ page: '2', scope: 'WORKER' });
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
  });

  it('Edge 불러온 뒤 연결이 끊기면 그때 불러온 목록을 시각과 함께 보인다', async () => {
    const { state, fetch } = backend();
    const queryClient = createTestQueryClient();
    const first = render(fetch, queryClient);
    await screen.findByText('GR-20261118-0002', { exact: false });
    first.unmount();

    state.down = true;
    render(fetch, queryClient);

    expect(await screen.findByText(t.offline.title)).toBeInTheDocument();
    expect(screen.getByText(t.offline.loadedAt('21:44'))).toBeInTheDocument();
    expect(screen.getByText('GR-20261118-0002', { exact: false })).toBeInTheDocument();
  });

  it('Edge 처음부터 연결이 끊겨 있으면 「연결되면 불러옵니다」', async () => {
    const { state, fetch } = backend();
    state.down = true;
    render(fetch);

    expect(await screen.findByText(t.offline.title)).toBeInTheDocument();
    expect(screen.getByText(t.offline.none)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).toBeNull();
  });

  it('Edge 사번을 바꾸면 「내 기록」은 새 작업자로 다시 불리고 앞 작업자 목록이 남지 않는다', async () => {
    const { state, fetch } = backend({
      rows: (seen) =>
        seen.workerNo === LEE.workerNo
          ? [OTHER_WORKER_ROW]
          : seen.scope === 'WORKER'
            ? [record()]
            : [],
    });
    const user = userEvent.setup();
    render(fetch);
    await screen.findByText('GR-20261118-0002', { exact: false });

    await user.click(screen.getByRole('button', { name: '교대' }));

    expect(await screen.findByText('GR-20261118-0006', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('GR-20261118-0002', { exact: false })).toBeNull();
    expect(state.seen.at(-1)).toMatchObject({ scope: 'WORKER', workerNo: LEE.workerNo });
  });

  it('Edge 사번을 바꿔도 「이 단말」은 그대로다', async () => {
    const { state, fetch } = backend();
    const user = userEvent.setup();
    render(fetch);
    await screen.findByText('GR-20261118-0002', { exact: false });
    await user.click(screen.getByRole('tab', { name: t.tabs.terminal }));
    await screen.findByText('GR-20261118-0006', { exact: false });
    const asked = state.seen.length;

    await user.click(screen.getByRole('button', { name: '교대' }));

    expect(screen.getByText('GR-20261118-0006', { exact: false })).toBeInTheDocument();
    expect(state.seen.slice(asked).filter((each) => each.scope === 'TERMINAL')).toHaveLength(0);
  });

  it('FR-016 줄은 읽기 전용이다 — 줄 안에 단추 · 링크가 없고 눌러도 아무 데도 가지 않는다', async () => {
    const { fetch } = backend();
    const user = userEvent.setup();
    render(fetch);
    const text = await screen.findByText('GR-20261118-0002', { exact: false });
    const item = text.closest('li') as HTMLElement;

    expect(within(item).queryAllByRole('button')).toHaveLength(0);
    expect(within(item).queryAllByRole('link')).toHaveLength(0);

    await user.click(item);
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('US3-1 방식 칩 5가지와 지시 적치의 출처를 가른다', async () => {
    const { fetch } = backend({
      rows: () => [
        record({ recordId: 1, documentNo: 'D-1', putawayModeCode: 'DESIGNATED' }),
        record({ recordId: 2, documentNo: 'D-2', putawayModeCode: 'UNDESIGNATED' }),
        record({ recordId: 3, documentNo: 'D-3', putawayModeCode: 'TEMPORARY' }),
        record({
          recordType: 'TASK',
          recordId: 4,
          documentNo: 'PT-4',
          putawayModeCode: 'TASK',
          sourceCode: 'REPLENISHMENT',
          receiptStatusCode: null,
        }),
        record({
          recordType: 'TASK',
          recordId: 5,
          documentNo: 'PT-5',
          putawayModeCode: 'TASK',
          sourceCode: 'PRODUCT',
        }),
        record({
          recordType: 'TASK',
          recordId: 6,
          documentNo: 'PT-6',
          putawayModeCode: 'TASK_TEMPORARY',
          sourceCode: 'PURCHASE',
        }),
      ],
    });
    render(fetch);

    const chipOf = async (documentNo: string, chip: string) => {
      const text = await screen.findByText(documentNo, { exact: false });
      expect(within(text.closest('li') as HTMLElement).getByText(chip)).toBeInTheDocument();
    };

    await chipOf('D-1', t.mode.DESIGNATED);
    await chipOf('D-2', t.mode.UNDESIGNATED);
    await chipOf('D-3', t.mode.TEMPORARY);
    await chipOf('PT-4', t.mode.TASK(t.source.REPLENISHMENT));
    await chipOf('PT-5', t.mode.TASK(t.source.PRODUCT));
    await chipOf('PT-6', t.mode.TASK_TEMPORARY(t.source.PURCHASE));
  });

  it('US3-2 · US3-3 입고 취소된 줄은 남아 흐리게 「입고 취소됨」, 취소 요청 중 · 불량은 칩으로 보인다', async () => {
    const { fetch } = backend({
      rows: () => [
        record({ recordId: 1, documentNo: 'GR-C', receiptStatusCode: 'CANCELLED' }),
        record({ recordId: 2, documentNo: 'GR-R', receiptStatusCode: 'CANCEL_REQUESTED' }),
        record({ recordId: 3, documentNo: 'GR-D', qualityStatusCode: 'DEFECTIVE' }),
        record({ recordId: 4, documentNo: 'GR-N', qualityStatusCode: null }),
      ],
    });
    render(fetch);

    const itemOf = async (documentNo: string) =>
      (await screen.findByText(`${documentNo},`, { exact: false })).closest('li') as HTMLElement;

    const cancelled = await itemOf('GR-C');
    expect(within(cancelled).getByText(t.cancelled)).toBeInTheDocument();
    expect(cancelled).toHaveClass('putaway-history__row--cancelled');

    const requested = await itemOf('GR-R');
    expect(within(requested).getByText(t.cancelRequested)).toBeInTheDocument();
    expect(requested).not.toHaveClass('putaway-history__row--cancelled');

    const defective = await itemOf('GR-D');
    expect(within(defective).getByText(t.defective)).toBeInTheDocument();

    const plain = await itemOf('GR-N');
    expect(within(plain).queryByText(t.defective)).toBeNull();
    expect(within(plain).queryByText(t.cancelled)).toBeNull();
  });

  it('FR-014 · H12 전송 대기 적치가 있으면 건수와 전송 대기 화면 입구를 보인다', async () => {
    const entry = (id: string, label: string): OutboxEntry => ({
      id,
      label,
      idempotencyKey: `key-${id}`,
      method: 'POST',
      path: '/logistics/putaway-tasks/90:complete',
      body: {},
      occurredAt: '2026-11-18T14:40:00.000Z',
      confirmation: 'immediate',
      workerNo: KIM.workerNo,
    });
    store.set(
      OUTBOX_KEY,
      JSON.stringify([
        entry('a', messages.putaway.record),
        entry('b', messages.temporaryPutaway.record),
        entry('c', '설비 고장 보고'),
      ]),
    );
    const { fetch } = backend();
    const user = userEvent.setup();
    render(fetch);

    expect(await screen.findByText(t.queued.title(2))).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: t.queued.action }));
    expect(screen.getByTestId('where')).toHaveTextContent('/outbox');
  });

  it('FR-014·H12 전송 대기가 보내지면 목록을 다시 불러온다', async () => {
    store.set(
      OUTBOX_KEY,
      JSON.stringify([
        {
          id: 'a',
          label: messages.putaway.record,
          idempotencyKey: 'key-a',
          method: 'POST',
          path: '/logistics/putaway-tasks/90:complete',
          body: {},
          occurredAt: '2026-11-18T14:40:00.000Z',
          confirmation: 'immediate',
          workerNo: KIM.workerNo,
        } satisfies OutboxEntry,
      ]),
    );
    const { state, fetch } = backend({
      rows: () =>
        state.sendable
          ? [record({ recordType: 'TASK', recordId: 90, documentNo: 'PT-90' }), record()]
          : [record()],
    });
    const user = userEvent.setup();
    render(fetch);
    expect(await screen.findByText(t.queued.title(1))).toBeInTheDocument();
    await screen.findByText('GR-20261118-0002', { exact: false });

    state.sendable = true;
    await user.click(screen.getByRole('button', { name: '지금 보내기' }));

    await waitFor(() => {
      expect(screen.queryByText(t.queued.title(1))).toBeNull();
    });
    expect(await screen.findByText('PT-90', { exact: false })).toBeInTheDocument();
    expect(within(listOf()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('Edge-연결 끊김 불러온 적 없으면 건수를 보이지 않는다', async () => {
    const { state, fetch } = backend();
    state.down = true;
    render(fetch);

    expect(await screen.findByText(t.offline.none)).toBeInTheDocument();
    expect(screen.getByText(t.basis.mine(KIM.workerNo, KIM.workerName, null))).toBeInTheDocument();
    expect(screen.queryByText(/0건/)).toBeNull();
  });

  it('FR-014 전송 대기가 없으면 안내를 세우지 않는다', async () => {
    const { fetch } = backend();
    render(fetch);
    await screen.findByText('GR-20261118-0002', { exact: false });

    expect(screen.queryByText(/전송 대기/)).toBeNull();
  });

  it('US2-4 아래 단추로 적치 · 입고 완료 화면으로 간다', async () => {
    const { fetch } = backend();
    const user = userEvent.setup();
    render(fetch);
    await screen.findByText('GR-20261118-0002', { exact: false });

    await user.click(screen.getByRole('button', { name: t.back(messages.putaway.title) }));

    expect(screen.getByTestId('where')).toHaveTextContent('/putaway');
  });
});
