import type { TerminalWorkCounts } from '@omf-mes/api-client';
import { createApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientProvider } from '../patterns/api-context';
import { OutboxProvider } from '../patterns/outbox';
import { TaskDraftProvider } from '../patterns/task-draft';
import { WorkerSessionProvider, useWorkerSession } from '../patterns/worker-session';
import { createTestQueryClient, jsonResponse, type StubFetch } from '../test/api-harness';
import { FrequentScreensProvider, useRecordScreenVisit } from './frequent-screens';
import { HomeAreaScreen, ShellHome } from './shell-home';
import { WORK_COUNT_INTERVAL_MS } from './work-counts';

const t = messages.shellHome;

/* 기기 토큰 — 수의 기준(창고)을 묻는 단말 번호가 여기서 나온다. 기본은 등록 전(없음). */
const token = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('../patterns/device-token', () => ({ currentDeviceToken: () => token.value }));

/** 단말 번호(sub)만 든 합성 토큰. 서명은 보지 않는다. */
const tokenFor = (terminalId: number): string =>
  `x.${btoa(JSON.stringify({ sub: String(terminalId) })).replaceAll('=', '')}.y`;

const COUNTS: TerminalWorkCounts = {
  putaway: 2,
  materialPicking: 3,
  stockTransferArrival: 2,
  shipmentPicking: 2,
};

interface Setup {
  counts?: TerminalWorkCounts | 'fail';
  signedIn?: boolean;
  path?: string;
  warehouseName?: string | null;
  frequent?: string[];
}

const SignIn = ({ frequent }: { frequent: string[] }) => {
  const { signIn } = useWorkerSession();
  const record = useRecordScreenVisit();
  useEffect(() => {
    signIn({ workerNo: '100027', workerName: '합성 갑' });
  }, [signIn]);
  useEffect(() => {
    for (const path of frequent) record(path);
  }, [frequent, record]);
  return null;
};

const GoHome = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate('/screens')}>
      홈으로
    </button>
  );
};

const setup = (options: Setup = {}) => {
  const counted: Request[] = [];
  const fetch: StubFetch = async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname === '/app/terminal-work-counts') {
      counted.push(request);
      return options.counts === 'fail'
        ? jsonResponse({ message: '' }, { status: 503 })
        : jsonResponse(options.counts ?? COUNTS);
    }
    if (pathname.startsWith('/mdm/terminals/')) {
      return jsonResponse({
        terminalId: 9001,
        terminalCode: 'SYN-MOB',
        plantId: 1,
        terminalTypeCode: 'MOBILE',
        statusCode: 'RUNNING',
        isActive: true,
        versionNo: 1,
        ...(options.warehouseName === undefined ? {} : { warehouseName: options.warehouseName }),
      });
    }
    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  const Shell = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
      <ApiClientProvider client={createApiClient({ baseUrl: 'http://api.test', fetch })}>
        <MemoryRouter initialEntries={[options.path ?? '/screens']}>
          <OutboxProvider send={() => Promise.resolve()}>
            <WorkerSessionProvider>
              <TaskDraftProvider>
                <FrequentScreensProvider>{children}</FrequentScreensProvider>
              </TaskDraftProvider>
            </WorkerSessionProvider>
          </OutboxProvider>
        </MemoryRouter>
      </ApiClientProvider>
    </QueryClientProvider>
  );

  render(
    <Shell>
      {options.signedIn === false ? null : <SignIn frequent={options.frequent ?? []} />}
      <GoHome />
      <Routes>
        <Route path="/screens" element={<ShellHome />} />
        <Route path="/screens/:area" element={<HomeAreaScreen />} />
        <Route path="*" element={<p>작업 화면</p>} />
      </Routes>
    </Shell>,
  );
  return { counted };
};

const warehouseLabel = t.areas.warehouse.label;
const shippingLabel = t.areas.shipping.label;
/** 배지가 없을 때 창고 줄의 이름은 보이는 글자(「창고 작업 6개」)다. */
const areaName = new RegExp(`^${warehouseLabel}`);

