import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { sessionEvent, WORK_ORDER_ID, WORK_SESSION_ID, WORKER_NO, workSession } from './fixtures';
import { workHoldKeys } from './queries';
import { WorkHoldRegisterScreen } from './screen';

const t = messages.workHoldRegister;

const SESSIONS_PATH = '/production/work-sessions';
const EVENTS_PATH = `${SESSIONS_PATH}/${String(WORK_SESSION_ID)}/events`;
const END_PATH = `${SESSIONS_PATH}/${String(WORK_SESSION_ID)}:end`;
const HOLD_PATH = `/production/work-orders/${String(WORK_ORDER_ID)}:hold`;
const RESUME_PATH = `/production/work-orders/${String(WORK_ORDER_ID)}:resume`;
const CODE_VALUES_PATH = '/mdm/code-values';

/**
 * 중단 사유는 **서버가 준다**(2026-09-06 개정 — 고객이 늘리는 마스터라 화면이 못 갖는다).
 * 아래는 그 응답 자리에 넣는 합성값이고, 순서까지 그대로 그려지는지를 시험이 본다.
 */
const REASON_ITEMS = [
  { codeValueId: 1, code: 'MOLD_CHANGE', codeName: '금형 교체', isActive: true },
  { codeValueId: 2, code: 'MATERIAL_SHORTAGE', codeName: '자재 결품', isActive: true },
  { codeValueId: 3, code: 'OTHER', codeName: '기타', isActive: true },
];
const MOLD_CHANGE_NAME = '금형 교체';

const ROUTE = `/pop/work-hold?workOrderId=${String(WORK_ORDER_ID)}&workerNo=${WORKER_NO}`;

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const sessionsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, SESSIONS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

const eventsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, EVENTS_PATH),
  respond: () => jsonResponse(items),
});

const failingRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '조회 실패' }, { status: 500 }),
});

const reasonsRoute: StubRoute = {
  match: (request) => isGet(request, CODE_VALUES_PATH),
  respond: () =>
    jsonResponse({
      items: REASON_ITEMS,
      page: { page: 1, size: 50, total: REASON_ITEMS.length },
    }),
};

/**
 * ⚠ **사유 조회 스텁을 «맨 뒤»에 붙인다.** 먼저 맞는 규칙이 이기므로, 실패 상황을 보려는
 * 시험은 자기 규칙을 앞에 두어 덮어쓸 수 있다.
 */
const renderScreen = (routes: StubRoute[], route = ROUTE) =>
  renderWithProviders(
    <PopIdentityProvider value={UNKNOWN_POP_IDENTITY}>
      <WorkHoldRegisterScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch([...routes, reasonsRoute]), route },
  );

