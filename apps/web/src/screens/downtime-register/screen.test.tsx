import { messages } from '@omf-mes/i18n';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  breakdown,
  downtime,
  EQUIPMENT_CODE,
  EQUIPMENT_ID,
  ongoingDowntime,
  PROCESS_ID,
  TERMINAL_ID,
  WORKER_NO,
} from './fixtures';
import { DowntimeRegisterScreen } from './screen';

const t = messages.downtimeRegister;

const DOWNTIMES_PATH = '/maintenance/downtimes';
const SUMMARY_PATH = '/maintenance/downtimes/summary';
const BREAKDOWNS_PATH = '/maintenance/breakdowns';
const TERMINAL_PATH = `/mdm/terminals/${String(TERMINAL_ID)}/processes`;
const closePath = (downtimeId: number): string => `${DOWNTIMES_PATH}/${String(downtimeId)}:close`;

const ROUTE = `/pop/downtime?equipmentId=${String(EQUIPMENT_ID)}&equipmentCode=${EQUIPMENT_CODE}`;

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    const clone = request.clone();
    let body: unknown = null;
    try {
      body = request.method === 'POST' ? await clone.json() : null;
    } catch {
      body = null;
    }

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body,
    });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

/** 비가동 목록 — 진행 중(`openOnly`)과 오늘(기간)이 같은 경로를 쓴다. */
const downtimeListRoute = (
  options: { ongoing?: unknown[]; today?: unknown[] } = {},
): StubRoute => ({
  match: (request) => isGet(request, DOWNTIMES_PATH),
  respond: (request) => {
    const openOnly = new URL(request.url).searchParams.get('openOnly') === 'true';
    const items = openOnly ? (options.ongoing ?? []) : (options.today ?? []);

    return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
  },
});

const summaryRoute = (actualDowntimeMinutes = 112): StubRoute => ({
  match: (request) => isGet(request, SUMMARY_PATH),
  respond: () =>
    jsonResponse({
      operatingMinutes: 480,
      actualDowntimeMinutes,
      openIntervalCount: 0,
      overlappingIntervalCount: 0,
    }),
});

const breakdownsRoute = (items: unknown[] = []): StubRoute => ({
  match: (request) => isGet(request, BREAKDOWNS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

const gateRoute = (canInputResult = true): StubRoute => ({
  match: (request) => isGet(request, TERMINAL_PATH),
  respond: () =>
    jsonResponse({
      items: [{ terminalId: TERMINAL_ID, processId: PROCESS_ID, canInputResult }],
      page: { page: 1, size: 50, total: 1 },
    }),
});

const createRoute = (): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === DOWNTIMES_PATH,
  respond: () => jsonResponse(downtime({ downtimeId: 5299 }), { status: 201 }),
});

const closeRoute = (downtimeId: number): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === closePath(downtimeId),
  respond: () => jsonResponse(downtime({ downtimeId })),
});

const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const renderScreen = (routes: StubRoute[], identity: PopIdentity = IDENTIFIED) => {
  const { fetch, requests } = createRecordingFetch(routes);
  const result = renderWithProviders(
    <PopIdentityProvider value={identity}>
      <DowntimeRegisterScreen />
    </PopIdentityProvider>,
    { fetch, route: ROUTE },
  );

  return { ...result, requests };
};

/** 대기 중인 되먹임을 화면에 앉힌다 — 음성 단언에는 시점이 필요하다. */
const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const setOnline = (value: boolean): void => {
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
};

/** 구간 두 칸을 채운다. `[지금]`이 아닌 손 입력 경로다. */
const typeInterval = (start: [string, string], end?: [string, string]): void => {
  fireEvent.change(screen.getByLabelText(`${t.interval.startedAt} ${t.interval.date}`), {
    target: { value: start[0] },
  });
  fireEvent.change(screen.getByLabelText(`${t.interval.startedAt} ${t.interval.time}`), {
    target: { value: start[1] },
  });

  if (end === undefined) return;

  fireEvent.change(screen.getByLabelText(`${t.interval.endedAt} ${t.interval.date}`), {
    target: { value: end[0] },
  });
  fireEvent.change(screen.getByLabelText(`${t.interval.endedAt} ${t.interval.time}`), {
    target: { value: end[1] },
  });
};

/** 사유 두 단을 고른다 — 보내는 것은 소분류 하나다. */
const chooseReason = async (): Promise<void> => {
  /* 선택 칸은 `combobox`로 서고, 접근 이름은 옆에 선 라벨이 준다. */
  fireEvent.click(screen.getByRole('combobox', { name: t.reason.category }));
  fireEvent.click(await screen.findByRole('option', { name: '설비' }));

  fireEvent.click(screen.getByRole('combobox', { name: t.reason.detail }));
  fireEvent.click(await screen.findByRole('option', { name: '금형 교체' }));
};