beforeEach(() => {
  token.value = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('모바일 홈 남은 작업 배지(피처 002)', () => {
  it('US3-1 업무 줄은 「남은 작업 [합]」, 작업 줄은 그 작업 수, 접근 이름에 실제 수', async () => {
    setup();

    const warehouse = await screen.findByRole('link', {
      name: t.workCount.label(warehouseLabel, 7),
    });
    expect(within(warehouse).getByText(t.workCount.left)).toBeInTheDocument();
    expect(within(warehouse).getByText('7')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: t.workCount.label(shippingLabel, 2) }),
    ).toBeInTheDocument();
    /* 셀 것이 없는 업무는 지금처럼 「작업 N개」다. */
    expect(
      screen.getByRole('link', { name: new RegExp(`^${t.areas.inbound.label}`) }),
    ).toHaveTextContent(t.areas.count(5));
  });

  it('US3-1 업무 화면의 작업 줄에 그 작업의 수가 선다', async () => {
    setup({ path: '/screens/warehouse' });

    const picking = await screen.findByRole('link', {
      name: t.workCount.label(messages.materialPicking.title, 3),
    });
    expect(within(picking).getByText('3')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: t.workCount.label(messages.putaway.title, 2) }),
    ).toBeInTheDocument();
    /* 셀 수 없는 작업에는 배지가 없다. */
    expect(screen.getByRole('link', { name: messages.physicalCount.title })).toBeInTheDocument();
  });

  it('US3-1 자주 쓰는 작업 칩에도 같은 수가 선다', async () => {
    setup({ frequent: ['/material-picking'] });

    const chip = await screen.findByRole('link', {
      name: t.workCount.label(messages.materialPicking.title, 3),
    });
    expect(within(chip).getByText('3')).toBeInTheDocument();
  });

  it('US3-2 12건이면 「9+」로 보이고 접근 이름은 12건이다', async () => {
    setup({ path: '/screens/warehouse', counts: { ...COUNTS, materialPicking: 12 } });

    const picking = await screen.findByRole('link', {
      name: t.workCount.label(messages.materialPicking.title, 12),
    });
    expect(within(picking).getByText('9+')).toBeInTheDocument();
  });

  it('US3-3 0건이면 배지가 없고 업무 줄은 「작업 N개」로 돌아간다', async () => {
    const { counted } = setup({
      counts: { putaway: 0, materialPicking: 0, stockTransferArrival: 0, shipmentPicking: 0 },
    });

    await waitFor(() => expect(counted).toHaveLength(1));
    expect(screen.queryByText(t.workCount.left)).toBeNull();
    expect(screen.getByRole('link', { name: areaName })).toHaveTextContent(t.areas.count(6));
  });

  it('FR-018 조회가 실패하면 배지를 숨기고 오류 문구 없이 업무 줄은 그대로 누를 수 있다', async () => {
    const user = userEvent.setup();
    const { counted } = setup({ counts: 'fail' });

    await waitFor(() => expect(counted).toHaveLength(1));
    expect(screen.queryByText(t.workCount.left)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('link', { name: areaName }));
    expect(
      await screen.findByRole('link', { name: messages.materialPicking.title }),
    ).toBeInTheDocument();
  });

  it('배지는 중립색이다 — 빨강은 「이어서 하기」 전용', async () => {
    setup({ path: '/screens/warehouse' });

    const picking = await screen.findByRole('link', {
      name: t.workCount.label(messages.materialPicking.title, 3),
    });
    const badge = within(picking).getByText('3');
    expect(badge.className).toMatch(/neutral/);
    expect(badge.className).not.toMatch(/error|primary/);
  });

  it('SC-002 US3-4 홈에 머무는 동안 60초마다, 홈에 다시 들어오면 곧바로 다시 센다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { counted } = setup();

    await waitFor(() => expect(counted).toHaveLength(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WORK_COUNT_INTERVAL_MS);
    });
    await waitFor(() => expect(counted).toHaveLength(2));

    await user.click(screen.getByRole('link', { name: t.workCount.label(warehouseLabel, 7) }));
    await waitFor(() => expect(counted).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: '홈으로' }));
    await waitFor(() => expect(counted).toHaveLength(4));
  });

  it('US3-7 사번을 넣기 전에는 수를 묻지 않는다', async () => {
    const { counted } = setup({ signedIn: false });

    await screen.findByRole('link', { name: areaName });
    expect(counted).toHaveLength(0);
    expect(screen.queryByText(t.workCount.left)).toBeNull();
  });

  it('홈 아래에 수의 기준을 적는다 — 창고가 있으면 그 창고, 없으면 공장 전체', async () => {
    token.value = tokenFor(9001);
    setup({ warehouseName: '합성 자재창고 A' });
    expect(
      await screen.findByText(t.workCount.basisWarehouse('합성 자재창고 A')),
    ).toBeInTheDocument();
  });

  it('US3-8 창고가 없는 기기는 「공장 전체 기준」이다', async () => {
    token.value = tokenFor(9001);
    setup({ warehouseName: null });
    expect(await screen.findByText(t.workCount.basisPlant)).toBeInTheDocument();
  });
});