describe('P-02-10 작업 중단 등록', () => {
  it('열린 세션의 번호·시작 시각을 세운다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    /*
     * ⚠ **구획은 `region` 이 아니라 이름으로 찾는다.** 다른 POP 화면과 같은 상자
     * (`Card bordered` + `pop-section`)로 세우면서 `<section>` 래퍼를 걷었다 — 카드는
     * `div` 라 `role=region` 이 붙지 않는다. 포장 작업도 `getByLabelText` 로 찾는다.
     */
    const panel = await screen.findByLabelText(t.session.sectionLabel);

    expect(within(panel).getByText(t.session.sessionNo(2))).toBeInTheDocument();
    expect(within(panel).getByText('09-02 08:00')).toBeInTheDocument();
  });

  /**
   * ⛔ **세션이 없으면 이 화면은 성립하지 않는다**(스펙 §5-2 — 세션 참조가 NOT NULL).
   * 빈 카드로 두면 작업자가 사유만 고르고 눌러 본 뒤에야 막힌 것을 안다.
   */
  it('열린 세션이 없으면 차단 안내를 세우고 사유를 고를 수 없게 한다', async () => {
    renderScreen([sessionsRoute([])]);

    expect(await screen.findByText(t.session.none)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
    });
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  /**
   * 「열린 것만」으로 물었지만 닫힌 세션이 섞여 오면 **없는 세션에 중단을 걸려고 한다** —
   * 끝 시각으로 스스로 확인할 수 있으므로 믿고 넘기지 않는다.
   */
  it('닫힌 세션이 섞여 오면 걸러 낸다', async () => {
    renderScreen([
      sessionsRoute([workSession({ endedAt: '2026-09-02T12:00:00+09:00' })]),
      eventsRoute([]),
    ]);

    expect(await screen.findByText(t.session.none)).toBeInTheDocument();
  });

  it('작업지시 없이 들어오면 조회하지 않고 되돌아갈 곳을 말한다', async () => {
    /* 스텁이 비어 있다 — 조회가 나가면 하네스가 던져서 이 시험이 실패한다. */
    renderScreen([], '/pop/work-hold');

    expect(await screen.findByText(t.entry.missingWorkOrder)).toBeInTheDocument();
  });

  it('이벤트 이력을 시각·구분·사유로 세운다', async () => {
    renderScreen([
      sessionsRoute([workSession()]),
      eventsRoute([
        sessionEvent({ workSessionEventId: 1, eventTypeCode: 'START' }),
        sessionEvent({
          workSessionEventId: 2,
          eventTypeCode: 'STOP',
          occurredAt: '2026-09-02T10:30:00+09:00',
          reasonCode: 'MOLD_CHANGE',
          reasonName: '금형 교체',
        }),
        sessionEvent({
          workSessionEventId: 3,
          eventTypeCode: 'RESUME',
          occurredAt: '2026-09-02T10:52:00+09:00',
        }),
      ]),
    ]);

    const history = await screen.findByLabelText(t.history.sectionLabel);
    const rows = (await within(history).findAllByRole('row')).slice(1);

    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText('10:30')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(t.eventTypes.STOP)).toBeInTheDocument();
    expect(within(rows[1]!).getByText('금형 교체')).toBeInTheDocument();
    /* 재개는 사유가 없다 — 「없음」이라 적지 않는다. */
    expect(within(rows[2]!).getByText(t.eventTypes.RESUME)).toBeInTheDocument();
    /* ⛔ 코드를 그대로 내밀지 않는다 — 이력은 「왜 멈췄나」를 읽는 자리다. */
    expect(within(history).queryByText('MOLD_CHANGE')).not.toBeInTheDocument();
    /* ⛔ 「정정할 수 없습니다」를 상시 세우지 않는다 — 데이터 규칙이지 화면 문구가 아니다. */
    expect(within(history).queryByText(/정정할 수 없습니다/u)).not.toBeInTheDocument();
  });

  /*
   * ⛔ **서버가 이름을 빼고 보내도 코드를 그대로 내밀지 않는다.** 지금 받아 온 사유 목록으로
   * 푼다 — 「MOLD_CHANGE」는 현장이 읽는 말이 아니다.
   */
  it('사유 이름이 안 와도 목록으로 풀어 보인다', async () => {
    renderScreen([
      sessionsRoute([workSession()]),
      eventsRoute([
        sessionEvent({
          workSessionEventId: 2,
          eventTypeCode: 'STOP',
          occurredAt: '2026-09-02T10:30:00+09:00',
          reasonCode: 'MOLD_CHANGE',
          /* `reasonName` 이 없다 */
        }),
      ]),
    ]);

    const history = await screen.findByLabelText(t.history.sectionLabel);

    await waitFor(() => {
      expect(within(history).getByText(MOLD_CHANGE_NAME)).toBeInTheDocument();
    });
    expect(within(history).queryByText('MOLD_CHANGE')).not.toBeInTheDocument();
  });

  /* ⚠ 목록에 없는 사유(다른 유형이 쓰는 그룹)는 코드를 그대로 보인다 — 임의로 접지 않는다. */
  it('목록에 없는 사유는 코드를 그대로 보인다', async () => {
    renderScreen([
      sessionsRoute([workSession()]),
      eventsRoute([
        sessionEvent({
          workSessionEventId: 3,
          eventTypeCode: 'CONTROL_OVERRIDE',
          reasonCode: 'SOME_OTHER_GROUP_VALUE',
        }),
      ]),
    ]);

    const history = await screen.findByLabelText(t.history.sectionLabel);

    expect(await within(history).findByText('SOME_OTHER_GROUP_VALUE')).toBeInTheDocument();
  });

  /* ⛔ 스펙 §5-4 가 7값을 확정했다(2026-08-23) — 확정된 것을 「임시」라 말하지 않는다. */
  it('사유 목록을 임시라고 말하지 않는다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    expect(await screen.findByText(t.form.reasonLabel)).toBeInTheDocument();
    expect(screen.queryByText(/임시 목록/u)).not.toBeInTheDocument();
  });

  /*
   * ⛔ **값 문면을 보지 않는다** — 거르지도, 차례를 바꾸지도 않는다. 차례가 뜻일 수 있다
   * (자주 쓰는 것부터 등). 화면이 목록을 들고 있으면 고객이 늘린 사유가 영영 안 보인다.
   */
  it('사유를 서버가 준 차례 그대로 세운다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    await screen.findByLabelText(t.form.sectionLabel);

    await waitFor(() => {
      expect(screen.getAllByRole('radio')).toHaveLength(REASON_ITEMS.length);
    });

    const values = screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'));

    expect(values).toEqual(REASON_ITEMS.map((item) => item.code));
    /* 이름도 서버 것이다 — 화면이 이름표를 들고 있지 않다. */
    expect(screen.getByRole('radio', { name: MOLD_CHANGE_NAME })).toBeInTheDocument();
  });

  /*
   * ⚠ **다 받지 못한 것을 「없다」로 읽히게 두지 않는다.** 고객이 늘리는 목록이라 쪽을 넘길 수
   * 있는데, 찾는 사유가 안 보이면 현장은 「기타」로 몰아 적는다 — 정정 경로가 없는 기록이다.
   */
  it('사유가 잘려 왔으면 그 사실을 말한다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, CODE_VALUES_PATH),
        respond: () =>
          jsonResponse({
            items: REASON_ITEMS,
            /* 서버가 센 전체가 받은 것보다 많다. */
            page: { page: 1, size: REASON_ITEMS.length, total: REASON_ITEMS.length + 5 },
          }),
      },
      sessionsRoute([workSession()]),
      eventsRoute([]),
    ]);

    expect(await screen.findByText(t.form.reasonTruncated)).toBeInTheDocument();
  });

  it('다 받았으면 잘렸다고 말하지 않는다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    await screen.findByRole('radio', { name: MOLD_CHANGE_NAME });
    expect(screen.queryByText(t.form.reasonTruncated)).not.toBeInTheDocument();
  });

  /** 「못 받았다」와 「없다」는 작업자가 할 일이 다르다 — 같은 말로 덮지 않는다. */
  it('사유를 못 받으면 실패로 말하고 빈 목록으로 그리지 않는다', async () => {
    renderScreen([
      failingRoute(CODE_VALUES_PATH),
      sessionsRoute([workSession()]),
      eventsRoute([]),
    ]);

    expect(await screen.findByText(t.form.reasonLoadFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.form.reasonEmpty)).not.toBeInTheDocument();
  });

  /** 실패를 빈 상태로 보이지 않는다 — 「없습니다」로 내면 이미 연 세션을 한 번 더 연다. */
  it('세션 조회가 실패하면 실패로 말한다', async () => {
    renderScreen([failingRoute(SESSIONS_PATH)]);

    expect(await screen.findByText(t.session.loadFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.session.none)).not.toBeInTheDocument();
    /* 세션을 모르면 이력도 모른다 — 「기록된 이벤트가 없습니다」로 단정하지 않는다. */
    expect(screen.queryByText(t.history.empty)).not.toBeInTheDocument();
  });

  /** ⚠ 이력을 못 읽은 것이 중단을 막지 않는다 — 이력은 설명하는 자리다. */
  it('이력 조회가 실패해도 세션 구획과 사유 선택은 선다', async () => {
    renderScreen([sessionsRoute([workSession()]), failingRoute(EVENTS_PATH)]);

    expect(await screen.findByText(t.history.loadFailed)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('radio')[0]).toBeEnabled();
    });
  });

  it('사번을 모르면 헤더가 그 사실을 말한다 — 없는 값을 지어내지 않는다', async () => {
    renderScreen(
      [sessionsRoute([workSession()]), eventsRoute([])],
      `/pop/work-hold?workOrderId=${String(WORK_ORDER_ID)}`,
    );

    expect(await screen.findByText(t.entry.workerUnknown)).toBeInTheDocument();
  });

  /**
   * 전송 — **큐에 담는 것이 곧 성공이다**(공유계약 C-1 #2). 통신을 기다리지 않는다.
   */
  describe('중단·재개 전송', () => {
    beforeEach(() => {
      globalThis.localStorage.clear();
    });

    afterEach(() => {
      globalThis.localStorage.clear();
    });

    /**
     * ⭐ **한 조작이 호출 둘을 낸다**(2026-09-06 개정) — W/O 층 전환과 세션 사건이다.
     * 그래서 스텁도 경로 하나가 아니라 «쓰기 전부»를 받는다.
     */
    const writePost = (sent: Request[], status = 201): StubRoute => ({
      match: (request) => request.method === 'POST',
      respond: (request) => {
        sent.push(request);

        return jsonResponse({}, { status });
      },
    });

    const paths = (sent: Request[]): string[] =>
      sent.map((request) => new URL(request.url).pathname);

    /*
     * ⭐ **두 층 둘 다를 부른다**(스펙 §5-4) — W/O 층이 상태를 옮기고 세션 사건이 구간 안의
     * 일을 남긴다. 하나만 나가면 두 층이 어긋난 채 굳는다.
     */
    it('사유를 고르고 누르면 W/O 중단과 세션 사건이 차례로 나간다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), writePost(sent)]);

      await user.click(await screen.findByRole('radio', { name: MOLD_CHANGE_NAME }));
      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(sent).toHaveLength(2);
      });
      expect(paths(sent)).toEqual([HOLD_PATH, EVENTS_PATH]);

      const holdBody: unknown = await sent[0]!.json();
      const eventBody: unknown = await sent[1]!.json();

      expect(holdBody).toMatchObject({ reasonCode: 'MOLD_CHANGE' });
      expect(eventBody).toMatchObject({ eventTypeCode: 'STOP', reasonCode: 'MOLD_CHANGE' });
      /* 발생 시각은 단말이 보낸다(계약) — 서버 수신 시각과 다른 값이다. */
      expect(eventBody).toHaveProperty('occurredAt', expect.any(String));
    });

    /*
     * ⛔ **등록한 뒤에는 고른 표시가 남지 않는다.** 안쪽 초안은 비워지는데 화면만 골라진 채로
     * 남으면, 골랐다고 믿고 누른 사람에게 「사유를 고르세요」가 뜬다(실측 2026-09-09).
     */
    it('등록하면 고른 사유 표시가 함께 지워진다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), writePost(sent)]);

      const chosen = await screen.findByRole('radio', { name: MOLD_CHANGE_NAME });

      await user.click(chosen);
      expect(chosen).toBeChecked();

      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(sent).toHaveLength(2);
      });
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: MOLD_CHANGE_NAME })).not.toBeChecked();
      });
    });

    /*
     * ⭐ **비고가 실제로 저장된다**(2026-09-06 게이트 승인). 앞선 판은 담을 자리가 없어 칸
     * 자체를 두지 않았다 — 이제 W/O 중단 본문이 받는다.
     */
    it('비고는 W/O 중단 본문으로 나간다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), writePost(sent)]);

      await user.click(await screen.findByRole('radio', { name: MOLD_CHANGE_NAME }));
      await user.type(screen.getByLabelText(t.form.remarksLabel), '금형 교체 대기');
      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(sent).toHaveLength(2);
      });

      expect(await sent[0]!.json()).toMatchObject({ note: '금형 교체 대기' });
      /* 세션 «사건» 에는 그 칸이 없다 — 없는 칸에 실어 보내지 않는다. */
      expect(await sent[1]!.json()).not.toHaveProperty('note');
    });

    /* ⛔ ⓐ 차단(스펙 §6) — 사유 없이 보내면 정정할 수 없는 기록이 사유 없이 남는다. */
    it('사유를 고르지 않으면 보내지 않고 말한다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), writePost(sent)]);

      await user.click(await screen.findByRole('button', { name: t.form.stopAction }));

      expect(await screen.findByRole('alert')).toHaveTextContent(t.form.reasonRequired);
      expect(sent).toHaveLength(0);
    });

    /* 스펙 §6 — 「이미 중단 상태면 재개만 활성」. 돌고 있는 설비에 중단을 두 번 걸지 않는다. */
    it('중단된 세션에서는 재개만 누를 수 있다', async () => {
      renderScreen([sessionsRoute([workSession({ statusCode: 'STOPPED' })]), eventsRoute([])]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeEnabled();
      });
      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
    });

    /* ⛔ 재개는 사유를 비운다(§5-4) — 초안에 남은 사유를 실어 보내지 않는다. */
    it('재개는 사유 없이 나간다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([
        sessionsRoute([workSession({ statusCode: 'STOPPED' })]),
        eventsRoute([]),
        writePost(sent),
      ]);

      await user.click(await screen.findByRole('button', { name: t.form.resumeAction }));

      await waitFor(() => {
        expect(sent).toHaveLength(2);
      });
      expect(paths(sent)).toEqual([RESUME_PATH, EVENTS_PATH]);

      /* 본문은 한 번만 읽을 수 있다 — 두 번 부르면 두 번째가 던져 검사가 헛돈다. */
      const body: unknown = await sent[1]!.json();

      expect(body).toMatchObject({ eventTypeCode: 'RESUME' });
      expect(body).not.toHaveProperty('reasonCode');
    });

    /*
     * ⛔ **적은 것이 어디로 가는지 숨기지 않는다.** 비고를 담을 칸이 계약에 없어 이번에는
     * 나가지 않는다 — 말하지 않으면 작업자는 남았다고 믿는다.
     */
    /*
     * ⛔ **담긴 중단이 아직 안 나갔으면 한 번 더 누를 수 없다.** 서버에 닿기 전에는 세션이
     * 여전히 「진행」이라, 잠그지 않으면 같은 중단이 두 건 기록된다 — 정정 경로가 없다.
     */
    /*
     * ⛔ **같은 방향을 두 번 담을 수 없다.** 서버에 닿기 전에는 세션이 여전히 「진행」이라,
     * 막지 않으면 같은 중단이 두 건 기록된다 — 정정 경로가 없다.
     *
     * ⭐ **반대 방향은 열어 둔다.** 망이 끊기면 큐가 비지 않는데 둘 다 잠그면, 설비가 다시
     * 돌아도 재개를 등록할 방법이 사라진다(공유계약 C-1 #2).
     */
    it('중단을 담으면 중단은 잠기고 재개가 열린다', async () => {
      const user = userEvent.setup();

      renderScreen([
        sessionsRoute([workSession()]),
        eventsRoute([]),
        {
          match: (request) => request.method === 'POST',
          /* 서버가 아직 받지 못한 상태 — 큐에 남아 있다. */
          respond: () => jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 }),
        },
      ]);

      await user.click(await screen.findByRole('radio', { name: MOLD_CHANGE_NAME }));
      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      });
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeEnabled();
    });

    /* 서버가 받으면 세션·이력을 다시 읽는다 — 옛 상태를 들고 있으면 버튼이 틀리게 열린다. */
    it('전송이 닿으면 세션을 다시 읽는다', async () => {
      const user = userEvent.setup();
      let sessionReads = 0;

      renderScreen([
        {
          match: (request) => isGet(request, SESSIONS_PATH),
          respond: () => {
            sessionReads += 1;

            return jsonResponse({
              items: [workSession()],
              page: { page: 1, size: 50, total: 1 },
            });
          },
        },
        eventsRoute([]),
        {
          match: (request) => request.method === 'POST',
          respond: () => jsonResponse({}, { status: 201 }),
        },
      ]);

      await user.click(await screen.findByRole('radio', { name: MOLD_CHANGE_NAME }));
      const before = sessionReads;

      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(sessionReads).toBeGreaterThan(before);
      });
    });

    /*
     * ⛔ **보낸 유형은 그 전송의 다시 읽기까지만 쓴다.** 세션 값이 새로 오면 판정 근거는
     * 서버가 말하는 상태로 넘어가야 하는데, 옛 유형이 남아 있으면 **뒤에 다른 이유로 세션을
     * 다시 읽는 동안 반대 방향 버튼이 열린다** — 돌고 있는 설비에 재개가 열리는 식이다.
     */
    it('보낸 유형은 다음 다시 읽기까지 남지 않는다', async () => {
      const user = userEvent.setup();
      let sessionHangs = false;

      const { queryClient } = renderScreen([
        {
          match: (request) => isGet(request, SESSIONS_PATH),
          respond: () =>
            sessionHangs
              ? /* 끝나지 않는 응답 — 「다시 읽는 중」이 유지된다. */
                new Response(new ReadableStream({ start: () => undefined }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                })
              : jsonResponse({
                  items: [workSession()],
                  page: { page: 1, size: 50, total: 1 },
                }),
        },
        eventsRoute([]),
        writePost([]),
      ]);

      await user.click(await screen.findByRole('radio', { name: MOLD_CHANGE_NAME }));
      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      /* 전송이 닿고 다시 읽기가 끝나 서버 상태(진행 중)로 돌아온 지점. */
      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.form.stopAction })).toBeEnabled();
      });

      sessionHangs = true;
      await act(async () => {
        void queryClient.invalidateQueries({ queryKey: workHoldKeys.all });
      });
      /* 다시 읽기가 «시작된» 것을 화면이 실제로 받아 그리는 지점까지 흘린다. */
      await act(async () => {
        await new Promise((resolve) => {
          globalThis.setTimeout(resolve, 0);
        });
      });

      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeEnabled();
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    /* ⛔ 사번이 없으면 서버가 거부한다 — 누르고 나서가 아니라 누르기 전에 막는다. */
    it('사번을 모르면 두 버튼이 막히고 이유를 말한다', async () => {
      renderScreen(
        [sessionsRoute([workSession()]), eventsRoute([])],
        `/pop/work-hold?workOrderId=${String(WORK_ORDER_ID)}`,
      );

      expect(await screen.findByText(t.form.workerRequired)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    it('세션이 없으면 두 버튼 다 막힌다', async () => {
      renderScreen([sessionsRoute([]), eventsRoute([])]);

      expect(await screen.findByText(t.session.none)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    it('진행 중인 세션에서는 재개가 막힌다', async () => {
      renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.form.stopAction })).toBeEnabled();
      });
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    /*
     * ⛔ **「중단이 아니면 진행 중」이 아니다.** 끝난 세션·모르는 상태에서 중단이 열리면
     * 정정할 수 없는 기록이 엉뚱한 세션에 남는다.
     */
    it('끝났거나 모르는 상태의 세션에는 중단을 걸 수 없다', async () => {
      renderScreen([sessionsRoute([workSession({ statusCode: 'ENDED' })]), eventsRoute([])]);

      /*
       * ⛔ **세션이 «선 뒤에» 본다.** 조회 전에는 어차피 두 버튼이 막혀 있어, 기다리지 않고
       * 보면 「아직 안 왔다」를 「막혔다」로 읽고 검사가 헛돈다.
       */
      expect(await screen.findAllByText(t.session.sessionNo(2))).not.toHaveLength(0);

      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    /*
     * ⭐ **담을 자리가 정해져 칸이 섰다**(2026-09-06 게이트 승인 — `WorkOrderHold.note`).
     * 앞선 판은 「버릴 것을 받는 칸은 두지 않는다」로 칸 자체를 빼 두었다.
     */
    it('비고 칸을 세운다', async () => {
      renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

      expect(await screen.findByLabelText(t.form.remarksLabel)).toBeInTheDocument();
    });
  });

  /**
   * 세션 종료 — **되돌릴 수 없다**(스펙 §5-4 · 2026-09-06 게이트 승인).
   *
   * 옛 판에는 이 버튼이 아예 없었다(스펙 §5-4 와 §8 미결 5 가 갈려 있어 회신을 기다렸다).
   */
  describe('세션 종료', () => {
    beforeEach(() => {
      globalThis.localStorage.clear();
    });

    afterEach(() => {
      globalThis.localStorage.clear();
    });

    const writePost = (sent: Request[]): StubRoute => ({
      match: (request) => request.method === 'POST',
      respond: (request) => {
        sent.push(request);

        return jsonResponse({}, { status: 201 });
      },
    });

    /* ⛔ 확인 없이 닫지 않는다 — 닫은 세션은 다시 열 수 없다. */
    it('확인 창을 거친 뒤에야 세션을 닫는다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), writePost(sent)]);

      await user.click(await screen.findByRole('button', { name: t.end.action }));

      expect(await screen.findByText(t.end.confirmTitle)).toBeInTheDocument();
      expect(sent).toHaveLength(0);

      await user.click(screen.getByRole('button', { name: t.end.confirmAction }));

      await waitFor(() => {
        expect(sent).toHaveLength(1);
      });
      expect(new URL(sent[0]!.url).pathname).toBe(END_PATH);
      /* ⛔ 「비우기로 정했다」 — 자리가 있다고 채우지 않는다(공유계약 A-21). */
      expect(await sent[0]!.json()).not.toHaveProperty('stopReasonCode');
    });

    it('계속 작업을 고르면 아무것도 보내지 않는다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), writePost(sent)]);

      await user.click(await screen.findByRole('button', { name: t.end.action }));
      await user.click(await screen.findByRole('button', { name: t.end.keepWorking }));

      await waitFor(() => {
        expect(screen.queryByText(t.end.confirmTitle)).not.toBeInTheDocument();
      });
      expect(sent).toHaveLength(0);
    });

    /*
     * ⛔ **중단 중에는 닫지 않는다** — 스펙이 「세션이 열려 있고 지금 중단 상태가 아니다」로
     * 좁혔다. 중단 상태에서도 종료를 허용할지는 게이트가 정하지 않았다.
     */
    it('중단된 세션에서는 종료가 잠기고 이유를 말한다', async () => {
      renderScreen([sessionsRoute([workSession({ statusCode: 'STOPPED' })]), eventsRoute([])]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.end.action })).toBeDisabled();
      });
      expect(screen.getByText(t.end.blocked)).toBeInTheDocument();
    });

    /* ⛔ 종료된 세션은 애초에 열린 세션 조회에 없다 — 중단·재개·종료 셋 다 설 자리가 없다. */
    it('세션이 없으면 종료 버튼도 서지 않는다', async () => {
      renderScreen([sessionsRoute([]), eventsRoute([])]);

      expect(await screen.findByText(t.session.none)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: t.end.action })).not.toBeInTheDocument();
    });

    it('사번을 모르면 종료도 잠긴다 — 서버가 거부한다', async () => {
      renderScreen(
        [sessionsRoute([workSession()]), eventsRoute([])],
        `/pop/work-hold?workOrderId=${String(WORK_ORDER_ID)}`,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.end.action })).toBeDisabled();
      });
    });
  });
});