const save = (): void => {
  fireEvent.click(screen.getByRole('button', { name: t.actions.save }));
};

const postedBodies = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'POST' && request.url.pathname === DOWNTIMES_PATH,
  );

beforeEach(() => {
  setOnline(true);
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe('DowntimeRegisterScreen — 진행 중 구획', () => {
  it('진행 중 구간을 「끝나지 않은 것만」으로 부르고 **기간을 걸지 않는다**', async () => {
    const { requests } = renderScreen([
      downtimeListRoute({ ongoing: [ongoingDowntime()] }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
    ]);

    await screen.findByRole('region', { name: t.ongoing.title });

    const call = requests.find(
      (request) =>
        request.url.pathname === DOWNTIMES_PATH &&
        request.url.searchParams.get('openOnly') === 'true',
    );

    expect(call).toBeDefined();
    /* 오늘로 자르면 전날부터 이어진 구간이 사라지고 작업자는 새 비가동을 시작한다. */
    expect(call?.url.searchParams.get('startedFrom')).toBeNull();
    expect(call?.url.searchParams.get('startedTo')).toBeNull();
    expect(call?.url.searchParams.get('equipmentId')).toBe(String(EQUIPMENT_ID));
  });

  it('진행 중이 없으면 그 구획이 아예 서지 않는다', async () => {
    renderScreen([downtimeListRoute(), summaryRoute(), breakdownsRoute(), gateRoute()]);

    await flush();

    expect(screen.queryByRole('region', { name: t.ongoing.title })).toBeNull();
  });

  it('「지금 종료」가 멱등키와 사번 헤더를 실어 종료를 부른다', async () => {
    const { requests } = renderScreen([
      downtimeListRoute({ ongoing: [ongoingDowntime({ downtimeId: 5201 })] }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      closeRoute(5201),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: t.ongoing.close }));

    await waitFor(() => {
      expect(requests.some((request) => request.url.pathname === closePath(5201))).toBe(true);
    });

    const call = requests.find((request) => request.url.pathname === closePath(5201));
    expect(call?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(call?.headers.get('Idempotency-Key')).toBeTruthy();
    /* 끝 시각은 서버가 박는다 — 화면이 본문으로 실어 보내지 않는다. */
    expect(call?.body).toBeNull();
  });

  it('진행 중이 있으면 새 저장을 막고 먼저 할 일을 말한다', async () => {
    renderScreen([
      downtimeListRoute({ ongoing: [ongoingDowntime()] }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
    ]);

    expect(await screen.findByText(t.ongoing.blocksNew)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
  });
});

describe('DowntimeRegisterScreen — 저장', () => {
  const baseRoutes = () => [
    downtimeListRoute(),
    summaryRoute(),
    breakdownsRoute(),
    gateRoute(),
    createRoute(),
  ];

  it('구간과 사유를 채우면 멱등키·사번 헤더와 함께 등록을 부른다', async () => {
    const { requests } = renderScreen(baseRoutes());

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    await chooseReason();
    save();

    await waitFor(() => {
      expect(postedBodies(requests)).toHaveLength(1);
    });

    const call = postedBodies(requests)[0];
    expect(call?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(call?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(call?.body).toMatchObject({
      equipmentId: EQUIPMENT_ID,
      reasonCode: 'MOLD_CHANGE',
    });
    expect((call?.body as { startedAt: string }).startedAt).toMatch(/^2026-08-11T14:20:00/);
    expect((call?.body as { endedAt?: string }).endedAt).toMatch(/^2026-08-11T15:07:00/);
  });

  it('「아직 진행 중」이면 끝 시각을 보내지 않는다 — 별도 깃발도 없다', async () => {
    const { requests } = renderScreen(baseRoutes());

    await flush();
    typeInterval(['2026-08-11', '14:20']);
    fireEvent.click(screen.getByLabelText(t.interval.stillOngoing));
    await chooseReason();
    save();

    await waitFor(() => {
      expect(postedBodies(requests)).toHaveLength(1);
    });

    const body = postedBodies(requests)[0]?.body as Record<string, unknown>;
    expect('endedAt' in body).toBe(false);
    expect(Object.keys(body).sort()).toEqual(['equipmentId', 'reasonCode', 'startedAt']);
  });

  it('끝이 시작보다 앞서면 저장하지 않고 두 칸에 사유를 세운다', async () => {
    const { requests } = renderScreen(baseRoutes());

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '13:00']);
    await chooseReason();
    save();
    await flush();

    expect(postedBodies(requests)).toHaveLength(0);
    expect(screen.getAllByText(t.errors.endedBeforeStarted).length).toBeGreaterThan(0);
  });

  it('사유를 고르지 않으면 저장하지 않고 무엇이 모자란지 말한다', async () => {
    const { requests } = renderScreen(baseRoutes());

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    save();
    await flush();

    expect(postedBodies(requests)).toHaveLength(0);
    expect(screen.getByText(t.errors.reasonRequired)).toBeTruthy();
  });

  it('사유 목록이 임시라는 사실을 감추지 않는다', async () => {
    renderScreen(baseRoutes());

    expect(await screen.findByText(t.reason.placeholderNotice)).toBeTruthy();
  });

  it('사번을 모르면 저장을 막고 그 사유를 말한다', async () => {
    const { requests } = renderScreen(baseRoutes(), { ...IDENTIFIED, workerNo: null });

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    await chooseReason();

    expect(screen.getByText(t.errors.workerMissing)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
    expect(postedBodies(requests)).toHaveLength(0);
  });

  it('단말 게이팅이 닫혀 있으면 막고, 판정하지 못한 것과 다른 말을 한다', async () => {
    renderScreen([
      downtimeListRoute(),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(false),
      createRoute(),
    ]);

    expect(await screen.findByText(t.errors.gateDenied)).toBeTruthy();
  });

  it('겹치는 구간이 있으면 경고하되 **막지 않는다**', async () => {
    const { requests } = renderScreen([
      downtimeListRoute({
        today: [
          downtime({
            startedAt: '2026-08-11T13:05:00+09:00',
            endedAt: '2026-08-11T13:20:00+09:00',
          }),
        ],
      }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      createRoute(),
    ]);

    await flush();
    typeInterval(['2026-08-11', '13:10'], ['2026-08-11', '13:30']);
    await chooseReason();

    expect(screen.getByText(/겹칩니다/)).toBeTruthy();

    save();

    await waitFor(() => {
      expect(postedBodies(requests)).toHaveLength(1);
    });
  });
});

describe('DowntimeRegisterScreen — 오프라인', () => {
  it('끊겨 있으면 오늘 집계를 부르지 않고 보이는 범위를 이름으로 말한다', async () => {
    setOnline(false);

    const { requests } = renderScreen([downtimeListRoute({ ongoing: [] }), gateRoute()]);

    await flush();

    /* 여러 단말이 함께 채우는 합계라 이 단말이 아는 것만으로 다시 계산하지 않는다. */
    expect(requests.some((request) => request.url.pathname === SUMMARY_PATH)).toBe(false);
    expect(screen.getByText(t.today.localOnly)).toBeTruthy();
    expect(screen.getByText(t.today.localOnlyDescription)).toBeTruthy();
    expect(screen.getByText(t.header.offline)).toBeTruthy();
  });

  it('끊긴 동안 저장한 것은 큐에 담기고 미전송 건수가 상시 보인다', async () => {
    setOnline(false);

    renderScreen([downtimeListRoute({ ongoing: [] }), gateRoute()]);

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    await chooseReason();
    save();

    expect(await screen.findByText(t.header.unsent(1))).toBeTruthy();
    /* 담긴 것이 곧 성공이다 — 다만 아직 닿지 않았음을 밝힌다. */
    expect(screen.getByText(t.actions.queued)).toBeTruthy();
  });
});

describe('DowntimeRegisterScreen — 고장 연결', () => {
  it('연결한 고장의 정지 시각을 **제안만** 하고 자동으로 넣지 않는다', async () => {
    renderScreen([
      downtimeListRoute(),
      summaryRoute(),
      breakdownsRoute([breakdown({ stoppedAt: '2026-08-11T14:20:00+09:00' })]),
      gateRoute(),
      createRoute(),
    ]);

    fireEvent.click(await screen.findByRole('combobox', { name: t.breakdown.title }));
    fireEvent.click(await screen.findByRole('option', { name: /SAMPLE-MLF-0088/ }));

    const startDate = screen.getByLabelText(
      `${t.interval.startedAt} ${t.interval.date}`,
    ) as HTMLInputElement;

    /* 제안이 떠 있을 뿐 칸은 아직 비어 있다 — 작업자가 확인해야 들어간다. */
    expect(screen.getByText(t.breakdown.suggestStart('14:20'))).toBeTruthy();
    expect(startDate.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: t.breakdown.applySuggestion }));

    await waitFor(() => {
      expect(startDate.value).toBe('2026-08-11');
    });
  });
});

describe('DowntimeRegisterScreen — 설비 미지정', () => {
  it('설비가 없으면 조회를 보내지 않고 그 사실을 먼저 말한다', async () => {
    const { fetch, requests } = createRecordingFetch([gateRoute()]);

    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <DowntimeRegisterScreen />
      </PopIdentityProvider>,
      { fetch, route: '/pop/downtime' },
    );

    await flush();

    expect(screen.getByText(t.header.equipmentMissing)).toBeTruthy();
    expect(requests.some((request) => request.url.pathname.startsWith(DOWNTIMES_PATH))).toBe(false);
  });
});
