import { messages } from '@omf-mes/i18n';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const CODE_VALUES_PATH = '/mdm/code-values';
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

/**
 * ③ 사유 선택지 — **고객의 코드 마스터에서 온다**(스펙 §4-A · `G-32`). 시드 여섯 중 둘만
 * 세운다: 목록의 «출처»가 서버라는 것만 확인하면 되고, 값을 다 적으면 시드가 늘 때 함께 는다.
 */
const reasonsRoute = (
  items: { code: string; codeName: string }[] = [
    { code: 'EQUIPMENT_FAILURE', codeName: '설비 고장' },
    { code: 'MOLD_CHANGE', codeName: '금형 교체' },
  ],
): StubRoute => ({
  match: (request) => isGet(request, CODE_VALUES_PATH),
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

/**
 * ⚠ **사유 선택지 라우트는 늘 붙인다.** 이 화면의 저장은 사유가 필수라, 그 목록을 세우지 않은
 * 시험은 「고를 것이 없다」로 막혀 정작 보려던 것을 못 본다. 다른 응답을 보려는 시험은
 * `reasonsRoute(...)` 를 «먼저» 넘겨 덮는다(앞선 라우트가 이긴다).
 */
const renderScreen = (
  routes: StubRoute[],
  identity: PopIdentity = IDENTIFIED,
  route: string = ROUTE,
) => {
  const { fetch, requests } = createRecordingFetch([...routes, reasonsRoute()]);
  const result = renderWithProviders(
    <PopIdentityProvider value={identity}>
      <DowntimeRegisterScreen />
    </PopIdentityProvider>,
    { fetch, route },
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

/** 사유를 고른다 — **선택칸 하나뿐이다**(스펙 §7 확정 2026-09-03 · 평면 1단). */
const chooseReason = async (): Promise<void> => {
  /* 선택 칸은 `combobox`로 서고, 접근 이름은 옆에 선 라벨이 준다. */
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
  vi.useRealTimers();
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

  it('끝난 구간이 섞여 오면 진행 중으로 그리지 않는다', async () => {
    /*
     * 「끝나지 않은 것만」으로 물어도 서버가 끝난 건을 섞어 줄 수 있다. 그대로 믿으면 화면이
     * 위에서는 「진행 중」이라 하고 아래 오늘 목록에는 같은 건을 끝난 구간으로 세운다 —
     * 실제 목 서버에서 그 모습을 봤다. 끝 시각의 부재는 화면이 스스로 확인할 수 있는 사실이다.
     */
    renderScreen([
      downtimeListRoute({ ongoing: [downtime()] }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
    ]);

    await flush();

    expect(screen.queryByRole('region', { name: t.ongoing.title })).toBeNull();
    /* 진행 중이 없으므로 저장도 막히지 않는다. */
    expect(screen.queryByText(t.ongoing.blocksNew)).toBeNull();
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

  /**
   * ⛔ **끊긴 동안의 종료는 「지금」이 아니다**(통보 109 · #1095). 종료 시각의 정본은 서버의
   *    최초 처리 시각이라, 큐에 머문 시간이 비가동 시간에 그대로 들어간다. 비가동은 정정
   *    경로가 없으므로 **누른 그 자리에서** 말해야 한다 — 나중에 숫자를 보고는 되돌릴 수 없다.
   */
  it('끊긴 채 종료하면 종료 시각이 서버 도착 시각임을 그 자리에서 알린다', async () => {
    setOnline(false);

    renderScreen([
      downtimeListRoute({ ongoing: [ongoingDowntime({ downtimeId: 5202 })] }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: t.ongoing.close }));

    expect(await screen.findByText(t.ongoing.closedQueued)).toBeTruthy();
    expect(screen.queryByText(t.ongoing.closed)).toBeNull();

    setOnline(true);
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

  it('시작 시각과 사유가 차기 전에는 「실적 저장」이 잠긴다 (스펙 §5-1 활성 조건)', async () => {
    renderScreen(baseRoutes());

    await flush();
    const saveButton = screen.getByRole('button', { name: t.actions.save });
    expect(saveButton).toBeDisabled();

    /* 시작만으로는 아직 모자라다 — 사유가 `NOT NULL` 이다. */
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    expect(saveButton).toBeDisabled();

    await chooseReason();
    expect(saveButton).toBeEnabled();
  });

  it('날짜만 치고 시각을 비우면 아직 「시작 시각」이 아니다 — 잠긴 채로 둔다', async () => {
    renderScreen(baseRoutes());

    await flush();
    fireEvent.change(screen.getByLabelText(`${t.interval.startedAt} ${t.interval.date}`), {
      target: { value: '2026-08-11' },
    });
    await chooseReason();

    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
  });

  it('아직 아무것도 적지 않았으면 「다시 입력」이 잠긴다 — 비울 것이 없다', async () => {
    renderScreen(baseRoutes());

    await flush();
    expect(screen.getByRole('button', { name: t.actions.reset })).toBeDisabled();

    /* 한 칸이라도 적으면 되돌릴 것이 생긴다. */
    typeInterval(['2026-08-11', '14:20']);
    expect(screen.getByRole('button', { name: t.actions.reset })).toBeEnabled();
  });

  it('고를 사유가 하나도 없으면 칸을 감추지 않고 잠근 뒤 사유를 말한다', async () => {
    /* ⛔ 스펙 §6-1 — 감추면 저장이 왜 막히는지 화면에 남는 것이 없다(사유는 `NOT NULL`). */
    renderScreen([reasonsRoute([]), ...baseRoutes()]);

    expect(await screen.findByText(t.errors.reasonsUnavailable)).toBeTruthy();
    expect(screen.getByRole('combobox', { name: t.reason.detail })).toBeDisabled();
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

describe('DowntimeRegisterScreen — 큐가 받아 온 뒤', () => {
  /**
   * 쓰기가 큐를 통해 나가므로 그 결과가 저절로 캐시에 반영되지 않는다. **되돌리지 않으면
   * 화면이 낡은 채로 선다** — 리뷰에서 나온 자리이고, 사번이 비어 쓰기가 막혀 있는 동안은
   * 실행되지 않아 앞선 검증들이 닿지 못했다.
   */
  it('종료가 받아들여지면 진행 중 구획이 내려가고 새 저장이 열린다', async () => {
    let ongoingItems: unknown[] = [ongoingDowntime({ downtimeId: 5201 })];

    const { requests } = renderScreen([
      {
        match: (request) => isGet(request, DOWNTIMES_PATH),
        respond: (request) => {
          const openOnly = new URL(request.url).searchParams.get('openOnly') === 'true';
          /* 종료가 서버에 닿은 뒤로는 열린 구간이 없다. */
          const items = openOnly ? ongoingItems : [];

          return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
        },
      },
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === closePath(5201),
        respond: () => {
          ongoingItems = [];

          return jsonResponse(downtime({ downtimeId: 5201 }));
        },
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: t.ongoing.close }));

    await waitFor(() => {
      expect(requests.some((request) => request.url.pathname === closePath(5201))).toBe(true);
    });

    /* 눌렀는데 아무 일도 일어나지 않는 화면을 두지 않는다. */
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.ongoing.title })).toBeNull();
    });

    /* 진행 중이 사라졌으므로 새 저장을 막을 이유도 없어졌다. */
    expect(screen.queryByText(t.ongoing.blocksNew)).toBeNull();
  });

  it('저장이 받아들여지면 오늘 집계를 다시 부른다', async () => {
    const { requests } = renderScreen([
      downtimeListRoute(),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      createRoute(),
    ]);

    await flush();
    const before = requests.filter((request) => request.url.pathname === SUMMARY_PATH).length;

    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    await chooseReason();
    save();

    /*
     * 합계를 화면이 스스로 더하지 않기로 한 결정은 옳지만, 그 결정이 「서버 값을 낡은 채로
     * 보인다」로 이어지면 안 된다 — 건수만 늘고 합계가 그대로면 둘이 어긋난 채 선다.
     */
    await waitFor(() => {
      expect(
        requests.filter((request) => request.url.pathname === SUMMARY_PATH).length,
      ).toBeGreaterThan(before);
    });
  });

  it('거부 배너를 닫을 수 있고, 새 저장을 시작하면 스스로 내려간다', async () => {
    let attempts = 0;

    const { requests } = renderScreen([
      downtimeListRoute(),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      {
        /*
         * ⚠ **첫 저장만 거부한다.** 늘 거부하는 스텁으로는 「새 저장이 앞 거부를 지운다」를
         * 잴 수 없다 — 지운 자리에 곧바로 새 거부가 들어차 화면이 같은 모양으로 남는다.
         */
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === DOWNTIMES_PATH,
        respond: () => {
          attempts += 1;

          return attempts === 1
            ? jsonResponse(
                { errors: [{ scope: 'screen', code: 'SAMPLE_REJECT', message: '합성 거부' }] },
                { status: 422 },
              )
            : jsonResponse(downtime({ downtimeId: 5299 }), { status: 201 });
        },
      },
    ]);

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    await chooseReason();
    save();

    const banner = (await screen.findByText(t.errors.saveFailed)).closest('div[role]');
    expect(banner).not.toBeNull();
    expect(postedBodies(requests)).toHaveLength(1);

    /* 거부가 돌아온 뒤에는 「저장했습니다」가 남아 있지 않다 — 한 화면이 두 말을 하지 않는다. */
    await waitFor(() => {
      expect(screen.queryByText(t.actions.saved)).toBeNull();
    });

    fireEvent.click(within(banner as HTMLElement).getByRole('button', { name: '닫기' }));

    await waitFor(() => {
      expect(screen.queryByText(t.errors.saveFailed)).toBeNull();
    });
  });

  it('닫지 않고 새로 저장해도 앞 회차의 거부는 내려간다', async () => {
    /*
     * ⚠ **닫기를 누르지 않는다.** 눌러 버리면 거부 기록이 이미 비어 있어, 새 저장이 그것을
     * 지우는지를 잴 수 없다 — 잴 수 없는 시험은 지키는 척만 한다.
     */
    let attempts = 0;

    const { requests } = renderScreen([
      downtimeListRoute(),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === DOWNTIMES_PATH,
        respond: () => {
          attempts += 1;

          return attempts === 1
            ? jsonResponse(
                { errors: [{ scope: 'screen', code: 'SAMPLE_REJECT', message: '합성 거부' }] },
                { status: 422 },
              )
            : jsonResponse(downtime({ downtimeId: 5299 }), { status: 201 });
        },
      },
    ]);

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);
    await chooseReason();
    save();

    expect(await screen.findByText(t.errors.saveFailed)).toBeTruthy();

    /* 남겨 두면 방금 저장한 것이 거부된 것처럼 읽힌다. */
    typeInterval(['2026-08-11', '09:00'], ['2026-08-11', '09:30']);
    await chooseReason();
    save();

    await waitFor(() => {
      expect(postedBodies(requests)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.queryByText(t.errors.saveFailed)).toBeNull();
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

describe('DowntimeRegisterScreen — 합계만 못 받았을 때', () => {
  it('보이는 줄은 서버 목록이므로 **「내 단말 입력분만」이라 부르지 않는다**', async () => {
    renderScreen([
      downtimeListRoute({ today: [downtime()] }),
      /* 목록은 왔는데 집계만 실패한 상태. */
      {
        match: (request) => isGet(request, SUMMARY_PATH),
        respond: () =>
          jsonResponse(
            { errors: [{ scope: 'screen', code: 'SAMPLE_FAIL', message: '합성 실패' }] },
            { status: 500 },
          ),
      },
      breakdownsRoute(),
      gateRoute(),
    ]);

    /* 합계 자리에만 못 받았다고 적는다 — 0으로 채우지도, 범위를 좁게 말하지도 않는다. */
    expect(await screen.findByText(new RegExp(t.errors.summaryUnavailable))).toBeTruthy();
    expect(screen.queryByText(t.today.localOnly)).toBeNull();
    expect(screen.queryByText(t.today.localOnlyDescription)).toBeNull();
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

    expect(screen.getByText(t.errors.equipmentMissing)).toBeTruthy();
    expect(requests.some((request) => request.url.pathname.startsWith(DOWNTIMES_PATH))).toBe(false);
  });
});

describe('DowntimeRegisterScreen — 시간이 흐른 뒤', () => {
  /**
   * 화면을 열어 둔 채 시간이 지나도 저장이 서야 한다.
   *
   * **실측 결함의 회귀 감지기다.** 시계를 「진행 중이 있을 때만」 돌렸더니, 저장이 열리는
   * 상태가 곧 진행 중이 없는 상태라 정작 입력하는 동안 시계가 멈춰 있었다 — 몇 분 뒤
   * `[지금]`으로 찍은 시각이 자기 화면의 멈춘 시계보다 «미래»가 되어 저장이 거부됐다.
   */
  it('20분 열어 둔 뒤 [지금]으로 찍어도 미래 시각으로 막지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 11, 9, 0));

    const { requests } = renderScreen([
      downtimeListRoute(),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      createRoute(),
    ]);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20 * 60_000);
    });

    fireEvent.click(screen.getAllByRole('button', { name: t.interval.now })[0] as HTMLElement);
    await chooseReason();
    save();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(t.errors.future)).toBeNull();
    expect(postedBodies(requests)).toHaveLength(1);
  }, 15_000);
});

describe('DowntimeRegisterScreen — 구간을 치기 전', () => {
  it('산출할 수 없으면 이유를 적지 않고 「—」로 둔다 — 0분과도 갈라진다', async () => {
    renderScreen([downtimeListRoute(), summaryRoute(), breakdownsRoute(), gateRoute()]);

    await flush();

    /*
     * ⛔ 산출 불가의 «이유»를 문장으로 적지 않는다 — 옆의 「아직 진행 중」이 이미 말하고,
     *    오류 문구와 같은 줄이라 경고처럼 읽혔다(사용자 지적).
     * ⚠ 자리 자체는 늘 남는다 — 글자가 들고 날 때마다 줄이 흔들리면 손가락이 빗나간다.
     */
    const empty = t.interval.duration(t.interval.durationEmpty);
    expect(screen.getByText(empty)).toBeTruthy();

    /* 시작만 찍어도, 「아직 진행 중」을 켜도 여전히 산출할 수 없다 — 표기는 같다. */
    typeInterval(['2026-08-11', '14:20']);
    expect(screen.getByText(empty)).toBeTruthy();

    fireEvent.click(screen.getByLabelText(t.interval.stillOngoing));
    expect(screen.getByText(empty)).toBeTruthy();
  });

  it('구간이 갖춰지면 길이를 낸다', async () => {
    renderScreen([downtimeListRoute(), summaryRoute(), breakdownsRoute(), gateRoute()]);

    await flush();
    typeInterval(['2026-08-11', '14:20'], ['2026-08-11', '15:07']);

    expect(screen.getByText(t.interval.duration('47분'))).toBeTruthy();
  });
});

describe('DowntimeRegisterScreen — 덜 친 종료 시각', () => {
  it('종료 날짜만 넣고 시각을 비우면 **조용히 진행 중으로 저장하지 않는다**', async () => {
    const { requests } = renderScreen([
      downtimeListRoute(),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
      createRoute(),
    ]);

    await flush();
    typeInterval(['2026-08-11', '14:20']);
    fireEvent.change(screen.getByLabelText(`${t.interval.endedAt} ${t.interval.date}`), {
      target: { value: '2026-08-11' },
    });
    await chooseReason();
    save();
    await flush();

    /* 끝을 적으려던 구간이 진행 중으로 남으면 그 뒤로 새 비가동도 시작할 수 없다. */
    expect(postedBodies(requests)).toHaveLength(0);
    expect(screen.getByText(t.errors.endedIncomplete)).toBeTruthy();
  });

  it('오류가 떠도 구간 줄의 높이가 변하지 않는다 — 치는 동안 아래가 밀리면 안 된다', async () => {
    renderScreen([downtimeListRoute(), summaryRoute(), breakdownsRoute(), gateRoute()]);

    await flush();
    /* 날짜만 치면 「덜 친 것」이 된다. */
    fireEvent.change(screen.getByLabelText(`${t.interval.startedAt} ${t.interval.date}`), {
      target: { value: '2026-08-11' },
    });

    /*
     * ⛔ 문구는 칸 «아래»가 아니라 줄 «안»에 선다 — 부품이 그리는 자리를 쓰면 줄이 60 에서
     *    120 으로 뛴다(실측). 시험 환경에는 스타일이 없으므로 **어디에 붙었는지**로 잰다.
     */
    const message = screen.getByText(t.errors.startedIncomplete);
    expect(message.closest('.downtime-time-row')).not.toBeNull();
    expect(message.parentElement).toHaveClass('downtime-time-row');

    /* 읽어 주는 연결은 유지한다 — 자리를 옮겼다고 관계까지 끊지 않는다. */
    const dateField = screen.getByLabelText(`${t.interval.startedAt} ${t.interval.date}`);
    expect(dateField).toHaveAttribute('aria-invalid', 'true');
    expect(dateField.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('시작을 아직 안 쳤어도 끝 칸의 문제를 바로 말한다', async () => {
    renderScreen([downtimeListRoute(), summaryRoute(), breakdownsRoute(), gateRoute()]);

    await flush();
    /* 시작은 건드리지 않고 끝 날짜만 넣는다 — 저장을 누르기 전이다. */
    fireEvent.change(screen.getByLabelText(`${t.interval.endedAt} ${t.interval.date}`), {
      target: { value: '2026-08-11' },
    });

    expect(await screen.findByText(t.errors.endedIncomplete)).toBeTruthy();
  });
});

describe('DowntimeRegisterScreen — 터치 타겟', () => {
  /**
   * 장갑 낀 손으로 누르는 버튼은 72픽셀 급이다 — 디자인 시스템의 `2xl`이 그 크기를 낸다.
   *
   * ⚠ 클래스 이름으로 재는 것은 차선이다. 스타일이 CSS 모듈이라 시험 환경에서는 계산된
   * 크기를 읽을 수 없고, 크기를 정하는 것이 그 클래스 하나뿐이라 여기서는 그것이 잣대가 된다.
   */
  const isExtraLarge = (button: HTMLElement): boolean => /xxl/.test(button.className);

  it('구획을 닫고 저장하는 버튼이 72픽셀 급으로 선다', async () => {
    renderScreen([
      downtimeListRoute({ ongoing: [ongoingDowntime()] }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
    ]);

    await screen.findByRole('region', { name: t.ongoing.title });

    /*
     * ⚠ **`[지금]`은 여기서 빠진다**(사용자 결정 2026-09-07). 스펙 §7 은 72픽셀 급으로
     *    적었지만, 같은 줄에 선 날짜·시각 칸이 56 이라 버튼만 커 보이고 줄 높이도 그 버튼이
     *    정해 ② 구획이 몫을 넘긴다. 터치 하한(일반 등급 56)은 지킨다.
     */
    screen.getAllByRole('button', { name: t.interval.now }).forEach((button) => {
      expect(isExtraLarge(button)).toBe(false);
    });

    expect(isExtraLarge(screen.getByRole('button', { name: t.ongoing.close }))).toBe(true);
    expect(isExtraLarge(screen.getByRole('button', { name: t.actions.save }))).toBe(true);
    expect(isExtraLarge(screen.getByRole('button', { name: t.actions.reset }))).toBe(true);
  });
});

describe('DowntimeRegisterScreen — 설비를 아직 고르지 않았을 때', () => {
  /*
   * ⛔ **묻지 않은 것을 「없다」로 말하지 않는다.** 설비가 정해지기 전에는 오늘 조회를 걸지
   *    않으므로 건수도 목록도 «모르는» 상태다. 그때 「비가동 0건」·「기록된 비가동이
   *    없습니다」로 그리면 오늘 비가동이 없었다는 «사실»로 읽힌다 — 실서버에 붙여 실제로
   *    그렇게 떴다. 합계 자리가 이미 지키던 구분(모르는 값 ≠ 없는 값)을 건수·목록에도 준다.
   */
  it('건수를 0으로 말하지 않고 무엇을 해야 나오는지 알린다', async () => {
    renderScreen(
      [downtimeListRoute(), summaryRoute(), breakdownsRoute(), gateRoute()],
      IDENTIFIED,
      '/pop/downtime',
    );

    await flush();

    expect(screen.getAllByText(t.today.notAsked).length).toBeGreaterThan(0);
    expect(screen.queryByText(new RegExp(t.today.summary(0, '')))).toBeNull();
    expect(screen.queryByText(t.today.empty)).toBeNull();
  });

  it('설비가 정해지면 건수를 말한다', async () => {
    renderScreen([
      downtimeListRoute({ today: [downtime()] }),
      summaryRoute(),
      breakdownsRoute(),
      gateRoute(),
    ]);

    await flush();

    expect(screen.queryByText(t.today.notAsked)).toBeNull();
  });
});
